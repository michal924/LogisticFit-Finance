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
    if (num.length < 4) continue;
    const wantIn = d.type !== 'cost';   // sprzedaż/proforma → wpływ; koszt → wydatek

    // 1) numer dokumentu w tytule przelewu + poprawny kierunek
    let cand = ntx.filter(t => (wantIn ? t.amount > 0 : t.amount < 0) && t.ntitle.includes(num));

    // 2) fallback: dokładna kwota brutto + kierunek + pierwszy człon nazwy kontrahenta
    if (!cand.length && d.grossTotal) {
      const cp = norm((d.counterparty || '').split(' ')[0]);
      cand = ntx.filter(t =>
        (wantIn ? t.amount > 0 : t.amount < 0) &&
        Math.abs(t.abs - d.grossTotal) < 0.02 &&
        cp.length >= 3 && t.ntitle.includes(cp));
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
