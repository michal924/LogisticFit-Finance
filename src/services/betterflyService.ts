import type { Invoice } from '../types';
import { saveInvoice, getInvoices } from './invoiceService';
import { uploadDocument } from './graphService';

// ============================================================
//  Comarch Betterfly — źródło danych dla kontekstu SPÓŁKA.
//  Odpowiednik infaktService (JDG). Tylko odczyt.
//
//  PDF: faktury sprzedaży i proformy mają wydruk w API (/{id}/print),
//  pobierany przez /api/betterfly-pdf i archiwizowany do SharePoint przy
//  pełnej synchronizacji. Koszty (rejestr VAT zakupu) nie mają w API ani
//  wydruku, ani załączników — dla nich dokument trzeba wgrać ręcznie.
// ============================================================

// UWAGA: inFakt zwraca kwoty w groszach, Betterfly wg dokumentacji w złotych
// (NetTotal / VatTotal / GrossTotal jako wartości dziesiętne) — NIE dzielimy przez 100.
// Weryfikacja na żywych danych: GET /api/betterfly-sync?type=invoices&raw=1
function num(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

// Mapowanie VatRateId (Comarch Betterfly) → stawka. Potwierdzone: 9 = 23%.
// Domyślnie 23% (dominująca) — net liczymy zawsze dokładnie, więc ew. inna stawka dotknie tylko VAT proform.
const VAT_RATE: Record<number, number> = { 9: 0.23 };

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
function mapBetterfly(raw: any, type: 'sales' | 'cost' | 'proforma', custMap?: Map<string, CustomerInfo>): Invoice {
  const salesSide = type === 'sales' || type === 'proforma';
  // Sprzedaż/proforma: nabywcą jest PurchasingParty. Zakup/koszt: obiekt strony bywa nieobecny —
  // wtedy rozwiązujemy CustomerId z mapy kontrahentów.
  const party = salesSide
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
  // Podgląd PDF przez nasz backend (sprzedaż/proforma). Po archiwizacji zastępowany linkiem SharePoint.
  const fileUrl = salesSide && id !== undefined
    ? `/api/betterfly-pdf?type=${type}&id=${encodeURIComponent(String(id))}`
    : '';

  // Sumy: faktury/koszty mają NetTotal itd. na górnym poziomie; proformy NIE —
  // liczymy z Items (ProductPrice × ilość, VAT wg stawki). VatRateId=9 → 23% (potwierdzone).
  let net = num(pick(raw, 'NetTotal', 'CurrencyNetTotal'));
  let vat = num(pick(raw, 'VatTotal', 'CurrencyVatTotal'));
  let gross = num(pick(raw, 'GrossTotal', 'CurrencyGrossTotal'));
  if (!net && !gross && Array.isArray(raw.Items)) {
    net = 0; vat = 0;
    for (const it of raw.Items) {
      const qty = num(pick(it, 'Quantity')) || 1;
      const lineNet = num(pick(it, 'ItemNetValue', 'ProductPrice', 'ProductCurrencyPrice')) * qty;
      const rate = VAT_RATE[Number(pick(it, 'VatRateId'))] ?? 0.23;
      net += lineNet;
      vat += num(pick(it, 'ItemVATValue')) || lineNet * rate;
    }
    gross = net + vat;
  }

  // Pozycje faktury (do podglądu) — z Items Betterfly
  const lines: any[] = Array.isArray(raw.Items) ? raw.Items.map((it: any) => {
    const qty = num(pick(it, 'Quantity')) || 1;
    const unit = num(pick(it, 'ProductPrice', 'ProductCurrencyPrice'));
    const rate = VAT_RATE[Number(pick(it, 'VatRateId'))] ?? 0.23;
    const na = num(pick(it, 'ItemNetValue')) || unit * qty;
    const va = num(pick(it, 'ItemVATValue')) || na * rate;
    return {
      description: pick(it, 'ProductName', 'ProductDescription', 'Name') || '—',
      quantity: qty,
      unitPrice: unit || na,
      vatRate: Math.round(rate * 100),
      netAmount: Math.round(na * 100) / 100,
      vatAmount: Math.round(va * 100) / 100,
      grossAmount: Math.round((na + va) * 100) / 100,
    };
  }) : [];

  return {
    type,
    number: String(number),
    issueDate,
    dueDate: dueDate || issueDate,
    counterparty: partyName(party) || fromMap?.name || (custId !== undefined ? `Kontrahent #${custId}` : ''),
    nip: partyNip(party) || fromMap?.nip || '',
    lines,
    netTotal: Math.round(net * 100) / 100,
    vatTotal: Math.round(vat * 100) / 100,
    grossTotal: Math.round(gross * 100) / 100,
    currency: pick(raw, 'CurrencyCode', 'Currency') || 'PLN',
    paid: payStatus === 1,
    notes,
    fileUrl,
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
        nip: String(pick(c, 'CustomerTaxNumber', 'Nip', 'NIP', 'TaxNumber', 'VatNumber') || ''),
      });
    }
  } catch { /* brak dostępu do customers — nazwy zostaną jako "Kontrahent #id" */ }
  return map;
}

// Pobiera wszystkie faktury danego typu z Betterfly (przez backend), z nazwami kontrahentów
export async function fetchBetterfly(type: 'sales' | 'cost' | 'proforma'): Promise<Invoice[]> {
  const endpoint = type === 'sales' ? 'invoices' : type === 'proforma' ? 'proforma' : 'purchase';
  const [rows, custMap] = await Promise.all([fetchAllRaw(endpoint), fetchCustomerMap()]);
  return rows.map(raw => mapBetterfly(raw, type, custMap));
}

/**
 * Lekki auto-sync DANYCH. Zapisuje tylko nowe/zmienione faktury.
 * Odpowiednik autoSyncData z infaktService.
 */
export async function autoSyncDataBetterfly(type: 'sales' | 'cost' | 'proforma', context: string, _existing?: Invoice[]): Promise<number> {
  // Dedup względem ŚWIEŻEJ listy z SharePoint (nie stanu UI) — chroni przed duplikatami
  const [fromBf, existing] = await Promise.all([fetchBetterfly(type), getInvoices(type, context)]);
  let changed = 0;
  for (const inv of fromBf) {
    const match = existing.find(x => x.number && inv.number && x.number.trim().toLowerCase() === inv.number.trim().toLowerCase());
    if (match) {
      inv.spId = match.spId;
      // zachowaj kopię SharePoint / ręcznie wgrane dokumenty; bez nich zostaje link podglądu z Betterfly
      inv.fileUrl = match.fileUrl || inv.fileUrl;
      inv.attachments = match.attachments;
      const sameDoc = match.fileUrl === inv.fileUrl;
      if (sameDoc && match.paid === inv.paid && match.grossTotal === inv.grossTotal && match.netTotal === inv.netTotal) continue;
    }
    try { await saveInvoice(inv, context); changed++; } catch { /* pojedynczy błąd — pomijamy */ }
  }
  return changed;
}

function isArchived(url?: string): boolean {
  return !!url && /sharepoint\.com/i.test(url);
}

const ARCHIVE_CATEGORY: Record<string, string> = {
  sales: 'Faktury sprzedaży',
  proforma: 'Proformy',
};

/**
 * Synchronizuje faktury z Betterfly do SharePoint (dedup po numerze, upsert).
 * Sprzedaż i proformy: pobiera PDF z Betterfly i archiwizuje w bibliotece kontekstu
 * (Kategoria/Rok/Miesiąc). Dokument już zarchiwizowany (link SharePoint) jest pomijany,
 * chyba że force = true. Koszty: tylko dane, bo Betterfly nie daje dla nich pliku.
 * Sygnatura zgodna z syncFromInfakt, żeby UI był wspólny.
 */
export async function syncFromBetterfly(
  type: 'sales' | 'cost' | 'proforma',
  context: string,
  _existing: Invoice[],
  onProgress?: (done: number, total: number, archived: number) => void,
  force = false,
): Promise<{ ok: number; archived: number; total: number }> {
  // Dedup względem ŚWIEŻEJ listy z SharePoint (nie stanu UI) — chroni przed duplikatami
  const [fromBf, existing] = await Promise.all([fetchBetterfly(type), getInvoices(type, context)]);
  const category = ARCHIVE_CATEGORY[type];
  let ok = 0, archived = 0;

  for (let i = 0; i < fromBf.length; i++) {
    const inv = fromBf[i];
    const previewUrl = inv.fileUrl;
    const match = existing.find(x => x.number && inv.number && x.number.trim().toLowerCase() === inv.number.trim().toLowerCase());
    if (match) {
      inv.spId = match.spId;
      inv.attachments = match.attachments;
      if (match.fileUrl) inv.fileUrl = match.fileUrl;
    }

    const alreadyArchived = isArchived(match?.fileUrl) && !force;
    // Ręcznie wgrany dokument (inny niż nasz link podglądu) też zostawiamy w spokoju
    const manualDoc = !!match?.fileUrl && !isArchived(match.fileUrl) && !match.fileUrl.startsWith('/api/betterfly-pdf');
    if (category && previewUrl && !alreadyArchived && !manualDoc) {
      try {
        const res = await fetch(previewUrl);
        if (res.ok) {
          const buf = await res.arrayBuffer();
          const baseName = (inv.number || `dokument-${inv.sourceId || i}`).replace(/[\\/:*?"<>|]/g, '-');
          const sp = await uploadDocument(context, category, inv.issueDate, `${baseName}.pdf`, buf);
          inv.fileUrl = sp;
          const label = type === 'proforma' ? 'Proforma (oryginał)' : 'Faktura (oryginał)';
          // zastąp wpis oryginału, zachowaj ewentualne ręcznie dodane załączniki
          const others = (match?.attachments || []).filter(a => a.url !== match?.fileUrl && !a.url.startsWith('/api/betterfly-pdf'));
          inv.attachments = [{ name: label, url: sp }, ...others];
          archived++;
        }
      } catch { /* PDF nieudany — zostaje link podglądu, spróbujemy przy kolejnej synchronizacji */ }
    }

    await saveInvoice(inv, context);
    ok++;
    onProgress?.(i + 1, fromBf.length, archived);
  }

  return { ok, archived, total: fromBf.length };
}
