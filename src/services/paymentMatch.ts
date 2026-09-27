import type { Invoice } from '../types';
import { TransactionsService, filterByContext } from './graphService';

// ============================================================
//  Dopasowanie faktura ↔ przelew bankowy (auto-oznaczanie zapłaty).
//  Liczone NA ŻYWO z transakcji banku — nic nie zapisujemy do SharePoint,
//  więc kolejny sync z Betterfly nie nadpisze wyniku.
//  Reguła: numer dokumentu w tytule przelewu + poprawny kierunek
//  (sprzedaż/proforma → wpływ, koszt → wydatek). Fallback: kwota brutto + kontrahent.
// ============================================================

export type Txn = { date: string; title: string; amount: number };

function norm(s: string): string {
  return (s || '').toLowerCase().replace(/\s+/g, '');
}

// Czy `needle` występuje w `hay` jako odrębny token (bez cyfry tuż przed/po) —
// żeby numer "1/09/2026" NIE łapał się w "21/09/2026" czy "11/09/2026".
function tokenIncludes(hay: string, needle: string): boolean {
  let i = hay.indexOf(needle);
  while (i !== -1) {
    const before = i > 0 ? hay[i - 1] : '';
    const after = i + needle.length < hay.length ? hay[i + needle.length] : '';
    if (!/[0-9]/.test(before) && !/[0-9]/.test(after)) return true;
    i = hay.indexOf(needle, i + 1);
  }
  return false;
}

// Pobiera i normalizuje transakcje bankowe danego kontekstu
export async function loadTransactions(context: string): Promise<Txn[]> {
  const raw = await TransactionsService.getAll();
  return filterByContext(raw, context).map((it: any) => {
    const f = it.fields || {};
    return {
      date: (f.TransactionDate || '').split('T')[0],
      title: f.Description || '',
      amount: typeof f.Amount === 'number' ? f.Amount : parseFloat(f.Amount || '0') || 0,
    };
  });
}

/**
 * Oznacza dokumenty jako opłacone, jeśli znaleziono pasujący przelew.
 * Mutuje i zwraca tę samą tablicę (ustawia paid=true, matchedTxn, matchedDate).
 * NIGDY nie odznacza — dokument opłacony wg Betterfly zostaje opłacony.
 */
export function annotatePayments(docs: Invoice[], txns: Txn[]): Invoice[] {
  const ntx = txns.map(t => ({ ...t, ntitle: norm(t.title), abs: Math.abs(t.amount) }));

  for (const d of docs) {
    const num = norm(d.number);
    if (num.length < 4 || !d.grossTotal) continue;
    const wantIn = d.type !== 'cost';   // sprzedaż/proforma → wpływ; koszt → wydatek
    const dirOk = (t: typeof ntx[number]) => wantIn ? t.amount > 0 : t.amount < 0;
    // kwota przelewu musi się zgadzać z brutto — chroni przed fałszywym trafieniem
    // po samym numerze (numery typu "1/09/2026" bywają datami w innych przelewach)
    const amtOk = (t: typeof ntx[number]) => Math.abs(t.abs - d.grossTotal) < 0.02;

    // 1) numer dokumentu (jako token) + kwota brutto + kierunek
    let cand = ntx.filter(t => dirOk(t) && amtOk(t) && tokenIncludes(t.ntitle, num));

    // 2) fallback: kwota brutto + kierunek + pierwszy człon nazwy kontrahenta
    if (!cand.length) {
      const cp = norm((d.counterparty || '').split(' ')[0]);
      cand = ntx.filter(t => dirOk(t) && amtOk(t) && cp.length >= 3 && t.ntitle.includes(cp));
    }

    if (cand.length) {
      // najbliższa kwota, potem najwcześniejsza data
      cand.sort((a, b) =>
        Math.abs(a.abs - d.grossTotal) - Math.abs(b.abs - d.grossTotal) ||
        (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      const m = cand[0];
      d.paid = true;
      d.matchedTxn = m.title;
      d.matchedDate = m.date;
    }
  }
  return docs;
}
