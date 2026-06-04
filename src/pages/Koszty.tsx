import { useState } from 'react';
import { Ico } from '../components/ui/icons';

function fmt(n: number) {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const MONTHS = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];

const MONTHLY = [
  { m: 'sty', value: 68400 }, { m: 'lut', value: 71200 }, { m: 'mar', value: 75800 },
  { m: 'kwi', value: 69300 }, { m: 'maj', value: 82300 }, { m: 'cze', value: 77600 },
];

const CATEGORIES = [
  { name: 'Paliwo',           amount: 18400, pct: 22.4 },
  { name: 'Wynajem',          amount: 16200, pct: 19.7 },
  { name: 'IT/Oprogramowanie',amount: 12800, pct: 15.6 },
  { name: 'Usługi',           amount: 14600, pct: 17.7 },
  { name: 'Telekomunikacja',  amount: 6800,  pct: 8.3 },
  { name: 'Inne',             amount: 13500, pct: 16.4 },
];

const maxMonthly = Math.max(...MONTHLY.map(m => m.value));
const maxCat = Math.max(...CATEGORIES.map(c => c.amount));

export default function Koszty() {
  const [month, setMonth] = useState('5');
  const [year, setYear] = useState('2026');

  const currentMonth = MONTHLY[parseInt(month)];
  const prevMonth = MONTHLY[parseInt(month) - 1] ?? MONTHLY[0];
  const totalCosts = CATEGORIES.reduce((s, c) => s + c.amount, 0);
  const biggestCat = CATEGORIES.reduce((a, b) => a.amount > b.amount ? a : b);
  const monthDiff = currentMonth ? ((currentMonth.value - prevMonth.value) / prevMonth.value * 100).toFixed(1) : '0';
  const monthDir = parseFloat(monthDiff) <= 0 ? 'up' : 'down';

  return (
    <div className="page-content">
      <div className="page-head">
        <div>
          <h1 className="page-h">Analiza kosztów</h1>
          <p className="page-sub">Zestawienie i struktura wydatków firmowych</p>
        </div>
        <div className="page-actions">
          <select value={month} onChange={e => setMonth(e.target.value)} style={{ fontSize: '0.85rem' }}>
            {MONTHS.map((m, i) => <option key={i} value={String(i)}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(e.target.value)} style={{ fontSize: '0.85rem' }}>
            {['2024', '2025', '2026'].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn btn-secondary"><Ico name="Download" size={15} /> Eksportuj</button>
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: '1.5rem' }}>
        <div className="kpi" style={{ background: 'var(--navy-900)', color: '#fff' }}>
          <div className="label" style={{ color: 'rgba(255,255,255,0.6)' }}>Koszty łącznie</div>
          <div className="value" style={{ color: '#fff', fontSize: '1.5rem' }}>{fmt(totalCosts)} <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>PLN</span></div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', marginTop: '0.25rem' }}>{MONTHS[parseInt(month)]} {year}</div>
        </div>
        <div className="kpi">
          <div className="label"><span className="ico"><Ico name="BarChart" size={15} /></span>Największa kategoria</div>
          <div className="value">{biggestCat.name}</div>
          <div className="delta">{fmt(biggestCat.amount)} PLN · {biggestCat.pct}%</div>
        </div>
        <div className="kpi">
          <div className="label"><span className="ico"><Ico name="TrendDown" size={15} /></span>Ten miesiąc vs poprzedni</div>
          <div className="value">{currentMonth ? fmt(currentMonth.value) : '—'} <span className="unit">PLN</span></div>
          <div className="delta" data-dir={monthDir}>
            <Ico name={monthDir === 'up' ? 'TrendUp' : 'TrendDown'} size={14} />
            {monthDiff}% vs. poprzedni miesiąc
          </div>
        </div>
        <div className="kpi">
          <div className="label"><span className="ico"><Ico name="Percent" size={15} /></span>Kategorie aktywne</div>
          <div className="value">{CATEGORIES.length}</div>
          <div className="delta">w bieżącym okresie</div>
        </div>
      </div>

      <div className="split-2-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
        <div className="card">
          <div className="card-head"><span>Koszty miesięczne (6 mies.)</span></div>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: '140px', padding: '0 0.5rem' }}>
              {MONTHLY.map((m, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                    {Math.round(m.value / 1000)}k
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: `${(m.value / maxMonthly) * 100}%`,
                      background: i === parseInt(month) ? 'var(--navy-900)' : 'var(--navy-200, #c5d0e8)',
                      borderRadius: '3px 3px 0 0',
                      transition: 'height 0.3s',
                    }}
                  />
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{m.m}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><span>Struktura kosztów</span></div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              {CATEGORIES.map((c, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', fontSize: '0.82rem' }}>
                    <span>{c.name}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{c.pct}%</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${c.pct}%`, height: '100%', background: 'var(--navy-600, #3b5ea6)', borderRadius: 3, transition: 'width 0.3s' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><span>Zestawienie kategorii kosztowych</span></div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Kategoria</th>
                  <th style={{ textAlign: 'right' }}>Kwota (PLN)</th>
                  <th style={{ textAlign: 'right' }}>% udział</th>
                  <th style={{ width: '200px' }}>Udział graficzny</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map((c, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{c.name}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmt(c.amount)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{c.pct}%</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${(c.amount / maxCat) * 100}%`, height: '100%', background: 'var(--navy-600, #3b5ea6)', borderRadius: 4 }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                  <td>Suma</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{fmt(totalCosts)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>100%</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
