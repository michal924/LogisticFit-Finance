import type { Invoice } from '../types';
import { uploadDocument } from './graphService';
import { saveInvoice } from './invoiceService';

// inFakt zwraca kwoty w GROSZACH (1/100 PLN) — konwersja
function gr(v: any): number {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return isNaN(n) ? 0 : Math.round(n) / 100;
}

function pick(obj: any, ...keys: string[]): any {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return undefined;
}

// Mapuje rekord inFakt → nasz Invoice
function mapInfakt(raw: any, type: 'sales' | 'cost'): Invoice {
  const number = pick(raw, 'number', 'fullnumber', 'document_number') || '';
  const issueDate = (pick(raw, 'invoice_date', 'issue_date', 'date', 'created_at') || '').toString().split('T')[0];
  const dueDate = (pick(raw, 'payment_date', 'due_date', 'payment_due_date') || '').toString().split('T')[0];
  const counterparty = pick(raw, 'client_company_name', 'client_name', 'seller_name', 'contractor_name', 'company_name') || '';
  const nip = (pick(raw, 'client_nip', 'nip', 'client_tax_code', 'seller_tax_code', 'seller_nip') || '').toString();
  // Status płatności — faktury: pole `status`/`paid_date`; koszty: tablica `statuses` (group=payment)
  const statusRaw = (pick(raw, 'status', 'payment_status') || '').toString().toLowerCase();
  let paid = statusRaw === 'paid' || statusRaw === 'opłacona' || !!pick(raw, 'paid_date');
  if (Array.isArray(raw.statuses)) {
    const payment = raw.statuses.find((s: any) => s && s.group === 'payment');
    if (payment) paid = payment.symbol === 'paid';
  }

  // Link do dokumentu w inFakt — przez nasz backend (server-side). Faktury: PDF generowany; koszty: skan z S3.
  // Faktury używają id (do PDF) i uuid (do załączników); koszty uuid.
  const rawId = pick(raw, 'id', 'uuid');
  const rawUuid = pick(raw, 'uuid', 'id');
  const docId = type === 'cost' ? rawUuid : rawId;
  const fileUrl = docId ? `/api/infakt-pdf?type=${type}&id=${encodeURIComponent(docId)}` : '';

  return {
    type,
    number: String(number),
    issueDate,
    dueDate: dueDate || issueDate,
    counterparty: String(counterparty),
    nip,
    lines: [],
    netTotal: gr(pick(raw, 'net_price', 'net_total', 'net_amount')),
    vatTotal: gr(pick(raw, 'tax_price', 'vat_total', 'tax_amount', 'vat_amount')),
    grossTotal: gr(pick(raw, 'gross_price', 'gross_total', 'gross_amount')),
    currency: pick(raw, 'currency') || 'PLN',
    paid,
    notes: pick(raw, 'ksef_number') ? `KSeF: ${raw.ksef_number}` : '',
    ...(type === 'cost' ? { category: pick(raw, 'category', 'category_name', 'kind') || '' } : {}),
    fileUrl,
    infaktId: rawId ? String(rawId) : undefined,
    infaktUuid: rawUuid ? String(rawUuid) : undefined,
  };
}

// Pobiera dane podatkowe z inFakt (JPK_V7 / PIT / VAT-UE) — surowe rekordy.
// Kwoty w groszach (÷100). Dane dotyczą całego konta inFakt (nie per-context).
export async function fetchTax(type: 'saf_v7' | 'income' | 'vat_eu' | 'books' | 'insurance'): Promise<any[]> {
  const res = await fetch(`/api/infakt-tax?type=${type}&page=1`);
  if (!res.ok) {
    let msg = 'Błąd pobierania danych podatkowych z inFakt';
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  const data = await res.json();
  return data.items || [];
}

// Pobiera szczegół jednego rekordu podatkowego (np. KPiR books/{id} z pełnymi pozycjami i danymi firmy)
export async function fetchTaxDetail(type: 'saf_v7' | 'income' | 'books' | 'insurance', id: string | number): Promise<any> {
  const res = await fetch(`/api/infakt-tax?type=${type}&id=${encodeURIComponent(id)}`);
  if (!res.ok) {
    let msg = 'Błąd pobierania szczegółu z inFakt';
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  const data = await res.json();
  return data.item;
}

// Pobiera wszystkie strony danego typu z inFakt (przez backend)
export async function fetchInfakt(type: 'sales' | 'cost'): Promise<Invoice[]> {
  const endpoint = type === 'sales' ? 'invoices' : 'costs';
  const all: Invoice[] = [];
  let page = 1;
  const maxPages = 50; // bezpiecznik

  while (page <= maxPages) {
    const res = await fetch(`/api/infakt-sync?type=${endpoint}&page=${page}`);
    if (!res.ok) {
      let msg = 'Błąd pobierania z inFakt';
      try { msg = (await res.json()).error || msg; } catch {}
      throw new Error(msg);
    }
    const data = await res.json();
    const items: any[] = data.items || [];
    if (!items.length) break;
    for (const raw of items) all.push(mapInfakt(raw, type));
    if (items.length < 100) break; // ostatnia strona (limit=100)
    page++;
  }
  return all;
}

function isArchived(url?: string): boolean {
  return !!url && /sharepoint\.com/i.test(url);
}

/**
 * Lekki auto-sync DANYCH (bez archiwizacji PDF). Zapisuje tylko nowe/zmienione faktury.
 * Używany przy starcie aplikacji — szybkie odświeżenie statusów z inFakt.
 * @returns liczba zaktualizowanych/dodanych faktur
 */
export async function autoSyncData(type: 'sales' | 'cost', context: string, existing: Invoice[]): Promise<number> {
  const fromInfakt = await fetchInfakt(type);
  let changed = 0;
  for (const inv of fromInfakt) {
    const match = existing.find(x => x.number && inv.number && x.number.trim().toLowerCase() === inv.number.trim().toLowerCase());
    if (match) {
      inv.spId = match.spId;
      inv.fileUrl = match.fileUrl;          // zachowaj link do archiwum (nie ruszamy PDF)
      inv.attachments = match.attachments;  // zachowaj listę dokumentów
      // Pomiń jeśli nic się nie zmieniło (status + kwoty + kategoria)
      if (match.paid === inv.paid && match.grossTotal === inv.grossTotal && match.netTotal === inv.netTotal && (match.category || '') === (inv.category || '')) continue;
    }
    try { await saveInvoice(inv, context); changed++; } catch { /* pojedynczy błąd — pomijamy */ }
  }
  return changed;
}

/**
 * Synchronizuje faktury z inFakt + archiwizuje dokumenty do SharePoint.
 * - Dedup po numerze (upsert).
 * - Archiwizacja: pobiera dokument z inFakt → wgrywa do biblioteki SharePoint → fileUrl wskazuje kopię.
 * - BEZ DUPLIKATÓW: jeśli dokument już w SharePoint (fileUrl=...sharepoint...), pomija pobranie.
 */
export async function syncFromInfakt(
  type: 'sales' | 'cost',
  context: string,
  existing: Invoice[],
  onProgress?: (done: number, total: number, archived: number) => void,
  force = false,   // true = pełna re-archiwizacja (ignoruje "już zarchiwizowane", dociąga załączniki)
): Promise<{ ok: number; archived: number; total: number }> {
  const fromInfakt = await fetchInfakt(type);
  const category = type === 'sales' ? 'Faktury sprzedaży' : 'Faktury kosztowe';
  let ok = 0, archived = 0;

  for (let i = 0; i < fromInfakt.length; i++) {
    const inv = fromInfakt[i];
    const match = existing.find(x => x.number && inv.number && x.number.trim().toLowerCase() === inv.number.trim().toLowerCase());
    if (match) inv.spId = match.spId;

    // Już zarchiwizowane wcześniej? → zachowaj kopię SharePoint, pomiń (chyba że force = pełna re-archiwizacja)
    if (!force && isArchived(match?.fileUrl)) {
      inv.fileUrl = match!.fileUrl;
      inv.attachments = match!.attachments;
    } else if (inv.infaktId || inv.infaktUuid) {
      // Pobierz MANIFEST wszystkich dokumentów (główny + załączniki) i zarchiwizuj każdy
      try {
        const mres = await fetch(`/api/infakt-manifest?type=${type}&id=${encodeURIComponent(inv.infaktId || '')}&uuid=${encodeURIComponent(inv.infaktUuid || '')}`);
        const manifest = mres.ok ? await mres.json() : { documents: [] };
        const docs: { name: string; url: string }[] = manifest.documents || [];
        const baseName = (inv.number || `dokument-${i}`).replace(/[\\/:*?"<>|]/g, '-');
        let firstUrl = '';
        const archivedDocs: { name: string; url: string }[] = [];
        for (let di = 0; di < docs.length; di++) {
          try {
            const dres = await fetch(docs[di].url);
            if (!dres.ok) continue;
            const buf = await dres.arrayBuffer();
            // nazwa: numer faktury + (sufiks dla kolejnych załączników)
            const ext = (docs[di].name.split('.').pop() || 'pdf').toLowerCase();
            const label = di === 0 ? 'Faktura (oryginał)' : `Załącznik ${di}`;
            const fname = di === 0 ? `${baseName}.${ext}` : `${baseName}_zal${di}_${docs[di].name}`;
            const sp = await uploadDocument(context, category, inv.issueDate, fname, buf);
            if (di === 0) firstUrl = sp;
            archivedDocs.push({ name: label, url: sp });
            archived++;
          } catch { /* pojedynczy dokument nieudany — pomijamy */ }
        }
        inv.fileUrl = firstUrl;
        inv.attachments = archivedDocs;
      } catch {
        inv.fileUrl = '';
      }
    }

    await saveInvoice(inv, context);
    ok++;
    onProgress?.(i + 1, fromInfakt.length, archived);
  }

  return { ok, archived, total: fromInfakt.length };
}
