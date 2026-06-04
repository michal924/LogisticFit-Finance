import { useState } from 'react';
import { Ico } from '../components/ui/icons';

function fmt(n: number) {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const MONTHS_PL = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];

const REPORT_DATA = [
  { month: 'Styczeń 2026',   revenue: 98400,  costs: 68400,  result: 30000,  vatDue: 14200 },
  { month: 'Luty 2026',      revenue: 104200, costs: 71200,  result: 33000,  vatDue: 15300 },
  { month: 'Marzec 2026',    revenue: 112600, costs: 75800,  result: 36800,  vatDue: 16400 },
  { month: 'Kwiecień 2026',  revenue: 109800, costs: 69300,  result: 40500,  vatDue: 18200 },
  { month: 'Maj 2026',       revenue: 128400, costs: 82300,  result: 46100,  vatDue: 19600 },
  { month: 'Czerwiec 2026',  revenue: 118700, costs: 77600,  result: 41100,  vatDue: 17800 },
];

export default function Raporty() {
  const [selMonth, setSelMonth] = useState('5');
  const [selYear, setSelYear] = useState('2026');

  const current = REPORT_DATA[parseInt(selMonth)];
  const prev = REPORT_DATA[parseInt(selMonth) - 1] ?? REPORT_DATA[0];
  const vatNaliczony = current ? Math.round(current.costs * 0.23) : 0;

  return (
    <div className="page-content">
      <div className="page-head">
        <div>
          <h1 className="page-h">Raporty finansowe</h1>
          <p className="page-sub">Zestawienie przychodów, kosztów i zobowiązań VAT</p>
        </div>
        <div className="page-actions">
          <select value={selMonth} onChange={e => setSelMonth(e.target.value)} style={{ fontSize: '0.85rem' }}>
            {MONTHS_PL.map((m, i) => <option key={i} value={String(i)}>{m}</option>)}
          </select>
          <select value={selYear} onChange={e => setSelYear(e.target.value)} style={{ fontSize: '0.85rem' }}>
            {['2024', '2025', '2026'].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn btn-primary"><Ico name="Download" size={15} /> Eksportuj PDF</button>
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <div className="kpi">
          <div className="label"><span className="ico"><Ico name="TrendUp" size={15} /></span>Przychody</div>
          <div className="value" style={{ color: 'var(--green-600)' }}>{current ? fmt(current.revenue) : '—'} <span className="unit">PLN</span></div>
          {current && prev && (
            <div className="delta" data-dir={current.revenue >= prev.revenue ? 'up' : 'down'}>
              <Ico name={current.revenue >= prev.revenue ? 'TrendUp' : 'TrendDown'} size={14} />
              {((current.revenue - prev.revenue) / prev.revenue * 100).toFixed(1)}% vs. poprz. mies.
            </div>
          )}
        </div>
        <div className="kpi">
          <div className="label"><span className="ico"><Ico name="TrendDown" size={15} /></span>Koszty</div>
          <div className="value" style={{ color: 'var(--red, #e53e3e)' }}>{current ? fmt(current.costs) : '—'} <span className="unit">PLN</span></div>
          {current && prev && (
            <div className="delta" data-dir={current.costs <= prev.costs ? 'up' : 'down'}>
              <Ico name={current.costs <= prev.costs ? 'TrendUp' : 'TrendDown'} size={14} />
              {((current.costs - prev.costs) / prev.costs * 100).toFixed(1)}% vs. poprz. mies.
            </div>
          )}
        </div>
        <div className="kpi" style={{ background: 'var(--navy-900)', color: '#fff' }}>
          <div className="label" style={{ color: 'rgba(255,255,255,0.6)' }}>Wynik netto</div>
          <div className="value" style={{ color: '#fff', fontSize: '1.35rem' }}>{current ? fmt(current.result) : '—'} <span style={{ fontSize: '0.82rem', opacity: 0.7 }}>PLN</span></div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.2rem' }}>marża {current ? ((current.result / current.revenue) * 100).toFixed(1) : '—'}%</div>
        </div>
        <div className="kpi">
          <div className="label"><span className="ico"><Ico name="Receipt" size={15} /></span>VAT należny</div>
          <div className="value">{current ? fmt(current.vatDue) : '—'} <span className="unit">PLN</span></div>
          <div className="delta">do zapłaty</div>
        </div>
        <div className="kpi">
          <div className="label"><span className="ico"><Ico name="Coins" size={15} /></span>VAT naliczony</div>
          <div className="value">{fmt(vatNaliczony)} <span className="unit">PLN</span></div>
          <div className="delta">do odliczenia</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><span>Historia miesięczna</span></div>
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
                </tr>
              </thead>
              <tbody>
                {REPORT_DATA.map((r, i) => {
                  const margin = (r.result / r.revenue * 100).toFixed(1);
                  return (
                    <tr key={i} style={i === parseInt(selMonth) ? { background: 'var(--navy-50, #f0f4fb)' } : {}}>
                      <td style={{ fontWeight: i === parseInt(selMonth) ? 600 : 400 }}>{r.month}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--green-600)', fontWeight: 600 }}>{fmt(r.revenue)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--red, #e53e3e)' }}>{fmt(r.costs)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{fmt(r.result)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{margin}%</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmt(r.vatDue)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                  <td>Suma YTD</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--green-600)' }}>{fmt(REPORT_DATA.reduce((s, r) => s + r.revenue, 0))}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--red, #e53e3e)' }}>{fmt(REPORT_DATA.reduce((s, r) => s + r.costs, 0))}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmt(REPORT_DATA.reduce((s, r) => s + r.result, 0))}</td>
                  <td></td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmt(REPORT_DATA.reduce((s, r) => s + r.vatDue, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
