import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Ico } from '../components/ui/icons';
import type { Lang } from '../i18n';
import { makeT } from '../i18n';
import { getInvoices } from '../services/invoiceService';
import { TransactionsService } from '../services/graphService';
import type { Invoice } from '../types';

function fmt(n: number) {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function KpiCard({ label, icon, value, unit, delta, dir }: {
  label: string; icon: string; value: string; unit?: string; delta?: string; dir?: 'up' | 'down';
}) {
  return (
    <div className="kpi">
      <div className="label"><span className="ico"><Ico name={icon} size={15} /></span>{label}</div>
      <div className="value">{value}{unit && <span className="unit"> {unit}</span>}</div>
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

export default function Dashboard() {
  const { lang } = useOutletContext<{ lang: Lang; query: string }>();
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
      getInvoices('sales'),
      getInvoices('cost'),
      TransactionsService.getAll(),
    ])
      .then(([sales, costs, txns]) => {
        setSalesInvoices(sales);
        setCostInvoices(costs);
        setTransactions(txns);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Compute KPIs for selected month/year
  const monthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  const revenue = salesInvoices
    .filter(i => i.issueDate?.startsWith(monthStr))
    .reduce((s, i) => s + (i.netTotal || 0), 0);

  const costs = costInvoices
    .filter(i => i.issueDate?.startsWith(monthStr))
    .reduce((s, i) => s + (i.netTotal || 0), 0);

  const result = revenue - costs;

  // Bank balance: last transaction balance
  const sortedTxns = [...transactions].sort((a, b) => {
    const da = a.fields?.TransactionDate || '';
    const db = b.fields?.TransactionDate || '';
    return db.localeCompare(da);
  });
  const bankBalance = sortedTxns[0]?.fields?.Balance ?? 0;
  const latestTxnDate = sortedTxns[0]?.fields?.TransactionDate?.split('T')[0] ?? '';

  // Receivables / Payables
  const today = new Date().toISOString().split('T')[0];
  const receivables = salesInvoices.filter(i => !i.paid).reduce((s, i) => s + (i.grossTotal || 0), 0);
  const recvOverdue = salesInvoices.filter(i => !i.paid && i.dueDate < today).reduce((s, i) => s + (i.grossTotal || 0), 0);
  const payables = costInvoices.filter(i => !i.paid).reduce((s, i) => s + (i.grossTotal || 0), 0);
  const payOverdue = costInvoices.filter(i => !i.paid && i.dueDate < today).reduce((s, i) => s + (i.grossTotal || 0), 0);
  const vatDue = costInvoices.filter(i => !i.paid).reduce((s, i) => s + (i.vatTotal || 0), 0);

  // Top contractors: group sales by counterparty
  const contractorMap = new Map<string, number>();
  salesInvoices.forEach(i => {
    const key = i.counterparty || 'Nieznany';
    contractorMap.set(key, (contractorMap.get(key) || 0) + (i.grossTotal || 0));
  });
  const topC = Array.from(contractorMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => {
      const inv = salesInvoices.find(i => i.counterparty === name);
      return { name, nip: inv?.nip || '—', value };
    });

  // Activity: last 5 invoices + transactions
  const activityItems: { icon: string; tone: string; text: string; val: string; ts: string; date: string }[] = [];

  salesInvoices.slice(0, 5).forEach(i => {
    activityItems.push({
      icon: i.paid ? 'CheckCircle' : 'FileText',
      tone: i.paid ? 'success' : 'info',
      text: i.paid ? 'Opłacona faktura sprzedaży' : 'Nowa faktura sprzedaży',
      val: i.number,
      ts: i.issueDate,
      date: i.issueDate,
    });
  });

  costInvoices.slice(0, 5).forEach(i => {
    const overdue = !i.paid && i.dueDate < today;
    activityItems.push({
      icon: overdue ? 'AlertTriangle' : 'FileText',
      tone: overdue ? 'danger' : 'info',
      text: overdue ? 'Przeterminowana faktura kosztowa' : 'Nowa faktura kosztowa',
      val: i.number,
      ts: i.issueDate,
      date: i.issueDate,
    });
  });

  const activity = activityItems
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  // Cashflow: last 6 months from transactions
  const cfMonths: { m: string; in: number; out: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = MONTH_SHORT[d.getMonth()];
    let inflow = 0;
    let outflow = 0;
    transactions.forEach(t => {
      const f = t.fields || {};
      const txDate = (f.TransactionDate || '').substring(0, 7);
      if (txDate === key) {
        const amt = f.Amount || 0;
        const type = (f.TransactionType || '').toLowerCase();
        if (type === 'credit' || amt > 0) inflow += Math.abs(amt);
        else outflow += Math.abs(amt);
      }
    });
    // Fallback to invoices if no transactions
    if (inflow === 0 && outflow === 0) {
      inflow = salesInvoices
        .filter(inv => inv.issueDate?.startsWith(key))
        .reduce((s, inv) => s + (inv.grossTotal || 0), 0) / 1000;
      outflow = costInvoices
        .filter(inv => inv.issueDate?.startsWith(key))
        .reduce((s, inv) => s + (inv.grossTotal || 0), 0) / 1000;
    } else {
      inflow = inflow / 1000;
      outflow = outflow / 1000;
    }
    cfMonths.push({ m: label, in: inflow, out: outflow });
  }
  const maxCF = Math.max(...cfMonths.flatMap(d => [d.in, d.out]), 1);

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
        <KpiCard icon="TrendUp"  label={t('dash.revenue')}     value={fmt(revenue)}      unit="PLN" />
        <KpiCard icon="Receipt"  label={t('dash.costs')}       value={fmt(costs)}         unit="PLN" />
        <KpiCard icon="Coins"    label={t('dash.result')}      value={fmt(result)}        unit="PLN" />
        <KpiCard icon="Bank"     label={t('dash.bankBalance')} value={fmt(bankBalance)}   unit="PLN" delta={latestTxnDate ? `stan: ${latestTxnDate}` : undefined} dir="up" />
      </div>

      <div className="grid split-2-1" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-head"><div><h3>{t('dash.cashflow')}</h3><div className="head-sub">{t('dash.cashflowSub')}</div></div></div>
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 16 }}>
                {[['var(--lf-navy)', t('dash.inflow')], ['var(--lf-green)', t('dash.outflow')]].map(([c, l]) => (
                  <span key={String(l)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--fg-3)' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: String(c), display: 'inline-block' }} />{l}
                  </span>
                ))}
              </div>
              <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>tys. PLN</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 0, height: 160 }}>
              {cfMonths.map((d, i) => {
                const isLast = i === cfMonths.length - 1;
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%' }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 3, width: '100%', justifyContent: 'center' }}>
                      <div style={{ width: '34%', maxWidth: 14, height: `${(d.in / maxCF) * 100}%`, background: 'var(--lf-navy)', borderRadius: '3px 3px 0 0', opacity: isLast ? 0.55 : 1 }} />
                      <div style={{ width: '34%', maxWidth: 14, height: `${(d.out / maxCF) * 100}%`, background: 'var(--lf-green)', borderRadius: '3px 3px 0 0', opacity: isLast ? 0.55 : 1 }} />
                    </div>
                    <span style={{ fontSize: 10.5, color: isLast ? 'var(--accent)' : 'var(--fg-3)', fontWeight: isLast ? 700 : 500, fontFamily: 'var(--font-mono)' }}>{d.m}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><div><h3>{t('dash.receivables')} · {t('dash.payables')}</h3></div></div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {[
                { label: t('dash.receivables'), value: receivables, overdue: recvOverdue, pct: 100, color: 'var(--lf-navy)' },
                { label: t('dash.payables'),    value: payables,    overdue: payOverdue,  pct: receivables > 0 ? Math.round(payables / receivables * 100) : 100, color: 'var(--lf-green)' },
              ].map(r => (
                <div key={r.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: 'var(--fg-2)' }}>{r.label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14 }}>{fmt(r.value)} zł</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--lf-slate-100)', borderRadius: 999, overflow: 'hidden', margin: '4px 0' }}>
                    <div style={{ width: `${Math.min(r.pct, 100)}%`, height: '100%', background: r.color, borderRadius: 999 }} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--lf-danger)', marginTop: 4 }}>
                    {t('dash.recvOverdue')}: {fmt(r.overdue)} zł
                  </div>
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
                <button className="btn btn-secondary" style={{ fontSize: 12, padding: '5px 12px' }}>JPK_V7</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid split-2-1">
        <div className="card">
          <div className="card-head"><div><h3>{t('dash.activity')}</h3></div></div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="activity">
              {activity.length === 0 && (
                <div style={{ padding: '1rem 1.25rem', color: 'var(--fg-3)', fontSize: 13 }}>Brak aktywności</div>
              )}
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

        <div className="card">
          <div className="card-head"><div><h3>{t('dash.topContractors')}</h3></div><button className="icon-btn"><Ico name="ArrowUpRight" size={15} /></button></div>
          <div className="card-body" style={{ padding: '8px 0' }}>
            {topC.length === 0 && (
              <div style={{ padding: '1rem 1.25rem', color: 'var(--fg-3)', fontSize: 13 }}>Brak danych</div>
            )}
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
    </div>
  );
}
