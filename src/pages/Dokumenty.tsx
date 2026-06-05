import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Ico } from '../components/ui/icons';
import { libraryForContext } from '../services/graphService';
import { getContext } from '../stores/contextStore';
import { getInvoices } from '../services/invoiceService';
import type { Invoice } from '../types';

function fmtMoney(n: number): string {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function isArchived(url?: string): boolean {
  return !!url && /sharepoint\.com/i.test(url);
}

// Dokument = faktura z plikiem/załącznikami
type DocRow = Invoice & { docCount: number };

export default function Dokumenty() {
  const { context } = useOutletContext<{ lang: any; query: string; context: string }>();
  const [rows, setRows] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  // filtry
  const [search, setSearch] = useState('');
  const [fType, setFType] = useState<'all' | 'sales' | 'cost'>('all');
  const [fCat, setFCat] = useState('all');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');

  const library = libraryForContext(context);
  const ctx = getContext(context as any);

  useEffect(() => {
    setLoading(true); setError(''); setExpanded(null);
    Promise.all([getInvoices('sales', context), getInvoices('cost', context)])
      .then(([sales, costs]) => {
        const all = [...sales, ...costs]
          .filter(i => i.fileUrl || (i.attachments && i.attachments.length))
          .map(i => ({ ...i, docCount: i.attachments?.length || (i.fileUrl ? 1 : 0) }))
          .sort((a, b) => b.issueDate.localeCompare(a.issueDate));
        setRows(all);
      })
      .catch(e => setError(e.message || 'Błąd ładowania'))
      .finally(() => setLoading(false));
  }, [context]);

  // unikalne kategorie kosztów (do dropdownu)
  const categories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => { if (r.type === 'cost' && r.category) set.add(r.category); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pl'));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (fType !== 'all' && r.type !== fType) return false;
      if (fCat !== 'all' && (r.category || '') !== fCat) return false;
      if (fFrom && r.issueDate < fFrom) return false;
      if (fTo && r.issueDate > fTo) return false;
      if (q && !(r.number.toLowerCase().includes(q) || r.counterparty.toLowerCase().includes(q) || (r.category || '').toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rows, search, fType, fCat, fFrom, fTo]);

  const hasFilters = !!(search || fType !== 'all' || fCat !== 'all' || fFrom || fTo);
  function clearFilters() { setSearch(''); setFType('all'); setFCat('all'); setFFrom(''); setFTo(''); }

  function openDoc(r: DocRow) {
    const url = r.attachments?.[0]?.url || r.fileUrl;
    if (url) window.open(url, '_blank');
  }

  const totalGross = filtered.reduce((s, r) => s + r.grossTotal, 0);

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Dokumenty</h1>
          <div className="page-sub">Archiwum faktur i załączników · biblioteka <strong>{library}</strong></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--fg-3)' }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: ctx.color }} />
          {ctx.name}
        </div>
      </div>

      {/* Filtry */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-3)', display: 'flex' }}>
            <Ico name="Search" size={15} />
          </span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Szukaj: numer, kontrahent, kategoria…"
            style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 8, border: '1px solid var(--border-1)', fontSize: 13, background: '#fff' }}
          />
        </div>

        <select value={fType} onChange={e => setFType(e.target.value as any)}
          style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-1)', fontSize: 13, background: '#fff', cursor: 'pointer' }}>
          <option value="all">Typ: wszystkie</option>
          <option value="sales">Sprzedaż</option>
          <option value="cost">Koszty</option>
        </select>

        <select value={fCat} onChange={e => setFCat(e.target.value)} disabled={categories.length === 0}
          style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-1)', fontSize: 13, background: '#fff', cursor: categories.length ? 'pointer' : 'default', opacity: categories.length ? 1 : 0.5 }}>
          <option value="all">Kategoria: wszystkie</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--fg-3)' }}>
          <input type="date" value={fFrom} onChange={e => setFFrom(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-1)', fontSize: 13, background: '#fff' }} />
          <span>–</span>
          <input type="date" value={fTo} onChange={e => setFTo(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-1)', fontSize: 13, background: '#fff' }} />
        </div>

        {hasFilters && (
          <button onClick={clearFilters}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-1)', background: '#fff', fontSize: 13, color: 'var(--fg-2)', cursor: 'pointer' }}>
            <Ico name="X" size={14} /> Wyczyść
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: 'var(--lf-danger-bg)', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--lf-danger)', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Tabela */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--border-1)', overflow: 'hidden' }}>
        {/* nagłówek */}
        {!loading && filtered.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.6fr 90px 1.2fr 100px 120px 40px', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border-1)', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--fg-3)', background: 'var(--lf-slate-50)' }}>
            <span>Dokument</span>
            <span>Kontrahent</span>
            <span>Typ</span>
            <span>Rodzaj / Kategoria</span>
            <span>Data</span>
            <span style={{ textAlign: 'right' }}>Brutto</span>
            <span></span>
          </div>
        )}

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--fg-3)' }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--fg-3)', fontSize: 14 }}>
            {rows.length === 0
              ? 'Brak zarchiwizowanych dokumentów — uruchom „Pełna archiwizacja" na fakturach, by zapisać pliki do SharePoint'
              : 'Brak dokumentów spełniających filtry'}
          </div>
        ) : (
          filtered.map(r => {
            const isCost = r.type === 'cost';
            const cat = isCost ? (r.category || '—') : 'Sprzedaż';
            const archived = isArchived(r.attachments?.[0]?.url || r.fileUrl);
            const open = expanded === r.spId;
            const multi = r.docCount > 1;
            return (
              <div key={r.spId || r.number} style={{ borderBottom: '1px solid var(--border-1)' }}>
                <div
                  onClick={() => multi ? setExpanded(open ? null : (r.spId || null)) : openDoc(r)}
                  style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.6fr 90px 1.2fr 100px 120px 40px', gap: 12, padding: '11px 16px', cursor: 'pointer', alignItems: 'center', transition: 'background .1s' }}
                  onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--lf-slate-50)')}
                  onMouseLeave={ev => (ev.currentTarget.style.background = '#fff')}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--fg-1)', minWidth: 0 }}>
                    <Ico name="FileText" size={16} style={{ color: '#c8362d', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.number}</span>
                    {multi && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'var(--lf-slate-50)', border: '1px solid var(--border-1)', borderRadius: 20, padding: '1px 7px', flexShrink: 0 }}>{r.docCount} dok.</span>}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.counterparty || '—'}</span>
                  <span>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: isCost ? 'var(--lf-danger-bg)' : 'var(--lf-success-bg, #e7f6ec)', color: isCost ? 'var(--lf-danger)' : 'var(--lf-success, #239d46)' }}>
                      {isCost ? 'Koszt' : 'Sprzedaż'}
                    </span>
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</span>
                  <span style={{ fontSize: 13, color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>{r.issueDate}</span>
                  <span style={{ fontSize: 13, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)', textAlign: 'right', fontWeight: 600 }}>{fmtMoney(r.grossTotal)}</span>
                  <span style={{ display: 'flex', justifyContent: 'flex-end', color: 'var(--fg-3)' }}>
                    {!archived && <span title="Nie zarchiwizowano w SharePoint" style={{ marginRight: 4, color: 'var(--lf-warn, #d28a17)', display: 'flex' }}><Ico name="AlertTriangle" size={13} /></span>}
                    <Ico name={multi ? (open ? 'ChevronDown' : 'ChevronRight') : 'ArrowUpRight'} size={15} />
                  </span>
                </div>

                {/* rozwinięcie: lista załączników */}
                {multi && open && (
                  <div style={{ background: 'var(--lf-slate-50)', borderTop: '1px solid var(--border-1)', padding: '6px 16px 10px 44px' }}>
                    {r.attachments!.map((a, i) => (
                      <a key={i} href={a.url} target="_blank" rel="noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', fontSize: 13, color: 'var(--fg-1)', textDecoration: 'none', borderRadius: 6 }}
                        onMouseEnter={ev => (ev.currentTarget.style.background = '#fff')}
                        onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}>
                        <Ico name="FileText" size={15} style={{ color: '#c8362d' }} />
                        <span style={{ flex: 1 }}>{a.name}</span>
                        <Ico name="ArrowUpRight" size={14} style={{ color: 'var(--fg-3)' }} />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--fg-3)' }}>
          <span>{filtered.length} {filtered.length === 1 ? 'dokument' : 'dokumentów'}{hasFilters && rows.length !== filtered.length ? ` z ${rows.length}` : ''} · kliknij, by otworzyć z SharePoint</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>Suma brutto: {fmtMoney(totalGross)} PLN</span>
        </div>
      )}
    </div>
  );
}
