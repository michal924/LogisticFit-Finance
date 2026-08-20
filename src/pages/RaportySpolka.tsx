import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Ico } from '../components/ui/icons';
import type { Invoice } from '../types';
import { getInvoices } from '../services/invoiceService';
import { loadTransactions, annotatePayments, type Txn } from '../services/paymentMatch';

function fmt(n: number) {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
const MONTHS_PL = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
const MONTH_SHORT = ['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','lis','gru'];

// Raporty dla SPÓŁKI — dane z Comarch Betterfly (faktury) + bank ING (transakcje).
// Betterfly nie udostępnia CIT/JPK/PIT/ZUS, więc to podsumowanie zarządcze, nie oficjalne deklaracje.
export default function RaportySpolka() {
  const { context } = useOutletContext<{ lang: any; query: string; context: string }>();
  const now = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth());
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Invoice[]>([]);
  const [costs, setCosts] = useState<Invoice[]>([]);
  const [proformas, setProformas] = useState<Invoice[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    setLoading(true); setErr('');
    Promise.all([getInvoices('sales', context), getInvoices('cost', context), getInvoices('proforma', context), loadTransactions(context)])
      .then(([s, c, pf, t]) => {
        setSales(s); setCosts(c); setTxns(t);
        setProformas(annotatePayments(pf, t));   // oznacz opłacone proformy wg przelewów
      })
      .catch(e => setErr(e.message || 'Błąd pobierania danych'))
      .finally(() => setLoading(false));
  }, [context]);

  // Opłacone proformy, które NIE mają jeszcze odpowiadającej faktury sprzedaży
  // (dopasowanie po kwocie brutto + pierwszym członie nazwy kontrahenta).
  const awaitingInvoice = useMemo(() => {
    const cpKey = (s: string) => (s || '').toLowerCase().split(' ')[0];
    return proformas.filter(p => p.paid).filter(p =>
      !sales.some(s => Math.abs(s.grossTotal - p.grossTotal) < 0.02 && cpKey(s.counterparty) === cpKey(p.counterparty)));
  }, [proformas, sales]);
  const awaitingSum = awaitingInvoice.reduce((s, p) => s + p.grossTotal, 0);

  const selKey = `${selYear}-${String(selMonth + 1).padStart(2, '0')}`;
  const sumBy = (arr: Invoice[], key: string, field: 'netTotal' | 'vatTotal') =>
    arr.filter(x => (x.issueDate || '').startsWith(key)).reduce((s, x) => s + (x[field] || 0), 0);

  // KPI wybrany miesiąc
  const income = sumBy(sales, selKey, 'netTotal');
  const expenses = sumBy(costs, selKey, 'netTotal');
  const profit = income - expenses;
  const vatNal = sumBy(sales, selKey, 'vatTotal');
  const vatNacz = sumBy(costs, selKey, 'vatTotal');
  const vatDue = vatNal - vatNacz;

  // Tabele roczne
  const rows = useMemo(() => {
    const out = [];
    for (let m = 0; m < 12; m++) {
      const key = `${selYear}-${String(m + 1).padStart(2, '0')}`;
      const inc = sumBy(sales, key, 'netTotal');
      const exp = sumBy(costs, key, 'netTotal');
      const vn = sumBy(sales, key, 'vatTotal');
      const vz = sumBy(costs, key, 'vatTotal');
      const bankIn = txns.filter(t => t.date.startsWith(key) && t.amount > 0).reduce((s, t) => s + t.amount, 0);
      const bankOut = txns.filter(t => t.date.startsWith(key) && t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
      out.push({ key, label: MONTH_SHORT[m], inc, exp, profit: inc - exp, vn, vz, vatDue: vn - vz, bankIn, bankOut,
        has: inc !== 0 || exp !== 0 || bankIn !== 0 || bankOut !== 0 });
    }
    return out;
  }, [sales, costs, txns, selYear]);

  const hasYearData = rows.some(r => r.has);
  const sum = rows.reduce((a, r) => ({
    inc: a.inc + r.inc, exp: a.exp + r.exp, profit: a.profit + r.profit,
    vn: a.vn + r.vn, vz: a.vz + r.vz, vatDue: a.vatDue + r.vatDue,
    bankIn: a.bankIn + r.bankIn, bankOut: a.bankOut + r.bankOut,
  }), { inc: 0, exp: 0, profit: 0, vn: 0, vz: 0, vatDue: 0, bankIn: 0, bankOut: 0 });

  const yearOpts = Array.from(new Set([...sales, ...costs].map(i => (i.issueDate || '').slice(0, 4)).filter(Boolean).concat(String(now.getFullYear()))))
    .sort((a, b) => b.localeCompare(a));

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Raporty finansowe</h1>
          <p className="page-sub">Podsumowanie zarządcze Spółki · Comarch Betterfly + bank ING</p>
        </div>
        <div className="page-actions">
          <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))} style={{ fontSize: '0.85rem' }}>
            {MONTHS_PL.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={selYear} onChange={e => setSelYear(Number(e.target.value))} style={{ fontSize: '0.85rem' }}>
            {yearOpts.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div style={{ background: 'var(--lf-navy-100)', border: '1px solid var(--lf-navy-200, #c7d0ec)', borderRadius: 8, padding: '9px 14px', fontSize: 13, color: 'var(--lf-navy-700)', marginBottom: 16 }}>
        <Ico name="AlertTriangle" size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
        Dane z <strong>Comarch Betterfly</strong> (faktury) i banku <strong>ING</strong>. To podsumowanie zarządcze — oficjalne deklaracje CIT/JPK/VAT rozliczasz w Betterfly/u księgowej.
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240, flexDirection: 'column', gap: 12 }}>
          <div className="spinner" /><span style={{ color: 'var(--fg-3)', fontSize: 14 }}>Ładowanie…</span>
        </div>
      ) : err ? (
        <div style={{ background: 'var(--lf-danger-bg)', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', fontSize: 14, color: 'var(--lf-danger)' }}>{err}</div>
      ) : !hasYearData ? (
        <div style={{ background: 'var(--lf-warning-bg)', border: '1px solid #f0e0b8', borderRadius: 8, padding: '9px 14px', fontSize: 13, color: 'var(--lf-warning)' }}>
          <Ico name="AlertTriangle" size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
          Brak danych za {selYear}. Zsynchronizuj faktury z Comarch Betterfly i zaimportuj wyciąg ING.
        </div>
      ) : (
        <>
          {/* KPI */}
          <div className="grid" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
            <div className="kpi">
              <div className="label"><span className="ico"><Ico name="TrendUp" size={15} /></span>Przychód</div>
              <div className="value" style={{ color: 'var(--lf-green)' }}>{fmt(income)} <span className="unit">PLN</span></div>
              <div className="delta">netto · {MONTHS_PL[selMonth]}</div>
            </div>
            <div className="kpi">
              <div className="label"><span className="ico"><Ico name="TrendDown" size={15} /></span>Koszty</div>
              <div className="value" style={{ color: 'var(--lf-danger)' }}>{fmt(expenses)} <span className="unit">PLN</span></div>
              <div className="delta">netto · {MONTHS_PL[selMonth]}</div>
            </div>
            <div className="kpi" style={{ background: 'var(--lf-navy-900)', color: '#fff' }}>
              <div className="label" style={{ color: 'rgba(255,255,255,0.6)' }}>Wynik</div>
              <div className="value" style={{ color: profit < 0 ? '#ff9b9b' : '#fff', fontSize: '1.25rem' }}>{fmt(profit)} <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>PLN</span></div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.2rem' }}>marża {income > 0 ? (profit / income * 100).toFixed(1) : '—'}%</div>
            </div>
            <div className="kpi">
              <div className="label"><span className="ico"><Ico name="Receipt" size={15} /></span>VAT należny</div>
              <div className="value">{fmt(vatNal)} <span className="unit">PLN</span></div>
              <div className="delta">ze sprzedaży</div>
            </div>
            <div className="kpi">
              <div className="label"><span className="ico"><Ico name="Receipt" size={15} /></span>VAT naliczony</div>
              <div className="value">{fmt(vatNacz)} <span className="unit">PLN</span></div>
              <div className="delta">z kosztów</div>
            </div>
            <div className="kpi">
              <div className="label"><span className="ico"><Ico name="Coins" size={15} /></span>{vatDue >= 0 ? 'VAT do zapłaty' : 'VAT do zwrotu/przen.'}</div>
              <div className="value" style={{ color: vatDue > 0 ? 'var(--lf-danger)' : 'var(--lf-green)' }}>{fmt(Math.abs(vatDue))} <span className="unit">PLN</span></div>
              <div className="delta">{vatDue >= 0 ? 'należny − naliczony' : 'nadwyżka naliczonego'}</div>
            </div>
          </div>

          {/* Opłacone proformy oczekujące na fakturę */}
          {awaitingInvoice.length > 0 && (
            <div className="card" style={{ marginBottom: '1.5rem', borderColor: '#e3d9f5' }}>
              <div className="card-head">
                <span><Ico name="AlertTriangle" size={14} style={{ verticalAlign: '-2px', marginRight: 6, color: '#8b6fc8' }} />Opłacone proformy oczekujące na fakturę</span>
                <span style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 400 }}>pieniądze wpłynęły, faktura sprzedaży jeszcze niewystawiona</span>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr>
                      <th>Proforma</th><th>Kontrahent</th>
                      <th style={{ textAlign: 'right' }}>Brutto</th>
                      <th style={{ textAlign: 'right' }}>Zapłata (bank)</th>
                    </tr></thead>
                    <tbody>
                      {awaitingInvoice.map(p => (
                        <tr key={p.spId || p.number}>
                          <td style={{ fontWeight: 600 }}>{p.number}</td>
                          <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.counterparty || '—'}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmt(p.grossTotal)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#239d46' }}>{p.matchedDate || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ fontWeight: 700, borderTop: '2px solid var(--lf-slate-200)' }}>
                        <td colSpan={2}>Razem ({awaitingInvoice.length})</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmt(awaitingSum)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SEKCJA 1: Wynik finansowy */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-head"><span>Wynik finansowy · {selYear}</span><span style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 400 }}>netto z faktur Betterfly</span></div>
            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr>
                    <th>Miesiąc</th>
                    <th style={{ textAlign: 'right' }}>Przychód</th>
                    <th style={{ textAlign: 'right' }}>Koszty</th>
                    <th style={{ textAlign: 'right' }}>Wynik</th>
                    <th style={{ textAlign: 'right' }}>Marża</th>
                  </tr></thead>
                  <tbody>
                    {rows.map(r => {
                      const sel = r.key === selKey;
                      return (
                        <tr key={r.key} style={sel ? { background: 'var(--lf-navy-50)' } : {}}>
                          <td style={{ fontWeight: sel ? 600 : 400 }}>{r.label}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--lf-green)', fontWeight: 600 }}>{r.has ? fmt(r.inc) : '—'}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--lf-danger)' }}>{r.has ? fmt(r.exp) : '—'}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{r.has ? fmt(r.profit) : '—'}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{r.has && r.inc > 0 ? (r.profit / r.inc * 100).toFixed(0) + '%' : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700, borderTop: '2px solid var(--lf-slate-200)' }}>
                      <td>Suma {selYear}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--lf-green)' }}>{fmt(sum.inc)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--lf-danger)' }}>{fmt(sum.exp)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmt(sum.profit)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* SEKCJA 2: VAT */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-head"><span>VAT · {selYear}</span><span style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 400 }}>orientacyjnie z faktur (nie deklaracja JPK)</span></div>
            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr>
                    <th>Miesiąc</th>
                    <th style={{ textAlign: 'right' }}>VAT należny</th>
                    <th style={{ textAlign: 'right' }}>VAT naliczony</th>
                    <th style={{ textAlign: 'right' }}>Saldo VAT (± zapłata/zwrot)</th>
                  </tr></thead>
                  <tbody>
                    {rows.map(r => {
                      const sel = r.key === selKey;
                      return (
                        <tr key={r.key} style={sel ? { background: 'var(--lf-navy-50)' } : {}}>
                          <td style={{ fontWeight: sel ? 600 : 400 }}>{r.label}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{r.has ? fmt(r.vn) : '—'}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{r.has ? fmt(r.vz) : '—'}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: r.vatDue > 0 ? 'var(--lf-danger)' : 'var(--lf-green)' }}>{r.has ? fmt(r.vatDue) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700, borderTop: '2px solid var(--lf-slate-200)' }}>
                      <td>Suma {selYear}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmt(sum.vn)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{fmt(sum.vz)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmt(sum.vatDue)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* SEKCJA 3: Przepływy bankowe ING */}
          <div className="card">
            <div className="card-head"><span>Przepływy bankowe · ING · {selYear}</span><span style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 400 }}>z zaimportowanych wyciągów</span></div>
            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr>
                    <th>Miesiąc</th>
                    <th style={{ textAlign: 'right' }}>Wpływy</th>
                    <th style={{ textAlign: 'right' }}>Wydatki</th>
                    <th style={{ textAlign: 'right' }}>Przepływ netto</th>
                  </tr></thead>
                  <tbody>
                    {rows.map(r => {
                      const sel = r.key === selKey;
                      const net = r.bankIn - r.bankOut;
                      const any = r.bankIn !== 0 || r.bankOut !== 0;
                      return (
                        <tr key={r.key} style={sel ? { background: 'var(--lf-navy-50)' } : {}}>
                          <td style={{ fontWeight: sel ? 600 : 400 }}>{r.label}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--lf-green)' }}>{any ? fmt(r.bankIn) : '—'}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--lf-danger)' }}>{any ? fmt(r.bankOut) : '—'}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: net < 0 ? 'var(--lf-danger)' : 'var(--fg-1)' }}>{any ? fmt(net) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700, borderTop: '2px solid var(--lf-slate-200)' }}>
                      <td>Suma {selYear}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--lf-green)' }}>{fmt(sum.bankIn)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--lf-danger)' }}>{fmt(sum.bankOut)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmt(sum.bankIn - sum.bankOut)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--fg-3)' }}>
            <Ico name="ShieldCheck" size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />
            Wynik i VAT liczone z faktur Comarch Betterfly (netto/VAT). Przepływy z wyciągów ING. To nie są oficjalne deklaracje podatkowe.
          </div>
        </>
      )}
    </div>
  );
}
