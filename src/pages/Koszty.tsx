import { useState, useEffect, Fragment } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Ico } from '../components/ui/icons';
import { getInvoices } from '../services/invoiceService';
import type { Invoice } from '../types';

function fmt(n: number) {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmt2(n: number) {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const MONTHS = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
const MONTH_SHORT = ['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','lis','gru'];

type Doc = { name: string; url: string };
type CatItem = { number: string; issueDate: string; counterparty: string; net: number; gross: number; paid: boolean; docs: Doc[] };
type Cat = { name: string; amount: number; gross: number; pct: number; count: number; items: CatItem[] };

function docsOf(inv: any): Doc[] {
  if (inv.attachments?.length) return inv.attachments;
  if (inv.fileUrl) return [{ name: 'Dokument (oryginał)', url: inv.fileUrl }];
  return [];
}

function buildCats(list: Invoice[]): Cat[] {
  const totalNet = list.reduce((s, i) => s + (i.netTotal || 0), 0);
  const map = new Map<string, Cat>();
  list.forEach(inv => {
    const name = (inv.category || '').trim() || 'Bez kategorii';
    let c = map.get(name);
    if (!c) { c = { name, amount: 0, gross: 0, pct: 0, count: 0, items: [] }; map.set(name, c); }
    c.amount += inv.netTotal || 0;
    c.gross += inv.grossTotal || 0;
    c.count += 1;
    c.items.push({ number: inv.number, issueDate: inv.issueDate, counterparty: inv.counterparty, net: inv.netTotal || 0, gross: inv.grossTotal || 0, paid: !!inv.paid, docs: docsOf(inv) });
  });
  const cats = Array.from(map.values());
  cats.forEach(c => { c.pct = totalNet > 0 ? parseFloat(((c.amount / totalNet) * 100).toFixed(1)) : 0; c.items.sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || '')); });
  cats.sort((a, b) => b.amount - a.amount);
  return cats;
}

export default function Koszty() {
  const { context } = useOutletContext<{ context: string }>();
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth()));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setExpanded(null);
    getInvoices('cost', context)
      .then(data => setInvoices(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [context]);

  // Wykres 6 miesięcy (netto)
  const monthlyData: { m: string; value: number; key: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(parseInt(year), parseInt(month) - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const value = invoices.filter(inv => inv.issueDate?.startsWith(key)).reduce((s, inv) => s + (inv.netTotal || 0), 0);
    monthlyData.push({ m: MONTH_SHORT[d.getMonth()], value, key });
  }

  const selectedKey = `${year}-${String(parseInt(month) + 1).padStart(2, '0')}`;
  const monthInvoices = invoices.filter(inv => inv.issueDate?.startsWith(selectedKey));
  const useMonth = monthInvoices.length > 0;
  const list = useMonth ? monthInvoices : invoices;
  const cats = buildCats(list);
  const displayTotal = list.reduce((s, inv) => s + (inv.netTotal || 0), 0);
  const biggestCat = cats[0] ?? { name: '—', amount: 0, pct: 0 } as Cat;

  const maxMonthly = Math.max(...monthlyData.map(m => m.value), 1);
  const maxCat = Math.max(...cats.map(c => c.amount), 1);
  const currentMonthValue = monthlyData[5]?.value ?? 0;
  const prevMonthValue = monthlyData[4]?.value ?? 0;
  const monthDiff = prevMonthValue > 0 ? ((currentMonthValue - prevMonthValue) / prevMonthValue * 100).toFixed(1) : '0';
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
          <p className="page-sub">Struktura wydatków wg kategorii{useMonth ? '' : ' · całość (brak danych za wybrany miesiąc)'}</p>
        </div>
        <div className="page-actions">
          <select value={month} onChange={e => setMonth(e.target.value)} style={{ fontSize: '0.85rem' }}>
            {MONTHS.map((m, i) => <option key={i} value={String(i)}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(e.target.value)} style={{ fontSize: '0.85rem' }}>
            {['2024', '2025', '2026'].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: '1.5rem' }}>
        <div className="kpi" style={{ background: 'var(--lf-navy-900)', color: '#fff' }}>
          <div className="label" style={{ color: 'rgba(255,255,255,0.6)' }}>Koszty łącznie (netto)</div>
          <div className="value" style={{ color: '#fff', fontSize: '1.5rem' }}>{fmt(displayTotal)} <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>PLN</span></div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', marginTop: '0.25rem' }}>{useMonth ? `${MONTHS[parseInt(month)]} ${year}` : 'całość'}</div>
        </div>
        <div className="kpi">
          <div className="label"><span className="ico"><Ico name="PieChart" size={15} /></span>Największa kategoria</div>
          <div className="value" style={{ fontSize: '0.95rem' }}>{biggestCat.name}</div>
          <div className="delta">{fmt(biggestCat.amount)} PLN · {biggestCat.pct}%</div>
        </div>
        <div className="kpi">
          <div className="label"><span className="ico"><Ico name="TrendDown" size={15} /></span>Ten miesiąc vs poprzedni</div>
          <div className="value">{fmt(currentMonthValue)} <span className="unit">PLN</span></div>
          <div className="delta" data-dir={monthDir}>
            <Ico name={monthDir === 'up' ? 'TrendDown' : 'TrendUp'} size={14} />
            {monthDiff}% vs. poprzedni
          </div>
        </div>
        <div className="kpi">
          <div className="label"><span className="ico"><Ico name="Receipt" size={15} /></span>Kategorie</div>
          <div className="value">{cats.length}</div>
          <div className="delta">{list.length} faktur</div>
        </div>
      </div>

      <div className="split-2-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
        <div className="card">
          <div className="card-head"><span>Koszty miesięczne (6 mies.)</span></div>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: '140px', padding: '0 0.5rem' }}>
              {monthlyData.map((m, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{m.value > 0 ? `${Math.round(m.value / 1000)}k` : '0'}</div>
                  <div style={{ width: '100%', height: `${(m.value / maxMonthly) * 100}%`, minHeight: m.value > 0 ? 2 : 0, background: i === 5 ? 'var(--lf-navy-900)' : 'var(--navy-200, #c5d0e8)', borderRadius: '3px 3px 0 0', transition: 'height 0.3s' }} />
                  <div style={{ fontSize: '0.72rem', color: 'var(--fg-3)' }}>{m.m}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><span>Struktura kosztów (top kategorie)</span></div>
          <div className="card-body">
            {cats.length === 0 ? (
              <div style={{ color: 'var(--fg-3)', fontSize: 13 }}>Brak danych dla wybranego okresu</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                {cats.slice(0, 6).map((c, i) => (
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
        <div className="card-head"><span>Kategorie kosztów {useMonth ? `· ${MONTHS[parseInt(month)]} ${year}` : '· całość'}</span><span style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 400 }}>kliknij kategorię, by zobaczyć faktury i dokumenty</span></div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Kategoria</th>
                  <th style={{ textAlign: 'center' }}>Faktury</th>
                  <th style={{ textAlign: 'right' }}>Netto (PLN)</th>
                  <th style={{ textAlign: 'right' }}>% udział</th>
                  <th style={{ width: '180px' }}>Udział</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cats.length === 0 && (
                  <tr><td colSpan={6} className="empty">Brak danych dla wybranego okresu</td></tr>
                )}
                {cats.map(c => {
                  const open = expanded === c.name;
                  return (
                    <Fragment key={c.name}>
                      <tr onClick={() => setExpanded(open ? null : c.name)} style={{ cursor: 'pointer', background: open ? 'var(--lf-navy-50, #f0f4ff)' : undefined }}>
                        <td style={{ fontWeight: 500 }}>{c.name}</td>
                        <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{c.count}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmt(c.amount)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{c.pct}%</td>
                        <td>
                          <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${(c.amount / maxCat) * 100}%`, height: '100%', background: 'var(--navy-600, #3b5ea6)', borderRadius: 4 }} />
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <Ico name="ChevronRight" size={16} style={{ color: 'var(--fg-3)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
                        </td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={6} style={{ padding: 0, background: '#f9fafd', borderBottom: '2px solid var(--accent)' }}>
                            <div style={{ padding: '12px 20px' }}>
                              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                                {c.items.map((it, i) => (
                                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px', borderTop: i ? '1px solid var(--border)' : 'none', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--accent)', minWidth: 110 }}>{it.number || '—'}</span>
                                    <span style={{ fontSize: 12, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{it.issueDate}</span>
                                    <span style={{ fontSize: 13, flex: 1, minWidth: 140 }}>{it.counterparty || '—'}</span>
                                    <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmt2(it.gross)} PLN</span>
                                    <span className="badge" style={{ background: it.paid ? 'var(--lf-green-100, #e0f3e6)' : 'var(--lf-warning-bg, #fffbf0)', color: it.paid ? 'var(--lf-green-700)' : 'var(--lf-warning)', flexShrink: 0 }}>{it.paid ? 'Opłacona' : 'Oczekuje'}</span>
                                    <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                      {it.docs.length === 0 ? (
                                        <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>brak dok.</span>
                                      ) : it.docs.map((d, di) => (
                                        <a key={di} href={d.url} target="_blank" rel="noreferrer" title={d.name}
                                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 7, border: '1px solid var(--lf-navy-200, #c7d0ec)', background: 'var(--lf-navy-50, #f0f4ff)', color: 'var(--accent)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                                          <Ico name="FileText" size={13} /> {it.docs.length > 1 ? di + 1 : 'Dokument'}
                                        </a>
                                      ))}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {cats.length > 0 && (
                  <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                    <td>Suma</td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{list.length}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmt(displayTotal)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>100%</td>
                    <td></td><td></td>
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
