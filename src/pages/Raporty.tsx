import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Ico } from '../components/ui/icons';
import { getInvoices } from '../services/invoiceService';
import { fetchTax } from '../services/infaktService';
import type { Invoice } from '../types';

function fmt(n: number) {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function gr(v: any): number {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return isNaN(n) ? 0 : Math.round(n) / 100;
}

const MONTHS_PL = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
const MONTH_SHORT = ['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','lis','gru'];

function StatusBadge({ status }: { status: string }) {
  const paid = status === 'paid';
  const map: Record<string, { t: string; c: string; bg: string }> = {
    paid: { t: 'Zapłacone', c: 'var(--lf-green-700)', bg: 'var(--lf-green-100)' },
    draft: { t: 'Szkic', c: 'var(--lf-warning)', bg: 'var(--lf-warning-bg)' },
    sent: { t: 'Wysłane', c: 'var(--lf-navy)', bg: 'var(--lf-navy-100)' },
  };
  const s = map[status] || { t: status || '—', c: 'var(--fg-3)', bg: 'var(--lf-slate-100)' };
  return <span className="badge" style={{ background: s.bg, color: s.c, fontWeight: 600 }}>{paid ? '✓ ' : ''}{s.t}</span>;
}

export default function Raporty() {
  const { context } = useOutletContext<{ lang: any; query: string; context: string }>();
  const now = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth());
  const [selYear, setSelYear] = useState(now.getFullYear());

  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Invoice[]>([]);
  const [costs, setCosts] = useState<Invoice[]>([]);
  const [jpk, setJpk] = useState<any[]>([]);
  const [pit, setPit] = useState<any[]>([]);
  const [taxErr, setTaxErr] = useState('');

  useEffect(() => {
    setLoading(true); setTaxErr('');
    Promise.all([getInvoices('sales', context), getInvoices('cost', context)])
      .then(([s, c]) => { setSales(s); setCosts(c); })
      .catch(console.error)
      .finally(() => setLoading(false));
    // Dane podatkowe z inFakt (całe konto, nie per-context)
    Promise.all([fetchTax('saf_v7'), fetchTax('income')])
      .then(([j, p]) => { setJpk(j); setPit(p); })
      .catch(e => setTaxErr(e.message || 'Błąd pobierania danych z inFakt'));
  }, [context]);

  // Miesięczne zestawienie z naszych faktur (12 miesięcy wstecz)
  const monthly = useMemo(() => {
    const rows: { key: string; label: string; revenue: number; costsv: number; result: number; vatDue: number; vatIn: number; vatPay: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${MONTH_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
      const sIn = sales.filter(x => x.issueDate?.startsWith(key));
      const cIn = costs.filter(x => x.issueDate?.startsWith(key));
      const revenue = sIn.reduce((s, x) => s + (x.netTotal || 0), 0);
      const costsv = cIn.reduce((s, x) => s + (x.netTotal || 0), 0);
      const vatDue = sIn.reduce((s, x) => s + (x.vatTotal || 0), 0);
      const vatIn = cIn.reduce((s, x) => s + (x.vatTotal || 0), 0);
      rows.push({ key, label, revenue, costsv, result: revenue - costsv, vatDue, vatIn, vatPay: vatDue - vatIn });
    }
    return rows;
  }, [sales, costs, now.getMonth(), now.getFullYear()]);

  // KPI dla wybranego miesiąca
  const selKey = `${selYear}-${String(selMonth + 1).padStart(2, '0')}`;
  const cur = monthly.find(m => m.key === selKey);
  const prevIdx = monthly.findIndex(m => m.key === selKey) - 1;
  const prev = prevIdx >= 0 ? monthly[prevIdx] : undefined;

  const ytd = monthly.filter(m => m.key.startsWith(String(selYear)));
  const ytdSum = ytd.reduce((a, m) => ({
    revenue: a.revenue + m.revenue, costsv: a.costsv + m.costsv, result: a.result + m.result,
    vatDue: a.vatDue + m.vatDue, vatIn: a.vatIn + m.vatIn, vatPay: a.vatPay + m.vatPay,
  }), { revenue: 0, costsv: 0, result: 0, vatDue: 0, vatIn: 0, vatPay: 0 });

  const deltaPct = (a: number, b: number) => b !== 0 ? ((a - b) / Math.abs(b) * 100) : 0;

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Raporty finansowe</h1>
          <p className="page-sub">Przychody, koszty i VAT z faktur · rozliczenia JPK/PIT z inFakt</p>
        </div>
        <div className="page-actions">
          <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))} style={{ fontSize: '0.85rem' }}>
            {MONTHS_PL.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={selYear} onChange={e => setSelYear(Number(e.target.value))} style={{ fontSize: '0.85rem' }}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240, flexDirection: 'column', gap: 12 }}>
          <div className="spinner" /><span style={{ color: 'var(--fg-3)', fontSize: 14 }}>Ładowanie…</span>
        </div>
      ) : (
        <>
          {/* KPI z faktur (per działalność, wybrany miesiąc) */}
          <div className="grid cols-4" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(5, 1fr)' }}>
            <div className="kpi">
              <div className="label"><span className="ico"><Ico name="TrendUp" size={15} /></span>Przychody</div>
              <div className="value" style={{ color: 'var(--lf-green)' }}>{fmt(cur?.revenue || 0)} <span className="unit">PLN</span></div>
              {cur && prev && prev.revenue > 0 && (
                <div className="delta" data-dir={cur.revenue >= prev.revenue ? 'up' : 'down'}>
                  <Ico name={cur.revenue >= prev.revenue ? 'TrendUp' : 'TrendDown'} size={14} />
                  {deltaPct(cur.revenue, prev.revenue).toFixed(1)}% vs. poprz.
                </div>
              )}
            </div>
            <div className="kpi">
              <div className="label"><span className="ico"><Ico name="TrendDown" size={15} /></span>Koszty</div>
              <div className="value" style={{ color: 'var(--lf-danger)' }}>{fmt(cur?.costsv || 0)} <span className="unit">PLN</span></div>
              {cur && prev && prev.costsv > 0 && (
                <div className="delta" data-dir={cur.costsv <= prev.costsv ? 'up' : 'down'}>
                  <Ico name={cur.costsv <= prev.costsv ? 'TrendDown' : 'TrendUp'} size={14} />
                  {deltaPct(cur.costsv, prev.costsv).toFixed(1)}% vs. poprz.
                </div>
              )}
            </div>
            <div className="kpi" style={{ background: 'var(--lf-navy-900)', color: '#fff' }}>
              <div className="label" style={{ color: 'rgba(255,255,255,0.6)' }}>Wynik netto</div>
              <div className="value" style={{ color: '#fff', fontSize: '1.35rem' }}>{fmt(cur?.result || 0)} <span style={{ fontSize: '0.82rem', opacity: 0.7 }}>PLN</span></div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.2rem' }}>marża {cur && cur.revenue > 0 ? (cur.result / cur.revenue * 100).toFixed(1) : '—'}%</div>
            </div>
            <div className="kpi">
              <div className="label"><span className="ico"><Ico name="Receipt" size={15} /></span>VAT należny</div>
              <div className="value">{fmt(cur?.vatDue || 0)} <span className="unit">PLN</span></div>
              <div className="delta">ze sprzedaży</div>
            </div>
            <div className="kpi">
              <div className="label"><span className="ico"><Ico name="Coins" size={15} /></span>VAT do zapłaty</div>
              <div className="value" style={{ color: (cur?.vatPay || 0) > 0 ? 'var(--lf-danger)' : 'var(--lf-green)' }}>{fmt(cur?.vatPay || 0)} <span className="unit">PLN</span></div>
              <div className="delta">należny − naliczony ({fmt(cur?.vatIn || 0)})</div>
            </div>
          </div>

          {/* Historia miesięczna z faktur */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-head"><span>Historia miesięczna · {context === 'spolka' ? 'Spółka' : context === 'prywatne' ? 'Prywatne' : 'JDG'} (z faktur)</span></div>
            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Miesiąc</th>
                      <th style={{ textAlign: 'right' }}>Przychody</th>
                      <th style={{ textAlign: 'right' }}>Koszty</th>
                      <th style={{ textAlign: 'right' }}>Wynik</th>
                      <th style={{ textAlign: 'right' }}>Marża</th>
                      <th style={{ textAlign: 'right' }}>VAT należny</th>
                      <th style={{ textAlign: 'right' }}>VAT naliczony</th>
                      <th style={{ textAlign: 'right' }}>VAT do zapłaty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.map((r) => {
                      const sel = r.key === selKey;
                      return (
                        <tr key={r.key} style={sel ? { background: 'var(--lf-navy-50)' } : {}}>
                          <td style={{ fontWeight: sel ? 600 : 400 }}>{r.label}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--lf-green)', fontWeight: 600 }}>{fmt(r.revenue)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--lf-danger)' }}>{fmt(r.costsv)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{fmt(r.result)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{r.revenue > 0 ? (r.result / r.revenue * 100).toFixed(0) : '—'}%</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmt(r.vatDue)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{fmt(r.vatIn)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmt(r.vatPay)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700, borderTop: '2px solid var(--lf-slate-200)' }}>
                      <td>Suma {selYear}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--lf-green)' }}>{fmt(ytdSum.revenue)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--lf-danger)' }}>{fmt(ytdSum.costsv)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmt(ytdSum.result)}</td>
                      <td></td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmt(ytdSum.vatDue)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmt(ytdSum.vatIn)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmt(ytdSum.vatPay)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* JPK_V7 + PIT z inFakt */}
          <div className="grid split-2-1">
            <div className="card">
              <div className="card-head">
                <span>JPK_V7 (deklaracje VAT)</span>
                <span style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 400 }}>źródło: inFakt</span>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                {taxErr ? (
                  <div style={{ padding: '1rem 1.25rem', color: 'var(--lf-danger)', fontSize: 13 }}>{taxErr}</div>
                ) : jpk.length === 0 ? (
                  <div style={{ padding: '1rem 1.25rem', color: 'var(--fg-3)', fontSize: 13 }}>Brak deklaracji</div>
                ) : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead><tr>
                        <th>Okres</th><th>Status</th>
                        <th style={{ textAlign: 'right' }}>VAT do zapłaty</th><th style={{ textAlign: 'right' }}>Termin</th>
                      </tr></thead>
                      <tbody>
                        {jpk.slice(0, 14).map((j) => (
                          <tr key={j.id}>
                            <td>{j.period_name}{j.correction_counter > 0 ? '' : ''} <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{j.symbol}</span></td>
                            <td><StatusBadge status={j.status} /></td>
                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmt(gr(j.tax_to_pay_price))}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', fontSize: 12 }}>{j.payment_date || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <span>Zaliczki PIT</span>
                <span style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 400 }}>źródło: inFakt</span>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                {taxErr ? (
                  <div style={{ padding: '1rem 1.25rem', color: 'var(--lf-danger)', fontSize: 13 }}>{taxErr}</div>
                ) : pit.length === 0 ? (
                  <div style={{ padding: '1rem 1.25rem', color: 'var(--fg-3)', fontSize: 13 }}>Brak danych</div>
                ) : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead><tr>
                        <th>Okres</th><th style={{ textAlign: 'right' }}>Zaliczka</th><th>Status</th>
                      </tr></thead>
                      <tbody>
                        {pit.slice(0, 10).map((p) => (
                          <tr key={p.id}>
                            <td>{p.period_name} <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{p.symbol}</span></td>
                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmt(gr(p.to_pay_price))}</td>
                            <td><StatusBadge status={p.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--fg-3)' }}>
            <Ico name="AlertTriangle" size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />
            Dane JPK/PIT pochodzą z konta inFakt (całość rozliczenia) i nie zależą od wybranej działalności.
            Pliki XML JPK pobierzesz w panelu inFakt.
          </div>
        </>
      )}
    </div>
  );
}
