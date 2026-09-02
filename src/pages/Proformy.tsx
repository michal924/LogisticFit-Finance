import { useState, useEffect, Fragment } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Loader2, RefreshCw, Search, ChevronRight, FileText } from 'lucide-react';
import type { Invoice } from '../types';
import { getInvoices } from '../services/invoiceService';
import { syncFromBetterfly, autoSyncDataBetterfly } from '../services/betterflyService';
import { loadTransactions, annotatePayments } from '../services/paymentMatch';
import MultiSelectChip from '../components/MultiSelectChip';

const MONTH_OPTS = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień']
  .map((label, i) => ({ value: String(i + 1).padStart(2, '0'), label }));

function fmt(n: number) {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Proformy() {
  const { context } = useOutletContext<{ lang: any; query: string; context: string }>();
  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selYears, setSelYears] = useState<string[]>([]);
  const [selMonths, setSelMonths] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const isBetterfly = context === 'spolka';

  const reload = async () => {
    setLoading(true); setExpanded(null);
    try {
      const docs = await getInvoices('proforma', context);
      let txns: any[] = [];
      try { txns = await loadTransactions(context); } catch { /* bank niedostępny */ }
      setRows(annotatePayments(docs, txns));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { reload(); }, [context]);

  // Auto-sync proform przy wejściu (tylko Spółka/Betterfly), throttle 5 min
  useEffect(() => {
    if (loading || !isBetterfly) return;
    const key = `autosync-proforma-${context}`;
    const last = Number(sessionStorage.getItem(key) || 0);
    if (Date.now() - last < 5 * 60 * 1000) return;
    sessionStorage.setItem(key, String(Date.now()));
    (async () => {
      try {
        const n = await autoSyncDataBetterfly('proforma', context, rows);
        if (n > 0) { setSyncMsg(`✓ Auto-zsynchronizowano ${n} proform`); await reload(); }
      } catch { /* cicho */ }
    })();
  }, [loading, context]);

  async function handleSync() {
    setSyncing(true); setSyncMsg('Pobieram proformy z Comarch Betterfly…');
    try {
      const r = await syncFromBetterfly('proforma', context, rows, (done, total) => setSyncMsg(`Synchronizuję… ${done}/${total}`));
      setSyncMsg(`✓ Zsynchronizowano ${r.ok} proform`);
      await reload();
    } catch (e: any) {
      setSyncMsg('Błąd Comarch Betterfly: ' + (e.message || e));
    } finally { setSyncing(false); }
  }

  const yearOpts = Array.from(new Set(rows.map(i => (i.issueDate || '').slice(0, 4)).filter(Boolean)))
    .sort((a, b) => b.localeCompare(a)).map(y => ({ value: y, label: y }));

  const filtered = rows.filter(inv => {
    if (search && !inv.counterparty.toLowerCase().includes(search.toLowerCase()) &&
        !inv.number.toLowerCase().includes(search.toLowerCase())) return false;
    if (selYears.length && !selYears.includes((inv.issueDate || '').slice(0, 4))) return false;
    if (selMonths.length && !selMonths.includes((inv.issueDate || '').slice(5, 7))) return false;
    return true;
  });

  const totalGross = filtered.reduce((s, i) => s + i.grossTotal, 0);
  const paidGross = filtered.filter(i => i.paid).reduce((s, i) => s + i.grossTotal, 0);

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Proformy</h1>
          <div className="page-sub">
            Dokumenty pro forma z Comarch Betterfly · <strong>nie są przychodem podatkowym</strong> (nie liczą się do VAT/wyniku)
          </div>
        </div>
        {isBetterfly && (
          <div className="page-actions">
            <button className="btn" onClick={handleSync} disabled={syncing}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: syncing ? 'var(--lf-slate-100)' : 'var(--accent)', color: syncing ? 'var(--fg-3)' : '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: syncing ? 'default' : 'pointer' }}>
              {syncing ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={15} />}
              {syncing ? 'Synchronizuję…' : 'Synchronizuj z Comarch Betterfly'}
            </button>
          </div>
        )}
      </div>

      {syncMsg && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600,
          background: syncMsg.startsWith('✓') ? 'var(--lf-green-100)' : syncMsg.startsWith('Błąd') ? 'var(--lf-danger-bg)' : 'var(--lf-navy-100)',
          color: syncMsg.startsWith('✓') ? 'var(--lf-green-900)' : syncMsg.startsWith('Błąd') ? 'var(--lf-danger)' : 'var(--lf-navy-700)' }}>
          {syncMsg}
        </div>
      )}

      {/* Filtry */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <MultiSelectChip label="Rok" options={yearOpts} selected={selYears} onChange={setSelYears} width={140} />
        <MultiSelectChip label="Miesiąc" options={MONTH_OPTS} selected={selMonths} onChange={setSelMonths} width={180} />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--border)', borderRadius: 999, padding: '6px 14px', minWidth: 220 }}>
          <Search size={15} style={{ opacity: 0.4, flexShrink: 0 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Szukaj: numer, kontrahent…"
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, width: '100%' }} />
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--border-1)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--fg-3)' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--fg-3)', fontSize: 14 }}>
            {isBetterfly ? 'Brak proform — kliknij „Synchronizuj z Comarch Betterfly”' : 'Proformy dostępne są dla Spółki (Comarch Betterfly)'}
          </div>
        ) : (
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Numer</th><th>Data</th><th>Kontrahent</th>
                <th style={{ textAlign: 'right' }}>Netto</th>
                <th style={{ textAlign: 'right' }}>Brutto</th>
                <th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => {
                const open = expanded === inv.spId;
                return (
                  <Fragment key={inv.spId || inv.number}>
                    <tr onClick={() => setExpanded(open ? null : (inv.spId || null))} style={{ cursor: 'pointer', background: open ? 'var(--lf-navy-50, #f0f4ff)' : undefined }}>
                      <td style={{ fontWeight: 600 }}><FileText size={14} style={{ color: '#8b6fc8', verticalAlign: -2, marginRight: 6 }} />{inv.number}</td>
                      <td className="mono" style={{ fontSize: 12, color: 'var(--fg-3)' }}>{inv.issueDate}</td>
                      <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.counterparty || '—'}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmt(inv.netTotal)}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(inv.grossTotal)}</td>
                      <td>
                        <span className="badge" style={{ background: inv.paid ? '#f0faf2' : '#fffbf0', color: inv.paid ? '#239d46' : '#d28a17' }}>
                          {inv.paid ? (inv.matchedDate ? `Opłacona · bank ${inv.matchedDate.slice(5)}` : 'Opłacona') : 'Oczekuje'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}><ChevronRight size={15} style={{ color: 'var(--fg-3)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} /></td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={7} style={{ padding: 0, background: '#f9fafd', borderBottom: '2px solid #8b6fc8' }}>
                          <div style={{ padding: '14px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: 13, maxWidth: 640 }}>
                            {[
                              ['Numer', inv.number],
                              ['Data wystawienia', inv.issueDate],
                              ['Termin', inv.dueDate || '—'],
                              ['Kontrahent', inv.counterparty || '—'],
                              ['NIP', inv.nip || '—'],
                              ['Netto', `${fmt(inv.netTotal)} PLN`],
                              ['VAT', `${fmt(inv.vatTotal)} PLN`],
                              ['Brutto', `${fmt(inv.grossTotal)} PLN`],
                              ...(inv.matchedTxn ? [['Zapłata (bank)', `${inv.matchedDate} · ${inv.matchedTxn.slice(0, 40)}`]] : []),
                            ].map(([l, v]) => (
                              <div key={l}><div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 2 }}>{l}</div><div style={{ fontWeight: 500 }}>{v}</div></div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--fg-3)' }}>
          <span>{filtered.length} proform · opłacone: <span style={{ color: '#239d46', fontWeight: 600 }}>{fmt(paidGross)} PLN</span></span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>Suma brutto: {fmt(totalGross)} PLN</span>
        </div>
      )}
    </div>
  );
}
