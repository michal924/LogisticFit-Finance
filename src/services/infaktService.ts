import type { Invoice } from '../types';

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
  const nip = (pick(raw, 'client_nip', 'nip', 'client_tax_code', 'seller_nip') || '').toString();
  const statusRaw = (pick(raw, 'status', 'payment_status') || '').toString().toLowerCase();
  const paid = statusRaw.includes('paid') || statusRaw === 'opłacona' || !!pick(raw, 'paid_date');

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
  };
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
    if (items.length < 50) break; // ostatnia strona
    page++;
  }
  return all;
}
