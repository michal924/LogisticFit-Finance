import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Ico } from '../components/ui/icons';
import type { Lang } from '../i18n';
import { makeT } from '../i18n';

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

export default function Dashboard() {
  const { lang } = useOutletContext<{ lang: Lang; query: string }>();
  const t = makeT(lang);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const months = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];

  const kpis = { revenue: 128_400, costs: 82_300, result: 46_100, bank: 214_800, receivables: 38_600, recvOverdue: 12_400, payables: 24_100, payOverdue: 4_800, vatDue: 18_200 };
  const cashflow = [
    { m: 'gru', in: 98, out: 72 }, { m: 'sty', in: 112, out: 85 }, { m: 'lut', in: 105, out: 79 },
    { m: 'mar', in: 118, out: 88 }, { m: 'kwi', in: 122, out: 91 }, { m: 'maj', in: 128, out: 82 },
  ];
  const maxCF = Math.max(...cashflow.flatMap(d => [d.in, d.out]));
  const activity = [
    { icon: 'CheckCircle', tone: 'success', text: 'Opłacono fakturę', val: 'FV/2026/089', ts: '2 min temu' },
    { icon: 'FileText',    tone: 'info',    text: 'Nowa faktura kosztowa', val: 'FC/2026/041', ts: '1 godz. temu' },
    { icon: 'AlertTriangle', tone: 'danger', text: 'Przeterminowana płatność', val: 'FV/2026/071', ts: '2 godz. temu' },
    { icon: 'Bank',        tone: 'neutral', text: 'Import wyciągu bankowego', val: '47 transakcji', ts: 'wczoraj' },
    { icon: 'ShieldCheck', tone: 'neutral', text: 'Wygenerowano JPK_V7M', val: 'kwiecień 2026', ts: 'wczoraj' },
  ];
  const topC = [
    { name: 'Pol-Trans Sp. z o.o.', nip: '123-456-78-90', value: 38_400 },
    { name: 'LogiGroup S.A.',       nip: '987-654-32-10', value: 29_800 },
    { name: 'TechDist Polska',      nip: '456-789-01-23', value: 22_100 },
    { name: 'Cargo Express',        nip: '321-098-76-54', value: 18_900 },
    { name: 'MedLogistics',         nip: '654-321-09-87', value: 14_200 },
  ];

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
        <KpiCard icon="TrendUp"  label={t('dash.revenue')}     value={fmt(kpis.revenue)}  unit="PLN" delta="+13,8%" dir="up" />
        <KpiCard icon="Receipt"  label={t('dash.costs')}       value={fmt(kpis.costs)}    unit="PLN" delta="+4,1%"  dir="down" />
        <KpiCard icon="Coins"    label={t('dash.result')}      value={fmt(kpis.result)}   unit="PLN" delta="+18,2%" dir="up" />
        <KpiCard icon="Bank"     label={t('dash.bankBalance')} value={fmt(kpis.bank)}     unit="PLN" delta="+6,5%"  dir="up" />
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
              {cashflow.map((d, i) => {
                const isLast = i === cashflow.length - 1;
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
                { label: t('dash.receivables'), value: kpis.receivables, overdue: kpis.recvOverdue, pct: 100, color: 'var(--lf-navy)' },
                { label: t('dash.payables'),    value: kpis.payables,    overdue: kpis.payOverdue,  pct: Math.round(kpis.payables / kpis.receivables * 100), color: 'var(--lf-green)' },
              ].map(r => (
                <div key={r.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: 'var(--fg-2)' }}>{r.label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14 }}>{fmt(r.value)} zł</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--lf-slate-100)', borderRadius: 999, overflow: 'hidden', margin: '4px 0' }}>
                    <div style={{ width: `${r.pct}%`, height: '100%', background: r.color, borderRadius: 999 }} />
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
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16 }}>{fmt(kpis.vatDue)} zł</div>
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
