import type { Invoice } from '../types';
import { saveInvoice } from './invoiceService';

// ============================================================
//  Comarch Betterfly — źródło danych dla kontekstu SPÓŁKA.
//  Odpowiednik infaktService (JDG). Tylko odczyt.
//
//  RÓŻNICA WOBEC inFAKT: Betterfly nie udostępnia w API plików PDF
//  ani załączników, więc NIE archiwizujemy dokumentów do SharePoint —
//  synchronizowane są wyłącznie dane faktur.
// ============================================================

// UWAGA: inFakt zwraca kwoty w groszach, Betterfly wg dokumentacji w złotych
// (NetTotal / VatTotal / GrossTotal jako wartości dziesiętne) — NIE dzielimy przez 100.
// Weryfikacja na żywych danych: GET /api/betterfly-sync?type=invoices&raw=1
function num(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

function pick(obj: any, ...keys: string[]): any {
  if (!obj) return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return undefined;
}

function dateOnly(v: any): string {
  return (v || '').toString().split('T')[0];
}

// Kontrahent bywa obiektem ({ Name, Nip, ... }) albo samym stringiem — obsługujemy oba
function partyName(party: any): string {
  if (!party) return '';
  if (typeof party === 'string') return party;
  return String(pick(party, 'Name', 'CompanyName', 'FullName', 'DisplayName') || '');
}

function partyNip(party: any): string {
  if (!party || typeof party === 'string') return '';
  return String(pick(party, 'Nip', 'NIP', 'TaxNumber', 'VatNumber') || '');
}

type CustomerInfo = { name: string; nip: string };

// Mapuje rekord Betterfly → nasz Invoice.
// custMap: Id kontrahenta → {name, nip} — rejestr VAT zakupu podaje tylko CustomerId.
function mapBetterfly(raw: any, type: 'sales' | 'cost', custMap?: Map<string, CustomerInfo>): Invoice {
  // Sprzedaż: nabywcą jest PurchasingParty. Zakup/koszt: obiekt strony bywa nieobecny —
  // wtedy rozwiązujemy CustomerId z mapy kontrahentów.
  const party = type === 'sales'
    ? pick(raw, 'PurchasingParty', 'ReceivingParty', 'Customer')
    : pick(raw, 'SellingParty', 'Seller', 'Supplier', 'Customer');

  const custId = pick(raw, 'CustomerId', 'SellingPartyId', 'PurchasingPartyId', 'ReceivingPartyId');
  const fromMap = custId !== undefined && custMap ? custMap.get(String(custId)) : undefined;

  const number = pick(raw, 'Number', 'FullNumber', 'DocumentNumber') || '';
  const issueDate = dateOnly(pick(raw, 'IssueDate', 'SalesDate', 'PurchaseDate'));
  const dueDate = dateOnly(pick(raw, 'PaymentDeadline', 'PaymentDate', 'DueDate'));

  // PaymentStatus: 0 = niezapłacona, 1 = zapłacona całkowicie, 2 = częściowo
  const payStatus = Number(pick(raw, 'PaymentStatus') ?? 0);

  // Numer obcy + oznaczenie korekty/bufora + płatność częściowa
  const refNumber = pick(raw, 'ReferenceNumber', 'CorrectedDocumentNumber');
  const notes = [
    refNumber ? `Nr obcy: ${refNumber}` : '',
    Number(pick(raw, 'Status') ?? 1) === 0 ? 'Dokument w buforze' : '',
    payStatus === 2 ? 'Zapłacona częściowo' : '',
  ].filter(Boolean).join(' · ');

  const id = pick(raw, 'Id', 'ID', 'id');

  return {
    type,
    number: String(number),
    issueDate,
    dueDate: dueDate || issueDate,
    counterparty: partyName(party) || fromMap?.name || (custId !== undefined ? `Kontrahent #${custId}` : ''),
    nip: partyNip(party) || fromMap?.nip || '',
    lines: [],
    netTotal: num(pick(raw, 'NetTotal', 'CurrencyNetTotal')),
    vatTotal: num(pick(raw, 'VatTotal', 'CurrencyVatTotal')),
    grossTotal: num(pick(raw, 'GrossTotal', 'CurrencyGrossTotal')),
    currency: pick(raw, 'CurrencyCode', 'Currency') || 'PLN',
    paid: payStatus === 1,
    notes,
    sourceSystem: 'betterfly',
    sourceId: id !== undefined ? String(id) : undefined,
  };
}

// Pobiera surowe strony danego zasobu z backendu Betterfly
async function fetchAllRaw(endpoint: string): Promise<any[]> {
  const all: any[] = [];
  let page = 1;
  const maxPages = 100; // bezpiecznik (strona = 50 rekordów)
  while (page <= maxPages) {
    const res = await fetch(`/api/betterfly-sync?type=${endpoint}&page=${page}`);
    if (!res.ok) {
      let msg = 'Błąd pobierania z Comarch Betterfly';
      try { msg = (await res.json()).error || msg; } catch {}
      throw new Error(msg);
    }
    const data = await res.json();
    const items: any[] = data.items || [];
    all.push(...items);
    if (items.length < (data.pageSize || 50)) break; // ostatnia strona
    page++;
  }
  return all;
}

// Buduje mapę Id kontrahenta → {nazwa, NIP}. Rejestr VAT zakupu podaje tylko CustomerId,
// więc nazwy dociągamy z osobnego zasobu /customers.
async function fetchCustomerMap(): Promise<Map<string, CustomerInfo>> {
  const map = new Map<string, CustomerInfo>();
  try {
    const rows = await fetchAllRaw('customers');
    for (const c of rows) {
      const id = pick(c, 'Id', 'ID', 'id');
      if (id === undefined) continue;
      map.set(String(id), {
        name: String(pick(c, 'Name', 'CompanyName', 'FullName', 'DisplayName') || ''),
        nip: String(pick(c, 'Nip', 'NIP', 'TaxNumber', 'VatNumber') || ''),
      });
    }
  } catch { /* brak dostępu do customers — nazwy zostaną jako "Kontrahent #id" */ }
  return map;
}

// Pobiera wszystkie faktury danego typu z Betterfly (przez backend), z nazwami kontrahentów
export async function fetchBetterfly(type: 'sales' | 'cost'): Promise<Invoice[]> {
  const endpoint = type === 'sales' ? 'invoices' : 'purchase';
  const [rows, custMap] = await Promise.all([fetchAllRaw(endpoint), fetchCustomerMap()]);
  return rows.map(raw => mapBetterfly(raw, type, custMap));
}

/**
 * Lekki auto-sync DANYCH. Zapisuje tylko nowe/zmienione faktury.
 * Odpowiednik autoSyncData z infaktService.
 */
export async function autoSyncDataBetterfly(type: 'sales' | 'cost', context: string, existing: Invoice[]): Promise<number> {
  const fromBf = await fetchBetterfly(type);
  let changed = 0;
  for (const inv of fromBf) {
    const match = existing.find(x => x.number && inv.number && x.number.trim().toLowerCase() === inv.number.trim().toLowerCase());
    if (match) {
      inv.spId = match.spId;
      inv.fileUrl = match.fileUrl;
      inv.attachments = match.attachments;
      if (match.paid === inv.paid && match.grossTotal === inv.grossTotal && match.netTotal === inv.netTotal) continue;
    }
    try { await saveInvoice(inv, context); changed++; } catch { /* pojedynczy błąd — pomijamy */ }
  }
  return changed;
}

/**
 * Synchronizuje faktury z Betterfly do SharePoint (dedup po numerze, upsert).
 * Sygnatura zgodna z syncFromInfakt, żeby UI był wspólny.
 * `archived` zawsze 0 — Betterfly nie udostępnia plików przez API.
 */
export async function syncFromBetterfly(
  type: 'sales' | 'cost',
  context: string,
  existing: Invoice[],
  onProgress?: (done: number, total: number, archived: number) => void,
): Promise<{ ok: number; archived: number; total: number }> {
  const fromBf = await fetchBetterfly(type);
  let ok = 0;

  for (let i = 0; i < fromBf.length; i++) {
    const inv = fromBf[i];
    const match = existing.find(x => x.number && inv.number && x.number.trim().toLowerCase() === inv.number.trim().toLowerCase());
    if (match) {
      inv.spId = match.spId;
      // zachowaj ręcznie wgrane dokumenty — Betterfly ich nie dostarcza
      inv.fileUrl = match.fileUrl;
      inv.attachments = match.attachments;
    }
    await saveInvoice(inv, context);
    ok++;
    onProgress?.(i + 1, fromBf.length, 0);
  }

  return { ok, archived: 0, total: fromBf.length };
}
