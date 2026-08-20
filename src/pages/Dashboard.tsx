import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { Ico } from '../components/ui/icons';
import type { Lang } from '../i18n';
import { makeT } from '../i18n';
import { getInvoices } from '../services/invoiceService';
import { annotatePayments } from '../services/paymentMatch';
import { TransactionsService, filterByContext } from '../services/graphService';
import type { Invoice } from '../types';

function fmt(n: number) {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtK(n: number) {
  if (Math.abs(n) >= 1000) return (n / 1000).toLocaleString('pl-PL', { maximumFractionDigits: 0 }) + ' tys.';
  return n.toLocaleString('pl-PL', { maximumFractionDigits: 0 });
}

// Paleta z tokenów marki
const C = {
  navy: '#3a4d98', green: '#239d46', amber: '#d28a17', danger: '#c8362d',
  slate: '#8a92ad', grid: '#e1e4ee', ink: '#0e1430',
};
const PIE_COLORS = ['#3a4d98', '#239d46', '#d28a17', '#c8362d', '#7a89c4', '#7ec99a', '#6b7392', '#1b7d37', '#c2c7d6'];

function KpiCard({ label, icon, value, unit, delta, dir, valueColor }: {
  label: string; icon: string; value: string; unit?: string; delta?: string; dir?: 'up' | 'down'; valueColor?: string;
}) {
  return (
    <div className="kpi">
      <div className="label"><span className="ico"><Ico name={icon} size={15} /></span>{label}</div>
      <div className="value" style={valueColor ? { color: valueColor } : undefined}>{value}{unit && <span className="unit"> {unit}</span>}</div>
      {delta && (
        <div className="delta" data-dir={dir}>
          <Ico name={dir === 'up' ? 'TrendUp' : 'TrendDown'} size={14} />
          {delta} <span className="vs">vs. poprz. mies.</span>
        </div>
      )}
    </div>
  );
}

const MONTH_SHORT = ['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','lis','gru'];

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid var(--lf-slate-200)', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 16px rgba(14,20,48,.12)', fontSize: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: C.ink }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--fg-2)' }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: p.color, display: 'inline-block' }} />
          {p.name}: <strong style={{ fontFamily: 'var(--font-mono)', color: C.ink }}>{fmt(p.value)} zł</strong>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { lang, context } = useOutletContext<{ lang: Lang; query: string; context: string }>();
  const t = makeT(lang);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const months = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];

  const [loading, setLoading] = useState(true);
  const [salesInvoices, setSalesInvoices] = useState<Invoice[]>([]);
  const [costInvoices, setCostInvoices] = useState<Invoice[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getInvoices('sales', context),
      getInvoices('cost', context),
      TransactionsService.getAll(),
    ])
      .then(([sales, costs, txns]) => {
        const ctxTxns = filterByContext(txns, context);
        // auto-oznaczanie zapłaty wg przelewów (należności/zobowiązania odzwierciedlają bank)
        const norm = ctxTxns.map((it: any) => ({
          date: (it.fields?.TransactionDate || '').split('T')[0],
          title: it.fields?.Description || '',
          amount: typeof it.fields?.Amount === 'number' ? it.fields.Amount : parseFloat(it.fields?.Amount || '0') || 0,
        }));
        setSalesInvoices(annotatePayments(sales, norm));
        setCostInvoices(annotatePayments(costs, norm));
        setTransactions(ctxTxns);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [context]);

  // KPI dla wybranego miesiąca
  const monthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const revenue = salesInvoices.filter(i => i.issueDate?.startsWith(monthStr)).reduce((s, i) => s + (i.netTotal || 0), 0);
  const costs = costInvoices.filter(i => i.issueDate?.startsWith(monthStr)).reduce((s, i) => s + (i.netTotal || 0), 0);
  const result = revenue - costs;

  // Poprzedni miesiąc (delta)
  const prevD = new Date(selectedYear, selectedMonth - 2, 1);
  const prevStr = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, '0')}`;
  const prevRevenue = salesInvoices.filter(i => i.issueDate?.startsWith(prevStr)).reduce((s, i) => s + (i.netTotal || 0), 0);
  const revDeltaPct = prevRevenue > 0 ? Math.round((revenue - prevRevenue) / prevRevenue * 100) : null;

  // Saldo banku
  const sortedTxns = [...transactions].sort((a, b) => (b.fields?.TransactionDate || '').localeCompare(a.fields?.TransactionDate || ''));
  const bankBalance = sortedTxns[0]?.fields?.Balance ?? 0;
  const latestTxnDate = sortedTxns[0]?.fields?.TransactionDate?.split('T')[0] ?? '';

  // Należności / zobowiązania
  const today = new Date().toISOString().split('T')[0];
  const receivables = salesInvoices.filter(i => !i.paid).reduce((s, i) => s + (i.grossTotal || 0), 0);
  const recvOverdue = salesInvoices.filter(i => !i.paid && i.dueDate < today).reduce((s, i) => s + (i.grossTotal || 0), 0);
  const payables = costInvoices.filter(i => !i.paid).reduce((s, i) => s + (i.grossTotal || 0), 0);
  const payOverdue = costInvoices.filter(i => !i.paid && i.dueDate < today).reduce((s, i) => s + (i.grossTotal || 0), 0);
  const vatDue = costInvoices.filter(i => !i.paid).reduce((s, i) => s + (i.vatTotal || 0), 0);

  // Wykres: przychody vs koszty + wynik (ostatnie 12 miesięcy, netto)
  const monthly: { m: string; przychody: number; koszty: number; wynik: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${MONTH_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
    const r = salesInvoices.filter(inv => inv.issueDate?.startsWith(key)).reduce((s, inv) => s + (inv.netTotal || 0), 0);
    const c = costInvoices.filter(inv => inv.issueDate?.startsWith(key)).reduce((s, inv) => s + (inv.netTotal || 0), 0);
    monthly.push({ m: label, przychody: Math.round(r), koszty: Math.round(c), wynik: Math.round(r - c) });
  }

  // Wykres: struktura kosztów wg kategorii (wybrany rok, netto)
  const catMap = new Map<string, number>();
  costInvoices.filter(i => i.issueDate?.startsWith(String(selectedYear))).forEach(i => {
    const key = i.category?.trim() || 'Bez kategorii';
    catMap.set(key, (catMap.get(key) || 0) + (i.netTotal || 0));
  });
  const catData = Array.from(catMap.entries())
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value);
  const catTotal = catData.reduce((s, c) => s + c.value, 0);

  // Top kontrahenci (sprzedaż)
  const contractorMap = new Map<string, number>();
  salesInvoices.forEach(i => contractorMap.set(i.counterparty || 'Nieznany', (contractorMap.get(i.counterparty || 'Nieznany') || 0) + (i.grossTotal || 0)));
  const topC = Array.from(contractorMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, value]) => ({ name, nip: salesInvoices.find(i => i.counterparty === name)?.nip || '—', value }));

  // Aktywność
  const activityItems: { icon: string; tone: string; text: string; val: string; ts: string; date: string }[] = [];
  salesInvoices.slice(0, 5).forEach(i => activityItems.push({
    icon: i.paid ? 'CheckCircle' : 'FileText', tone: i.paid ? 'success' : 'info',
    text: i.paid ? 'Opłacona faktura sprzedaży' : 'Nowa faktura sprzedaży', val: i.number, ts: i.issueDate, date: i.issueDate,
  }));
  costInvoices.slice(0, 5).forEach(i => {
    const overdue = !i.paid && i.dueDate < today;
    activityItems.push({
      icon: overdue ? 'AlertTriangle' : 'FileText', tone: overdue ? 'danger' : 'info',
      text: overdue ? 'Przeterminowana faktura kosztowa' : 'Nowa faktura kosztowa', val: i.number, ts: i.issueDate, date: i.issueDate,
    });
  });
  const activity = activityItems.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, flexDirection: 'column', gap: 12 }}>
        <div className="spinner" />
        <span style={{ color: 'var(--fg-3)', fontSize: 14 }}>Ładowanie danych…</span>
      </div>
    );
  }

  return (
    <div>
      <div className="page-h">
        <div><h1>{t('dash.title')}</h1><div className="page-sub">{t('dash.sub')}</div></div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <select className="select" value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
          {months.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <select className="select" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <KpiCard icon="TrendUp" label={t('dash.revenue')} value={fmt(revenue)} unit="PLN"
          delta={revDeltaPct !== null ? `${revDeltaPct >= 0 ? '+' : ''}${revDeltaPct}%` : undefined} dir={revDeltaPct !== null && revDeltaPct < 0 ? 'down' : 'up'} />
        <KpiCard icon="Receipt" label={t('dash.costs')} value={fmt(costs)} unit="PLN" />
        <KpiCard icon="Coins" label={t('dash.result')} value={fmt(result)} unit="PLN" valueColor={result < 0 ? C.danger : C.green} />
        <KpiCard icon="Bank" label={t('dash.bankBalance')} value={fmt(bankBalance)} unit="PLN" delta={latestTxnDate ? `stan: ${latestTxnDate}` : undefined} dir="up" />
      </div>

      {/* Wykres przychody vs koszty + struktura kosztów */}
      <div className="grid split-2-1" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-head"><div><h3>Przychody vs Koszty</h3><div className="head-sub">Ostatnie 12 miesięcy · netto (PLN)</div></div></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 10.5, fill: C.slate }} axisLine={{ stroke: C.grid }} tickLine={false} interval={0} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: C.slate }} axisLine={false} tickLine={false} width={48} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(58,77,152,.05)' }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" iconSize={9} />
                <Bar dataKey="przychody" name="Przychody" fill={C.navy} radius={[3, 3, 0, 0]} maxBarSize={22} />
                <Bar dataKey="koszty" name="Koszty" fill={C.green} radius={[3, 3, 0, 0]} maxBarSize={22} />
                <Line dataKey="wynik" name="Wynik" type="monotone" stroke={C.amber} strokeWidth={2} dot={{ r: 2.5, fill: C.amber }} activeDot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><div><h3>Struktura kosztów</h3><div className="head-sub">Wg kategorii · {selectedYear}</div></div></div>
          <div className="card-body">
            {catData.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>
                Brak kosztów z kategorią w {selectedYear}.<br />{context === 'spolka' ? 'Zsynchronizuj koszty z Comarch Betterfly.' : 'Zsynchronizuj koszty z inFakt.'}
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={75} paddingAngle={2} stroke="none">
                      {catData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {catData.slice(0, 6).map((c, i) => (
                    <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                      <span style={{ flex: 1, color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{catTotal > 0 ? Math.round(c.value / catTotal * 100) : 0}%</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: C.ink, minWidth: 56, textAlign: 'right' }}>{fmt(c.value)}</span>
                    </div>
                  ))}
                  {catData.length > 6 && <div style={{ fontSize: 11, color: 'var(--fg-3)', paddingLeft: 17 }}>+ {catData.length - 6} więcej</div>}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Należności/zobowiązania + top kontrahenci */}
      <div className="grid split-2-1" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-head"><div><h3>{t('dash.receivables')} · {t('dash.payables')}</h3></div></div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {[
                { label: t('dash.receivables'), value: receivables, overdue: recvOverdue, pct: 100, color: C.navy },
                { label: t('dash.payables'), value: payables, overdue: payOverdue, pct: receivables > 0 ? Math.round(payables / receivables * 100) : 100, color: C.green },
              ].map(r => (
                <div key={r.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: 'var(--fg-2)' }}>{r.label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14 }}>{fmt(r.value)} zł</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--lf-slate-100)', borderRadius: 999, overflow: 'hidden', margin: '4px 0' }}>
                    <div style={{ width: `${Math.min(r.pct, 100)}%`, height: '100%', background: r.color, borderRadius: 999 }} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--lf-danger)', marginTop: 4 }}>{t('dash.recvOverdue')}: {fmt(r.overdue)} zł</div>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--lf-slate-200)', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--lf-navy-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                    <Ico name="Percent" size={16} />
                  </span>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>{t('dash.vat')}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16 }}>{fmt(vatDue)} zł</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><div><h3>{t('dash.topContractors')}</h3></div></div>
          <div className="card-body" style={{ padding: '8px 0' }}>
            {topC.length === 0 && <div style={{ padding: '1rem 1.25rem', color: 'var(--fg-3)', fontSize: 13 }}>Brak danych</div>}
            {topC.map((c, i) => (
              <div key={i} className="int-row" style={{ padding: '10px 20px', borderTopColor: i === 0 ? 'transparent' : 'var(--lf-slate-200)' }}>
                <span className="avatar sm" data-color="navy">{c.name.slice(0, 2).toUpperCase()}</span>
                <div className="int-meta">
                  <div className="nm" style={{ fontSize: 13 }}>{c.name}</div>
                  <div className="sb" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{c.nip}</div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13 }}>{fmt(c.value)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Aktywność */}
      <div className="card">
        <div className="card-head"><div><h3>{t('dash.activity')}</h3></div></div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="activity">
            {activity.length === 0 && <div style={{ padding: '1rem 1.25rem', color: 'var(--fg-3)', fontSize: 13 }}>Brak aktywności</div>}
            {activity.map((a, i) => (
              <div key={i} className="activity-row" data-tone={a.tone}>
                <div className="dot-col"><Ico name={a.icon} size={15} /></div>
                <div className="body"><span>{a.text} <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{a.val}</strong></span></div>
                <div className="ts">{a.ts}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
