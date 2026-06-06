import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Ico } from '../components/ui/icons';
import { fetchTax, fetchTaxDetail } from '../services/infaktService';
import { getInvoices } from '../services/invoiceService';
import { uploadDocument } from '../services/graphService';

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
  const map: Record<string, { t: string; c: string; bg: string }> = {
    paid: { t: 'Zapłacone', c: 'var(--lf-green-700)', bg: 'var(--lf-green-100)' },
    printed: { t: 'Zaksięg.', c: 'var(--lf-green-700)', bg: 'var(--lf-green-100)' },
    draft: { t: 'Szkic', c: 'var(--lf-warning)', bg: 'var(--lf-warning-bg)' },
    sent: { t: 'Wysłane', c: 'var(--lf-navy)', bg: 'var(--lf-navy-100)' },
  };
  const s = map[status] || { t: status || '—', c: 'var(--fg-3)', bg: 'var(--lf-slate-100)' };
  return <span className="badge" style={{ background: s.bg, color: s.c, fontWeight: 600 }}>{s.t}</span>;
}

export default function Raporty() {
  const { context } = useOutletContext<{ lang: any; query: string; context: string }>();
  const now = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth());
  const [selYear, setSelYear] = useState(now.getFullYear());

  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState<any[]>([]);
  const [jpk, setJpk] = useState<any[]>([]);
  const [pit, setPit] = useState<any[]>([]);
  const [zus, setZus] = useState<any[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    setLoading(true); setErr('');
    Promise.all([fetchTax('books'), fetchTax('saf_v7'), fetchTax('income'), fetchTax('insurance')])
      .then(([b, j, p, z]) => { setBooks(b); setJpk(j); setPit(p); setZus(z); })
      .catch(e => setErr(e.message || 'Błąd pobierania danych z inFakt'))
      .finally(() => setLoading(false));
  }, []);

  const selKey = `${selYear}-${String(selMonth + 1).padStart(2, '0')}`;
  const byPeriod = (arr: any[], key: string) => arr.find(x => (x.period || '').startsWith(key));
  // PIT kwartalny — znajdź deklarację dla kwartału zawierającego wybrany miesiąc
  const qStart = Math.floor(selMonth / 3) * 3;
  const pitKey = `${selYear}-${String(qStart + 1).padStart(2, '0')}`;

  const bCur = byPeriod(books, selKey);
  const jCur = byPeriod(jpk, selKey);
  const zCur = byPeriod(zus, selKey);
  const pCur = byPeriod(pit, pitKey);

  const income = gr(bCur?.income_price);
  const expenses = gr(bCur?.expenses_price);
  const profit = gr(bCur?.profit_price);
  const vatPay = gr(jCur?.tax_to_pay_price);
  const zusPay = gr(zCur?.sum_amount_price);

  // KPiR — ostatnie 12 miesięcy + suma roczna
  const monthly = useMemo(() => {
    const rows: any[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const b = byPeriod(books, key);
      rows.push({
        key, label: `${MONTH_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
        income: gr(b?.income_price), expenses: gr(b?.expenses_price), profit: gr(b?.profit_price), has: !!b,
      });
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books]);
  const ytd = monthly.filter(m => m.key.startsWith(String(selYear)));
  const ytdSum = ytd.reduce((a, m) => ({ income: a.income + m.income, expenses: a.expenses + m.expenses, profit: a.profit + m.profit }), { income: 0, expenses: 0, profit: 0 });

  // Zobowiązania do zapłaty (wybrany miesiąc/kwartał)
  const dues = [
    { label: 'VAT (JPK_V7)', amount: vatPay, date: jCur?.payment_date, status: jCur?.status, period: jCur?.period_name },
    { label: 'Zaliczka PIT', amount: gr(pCur?.to_pay_price), date: pCur?.payment_date, status: pCur?.status, period: pCur?.period_name },
    { label: 'ZUS', amount: zusPay, date: zCur?.payment_date, status: zCur?.status, period: zCur?.period_name },
  ];
  const duesTotal = dues.reduce((s, d) => s + d.amount, 0);

  // Generowanie miesięcznego PDF (z danych inFakt + rejestry z faktur) + archiwizacja do SharePoint
  const [gen, setGen] = useState(false);
  const [genMsg, setGenMsg] = useState('');

  async function generatePdf() {
    if (!bCur) { setGenMsg('Brak danych KPiR za ten miesiąc w inFakt.'); return; }
    setGen(true); setGenMsg('');
    try {
      // dane podatkowe są dla JDG — rejestry VAT z faktur JDG za wybrany miesiąc
      const [detail, sales, costs] = await Promise.all([
        fetchTaxDetail('books', bCur.id),
        getInvoices('sales', 'jdg'),
        getInvoices('cost', 'jdg'),
      ]);
      const inMonth = (x: any) => (x.issueDate || '').startsWith(selKey);
      const salesReg = sales.filter(inMonth).map(x => ({ number: x.number, date: x.issueDate, name: x.counterparty, nip: x.nip, net: x.netTotal, vat: x.vatTotal, gross: x.grossTotal }));
      const costReg = costs.filter(inMonth).map(x => ({ number: x.number, date: x.issueDate, name: x.counterparty, nip: x.nip, net: x.netTotal, vat: x.vatTotal }));
      const company = detail?.company || { name: 'Michał Rzeźnik LogisticFit', taxid: '9182077986', full_address: '' };

      const { generateMonthlyReport } = await import('../services/reportPdf');
      const doc = generateMonthlyReport({
        company: { name: company.name, taxid: company.taxid, address: company.full_address || '' },
        periodName: `${MONTHS_PL[selMonth]} ${selYear}`,
        summary: {
          income, expenses, profit,
          vatNal: salesReg.reduce((s, r) => s + r.vat, 0),
          vatNacz: costReg.reduce((s, r) => s + r.vat, 0),
          vatDue: vatPay, pitDue: gr(pCur?.to_pay_price), zus: zusPay,
        },
        salesReg, costReg,
      });

      const fname = `Raport_${selKey}_${MONTHS_PL[selMonth]}.pdf`;
      doc.save(fname);  // pobranie lokalne

      // archiwizacja do SharePoint (biblioteka JDG, folder Rozliczenia)
      try {
        const ab = doc.output('arraybuffer');
        await uploadDocument('jdg', 'Rozliczenia', `${selKey}-01`, fname, ab);
        setGenMsg(`✓ PDF wygenerowany i zarchiwizowany w SharePoint (Rozliczenia).`);
      } catch (upErr: any) {
        setGenMsg(`✓ PDF pobrany. Archiwizacja do SharePoint nieudana: ${upErr?.message || 'błąd'}`);
      }
    } catch (e: any) {
      setGenMsg(`Błąd generowania: ${e?.message || e}`);
    } finally {
      setGen(false);
    }
  }

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Raporty finansowe</h1>
          <p className="page-sub">Oficjalne rozliczenie z inFakt · KPiR, VAT, PIT, ZUS</p>
        </div>
        <div className="page-actions">
          <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))} style={{ fontSize: '0.85rem' }}>
            {MONTHS_PL.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={selYear} onChange={e => setSelYear(Number(e.target.value))} style={{ fontSize: '0.85rem' }}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn btn-primary" onClick={generatePdf} disabled={gen || loading}>
            {gen ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Ico name="Download" size={15} />}
            {gen ? 'Generuję…' : 'Generuj PDF'}
          </button>
        </div>
      </div>

      {genMsg && (
        <div style={{ marginBottom: 16, padding: '9px 14px', borderRadius: 8, fontSize: 13, background: genMsg.startsWith('✓') ? 'var(--lf-green-100)' : 'var(--lf-danger-bg)', color: genMsg.startsWith('✓') ? 'var(--lf-green-700)' : 'var(--lf-danger)', border: `1px solid ${genMsg.startsWith('✓') ? '#bce3c9' : '#fecaca'}` }}>
          {genMsg}
        </div>
      )}

      {context !== 'jdg' && (
        <div style={{ background: 'var(--lf-warning-bg)', border: '1px solid #f0e0b8', borderRadius: 8, padding: '9px 14px', fontSize: 13, color: 'var(--lf-warning)', marginBottom: 16 }}>
          <Ico name="AlertTriangle" size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
          Dane podatkowe pochodzą z konta inFakt (rozliczenie <strong>JDG</strong>). Dla działalności „{context}" inFakt nie prowadzi tu księgowości.
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240, flexDirection: 'column', gap: 12 }}>
          <div className="spinner" /><span style={{ color: 'var(--fg-3)', fontSize: 14 }}>Ładowanie z inFakt…</span>
        </div>
      ) : err ? (
        <div style={{ background: 'var(--lf-danger-bg)', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', fontSize: 14, color: 'var(--lf-danger)' }}>{err}</div>
      ) : (
        <>
          {/* KPI z KPiR (oficjalne) */}
          <div className="grid cols-4" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(5, 1fr)' }}>
            <div className="kpi">
              <div className="label"><span className="ico"><Ico name="TrendUp" size={15} /></span>Przychód</div>
              <div className="value" style={{ color: 'var(--lf-green)' }}>{fmt(income)} <span className="unit">PLN</span></div>
              <div className="delta">KPiR · {MONTHS_PL[selMonth]}</div>
            </div>
            <div className="kpi">
              <div className="label"><span className="ico"><Ico name="TrendDown" size={15} /></span>Koszty</div>
              <div className="value" style={{ color: 'var(--lf-danger)' }}>{fmt(expenses)} <span className="unit">PLN</span></div>
              <div className="delta">KPiR · {MONTHS_PL[selMonth]}</div>
            </div>
            <div className="kpi" style={{ background: 'var(--lf-navy-900)', color: '#fff' }}>
              <div className="label" style={{ color: 'rgba(255,255,255,0.6)' }}>Dochód</div>
              <div className="value" style={{ color: profit < 0 ? '#ff9b9b' : '#fff', fontSize: '1.35rem' }}>{fmt(profit)} <span style={{ fontSize: '0.82rem', opacity: 0.7 }}>PLN</span></div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.2rem' }}>marża {income > 0 ? (profit / income * 100).toFixed(1) : '—'}%</div>
            </div>
            <div className="kpi">
              <div className="label"><span className="ico"><Ico name="Receipt" size={15} /></span>VAT do zapłaty</div>
              <div className="value" style={{ color: vatPay > 0 ? 'var(--lf-danger)' : 'var(--lf-green)' }}>{fmt(vatPay)} <span className="unit">PLN</span></div>
              <div className="delta">{jCur?.payment_date ? `termin ${jCur.payment_date}` : 'JPK_V7'}</div>
            </div>
            <div className="kpi">
              <div className="label"><span className="ico"><Ico name="Coins" size={15} /></span>ZUS</div>
              <div className="value">{fmt(zusPay)} <span className="unit">PLN</span></div>
              <div className="delta">{zCur?.payment_date ? `termin ${zCur.payment_date}` : 'składki'}</div>
            </div>
          </div>

          {/* Zobowiązania do zapłaty + KPiR historia */}
          <div className="grid split-2-1" style={{ marginBottom: '1.5rem' }}>
            <div className="card">
              <div className="card-head"><span>Historia miesięczna · KPiR</span><span style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 400 }}>źródło: inFakt</span></div>
              <div className="card-body" style={{ padding: 0 }}>
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr>
                      <th>Miesiąc</th>
                      <th style={{ textAlign: 'right' }}>Przychód</th>
                      <th style={{ textAlign: 'right' }}>Koszty</th>
                      <th style={{ textAlign: 'right' }}>Dochód</th>
                      <th style={{ textAlign: 'right' }}>Marża</th>
                    </tr></thead>
                    <tbody>
                      {monthly.map(r => {
                        const sel = r.key === selKey;
                        return (
                          <tr key={r.key} style={sel ? { background: 'var(--lf-navy-50)' } : {}}>
                            <td style={{ fontWeight: sel ? 600 : 400 }}>{r.label}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--lf-green)', fontWeight: 600 }}>{r.has ? fmt(r.income) : '—'}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--lf-danger)' }}>{r.has ? fmt(r.expenses) : '—'}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{r.has ? fmt(r.profit) : '—'}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{r.has && r.income > 0 ? (r.profit / r.income * 100).toFixed(0) + '%' : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ fontWeight: 700, borderTop: '2px solid var(--lf-slate-200)' }}>
                        <td>Suma {selYear}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--lf-green)' }}>{fmt(ytdSum.income)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--lf-danger)' }}>{fmt(ytdSum.expenses)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmt(ytdSum.profit)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-head"><span>Do zapłaty · {MONTHS_PL[selMonth]}</span></div>
              <div className="card-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {dues.map(d => (
                    <div key={d.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: 'var(--fg-1)', fontWeight: 500 }}>{d.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{d.period || '—'}{d.date ? ` · termin ${d.date}` : ''}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14 }}>{fmt(d.amount)} zł</div>
                        <div>{d.status ? <StatusBadge status={d.status} /> : null}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid var(--lf-slate-200)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Razem</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16 }}>{fmt(duesTotal)} zł</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* JPK + PIT */}
          <div className="grid split-2-1">
            <div className="card">
              <div className="card-head"><span>JPK_V7 (deklaracje VAT)</span><span style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 400 }}>źródło: inFakt</span></div>
              <div className="card-body" style={{ padding: 0 }}>
                {jpk.length === 0 ? <div style={{ padding: '1rem 1.25rem', color: 'var(--fg-3)', fontSize: 13 }}>Brak deklaracji</div> : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead><tr><th>Okres</th><th>Status</th><th style={{ textAlign: 'right' }}>VAT do zapłaty</th><th style={{ textAlign: 'right' }}>Termin</th></tr></thead>
                      <tbody>
                        {jpk.slice(0, 14).map(j => (
                          <tr key={j.id}>
                            <td>{j.period_name} <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{j.symbol}</span></td>
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
              <div className="card-head"><span>Zaliczki PIT</span><span style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 400 }}>źródło: inFakt</span></div>
              <div className="card-body" style={{ padding: 0 }}>
                {pit.length === 0 ? <div style={{ padding: '1rem 1.25rem', color: 'var(--fg-3)', fontSize: 13 }}>Brak danych</div> : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead><tr><th>Okres</th><th style={{ textAlign: 'right' }}>Zaliczka</th><th>Status</th></tr></thead>
                      <tbody>
                        {pit.slice(0, 10).map(p => (
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
            <Ico name="ShieldCheck" size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />
            Wszystkie liczby pochodzą z oficjalnego rozliczenia w inFakt (z regułami podatkowymi). Pliki JPK XML pobierzesz w panelu inFakt.
          </div>
        </>
      )}
    </div>
  );
}
