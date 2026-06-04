import { useState, useEffect } from 'react';
import { Ico } from '../components/ui/icons';
import { getInvoices } from '../services/invoiceService';
import type { Invoice } from '../types';

function fmt(n: number) {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const MONTHS = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
const MONTH_SHORT = ['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','lis','gru'];

export default function Koszty() {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth()));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getInvoices('cost')
      .then(data => setInvoices(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Last 6 months
  const monthlyData: { m: string; value: number; key: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(parseInt(year), parseInt(month) - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = MONTH_SHORT[d.getMonth()];
    const value = invoices
      .filter(inv => inv.issueDate?.startsWith(key))
      .reduce((s, inv) => s + (inv.netTotal || 0), 0);
    monthlyData.push({ m: label, value, key });
  }

  const selectedKey = `${year}-${String(parseInt(month) + 1).padStart(2, '0')}`;
  const selectedMonthInvoices = invoices.filter(inv => inv.issueDate?.startsWith(selectedKey));
  const totalCosts = selectedMonthInvoices.reduce((s, inv) => s + (inv.netTotal || 0), 0);

  // Group by counterparty as proxy for category
  const catMap = new Map<string, number>();
  selectedMonthInvoices.forEach(inv => {
    const key = inv.counterparty || 'Inne';
    catMap.set(key, (catMap.get(key) || 0) + (inv.netTotal || 0));
  });
  const categories = Array.from(catMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, amount]) => ({
      name,
      amount,
      pct: totalCosts > 0 ? parseFloat(((amount / totalCosts) * 100).toFixed(1)) : 0,
    }));

  // If no invoices for selected month, show categories from all invoices
  const allCatMap = new Map<string, number>();
  invoices.forEach(inv => {
    const key = inv.counterparty || 'Inne';
    allCatMap.set(key, (allCatMap.get(key) || 0) + (inv.netTotal || 0));
  });
  const allCategories = Array.from(allCatMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, amount]) => {
      const total = invoices.reduce((s, inv) => s + (inv.netTotal || 0), 0);
      return {
        name,
        amount,
        pct: total > 0 ? parseFloat(((amount / total) * 100).toFixed(1)) : 0,
      };
    });

  const displayCategories = categories.length > 0 ? categories : allCategories;
  const displayTotal = categories.length > 0 ? totalCosts : invoices.reduce((s, inv) => s + (inv.netTotal || 0), 0);
  const biggestCat = displayCategories[0] ?? { name: '—', amount: 0, pct: 0 };

  const maxMonthly = Math.max(...monthlyData.map(m => m.value), 1);
  const maxCat = Math.max(...displayCategories.map(c => c.amount), 1);

  const currentMonthValue = monthlyData[5]?.value ?? 0;
  const prevMonthValue = monthlyData[4]?.value ?? 0;
  const monthDiff = prevMonthValue > 0
    ? ((currentMonthValue - prevMonthValue) / prevMonthValue * 100).toFixed(1)
    : '0';
  const monthDir = parseFloat(monthDiff) <= 0 ? 'up' : 'down';

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, flexDirection: 'column', gap: 12 }}>
        <div className="spinner" />
        <span style={{ color: 'var(--fg-3)', fontSize: 14 }}>Ładowanie kosztów…</span>
      </div>
    );
  }

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Analiza kosztów</h1>
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
        <div className="kpi" style={{ background: 'var(--lf-navy-900)', color: '#fff' }}>
          <div className="label" style={{ color: 'rgba(255,255,255,0.6)' }}>Koszty łącznie</div>
          <div className="value" style={{ color: '#fff', fontSize: '1.5rem' }}>{fmt(displayTotal)} <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>PLN</span></div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', marginTop: '0.25rem' }}>{MONTHS[parseInt(month)]} {year}</div>
        </div>
        <div className="kpi">
          <div className="label"><span className="ico"><Ico name="BarChart" size={15} /></span>Największy kontrahent</div>
          <div className="value" style={{ fontSize: '0.95rem' }}>{biggestCat.name}</div>
          <div className="delta">{fmt(biggestCat.amount)} PLN · {biggestCat.pct}%</div>
        </div>
        <div className="kpi">
          <div className="label"><span className="ico"><Ico name="TrendDown" size={15} /></span>Ten miesiąc vs poprzedni</div>
          <div className="value">{fmt(currentMonthValue)} <span className="unit">PLN</span></div>
          <div className="delta" data-dir={monthDir}>
            <Ico name={monthDir === 'up' ? 'TrendUp' : 'TrendDown'} size={14} />
            {monthDiff}% vs. poprzedni miesiąc
          </div>
        </div>
        <div className="kpi">
          <div className="label"><span className="ico"><Ico name="Percent" size={15} /></span>Kontrahenci aktywni</div>
          <div className="value">{displayCategories.length}</div>
          <div className="delta">w bieżącym okresie</div>
        </div>
      </div>

      <div className="split-2-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
        <div className="card">
          <div className="card-head"><span>Koszty miesięczne (6 mies.)</span></div>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: '140px', padding: '0 0.5rem' }}>
              {monthlyData.map((m, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                    {m.value > 0 ? `${Math.round(m.value / 1000)}k` : '0'}
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: `${(m.value / maxMonthly) * 100}%`,
                      minHeight: m.value > 0 ? 2 : 0,
                      background: i === 5 ? 'var(--lf-navy-900)' : 'var(--navy-200, #c5d0e8)',
                      borderRadius: '3px 3px 0 0',
                      transition: 'height 0.3s',
                    }}
                  />
                  <div style={{ fontSize: '0.72rem', color: 'var(--fg-3)' }}>{m.m}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><span>Struktura kosztów</span></div>
          <div className="card-body">
            {displayCategories.length === 0 ? (
              <div style={{ color: 'var(--fg-3)', fontSize: 13 }}>Brak danych dla wybranego okresu</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                {displayCategories.map((c, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', fontSize: '0.82rem' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>{c.name}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{c.pct}%</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${c.pct}%`, height: '100%', background: 'var(--navy-600, #3b5ea6)', borderRadius: 3, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                  <th>Kontrahent / Kategoria</th>
                  <th style={{ textAlign: 'right' }}>Kwota (PLN)</th>
                  <th style={{ textAlign: 'right' }}>% udział</th>
                  <th style={{ width: '200px' }}>Udział graficzny</th>
                </tr>
              </thead>
              <tbody>
                {displayCategories.length === 0 && (
                  <tr><td colSpan={4} className="empty">Brak danych dla wybranego okresu</td></tr>
                )}
                {displayCategories.map((c, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{c.name}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmt(c.amount)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{c.pct}%</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${(c.amount / maxCat) * 100}%`, height: '100%', background: 'var(--navy-600, #3b5ea6)', borderRadius: 4 }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
                {displayCategories.length > 0 && (
                  <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                    <td>Suma</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{fmt(displayTotal)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>100%</td>
                    <td></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
