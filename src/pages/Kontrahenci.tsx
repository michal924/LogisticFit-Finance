import { useState, useEffect, Fragment } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Ico } from '../components/ui/icons';
import { getInvoices } from '../services/invoiceService';

type Role = 'Klient' | 'Dostawca' | 'Oba';

const ROLE_COLORS: Record<Role, string> = {
  Klient:   'var(--lf-green)',
  Dostawca: 'var(--navy-600, #2d4a8c)',
  Oba:      'var(--amber, #d97706)',
};

function fmt(n: number) {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmt2(n: number) {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Filter = 'Wszystkie' | Role;
const FILTERS: Filter[] = ['Wszystkie', 'Klient', 'Dostawca', 'Oba'];

type Doc = { name: string; url: string };
type CItem = { number: string; issueDate: string; type: 'sales' | 'cost'; netTotal: number; grossTotal: number; paid: boolean; docs: Doc[] };
type Contractor = {
  key: string; name: string; nip: string; role: Role; initials: string;
  asClient: boolean; asVendor: boolean;
  invoices: number; totalNet: number; totalGross: number;
  salesNet: number; salesGross: number; salesCount: number;
  costNet: number; costGross: number; costCount: number;
  items: CItem[];
};

function docsOf(inv: any): Doc[] {
  if (inv.attachments?.length) return inv.attachments;
  if (inv.fileUrl) return [{ name: 'Dokument (oryginał)', url: inv.fileUrl }];
  return [];
}

export default function Kontrahenci() {
  const { context } = useOutletContext<{ context: string }>();
  const [filter, setFilter] = useState<Filter>('Wszystkie');
  const [search, setSearch] = useState('');
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setExpanded(null);
    Promise.all([getInvoices('sales', context), getInvoices('cost', context)])
      .then(([sales, costs]) => {
        const map = new Map<string, Contractor>();
        const add = (inv: any, kind: 'sales' | 'cost') => {
          const name = (inv.counterparty || '').trim();
          const nip = (inv.nip || '').trim();
          if (!name && !nip) return;
          const key = nip || name.toLowerCase();
          let a = map.get(key);
          if (!a) {
            a = { key, name, nip, role: 'Klient', initials: '', asClient: false, asVendor: false,
              invoices: 0, totalNet: 0, totalGross: 0, salesNet: 0, salesGross: 0, salesCount: 0,
              costNet: 0, costGross: 0, costCount: 0, items: [] };
            map.set(key, a);
          }
          if (!a.name && name) a.name = name;
          if ((!a.nip || a.nip === '—') && nip) a.nip = nip;
          a.invoices += 1;
          a.totalNet += inv.netTotal || 0;
          a.totalGross += inv.grossTotal || 0;
          if (kind === 'sales') { a.asClient = true; a.salesNet += inv.netTotal || 0; a.salesGross += inv.grossTotal || 0; a.salesCount += 1; }
          else { a.asVendor = true; a.costNet += inv.netTotal || 0; a.costGross += inv.grossTotal || 0; a.costCount += 1; }
          a.items.push({ number: inv.number, issueDate: inv.issueDate, type: kind, netTotal: inv.netTotal || 0, grossTotal: inv.grossTotal || 0, paid: !!inv.paid, docs: docsOf(inv) });
        };
        sales.forEach(i => add(i, 'sales'));
        costs.forEach(i => add(i, 'cost'));
        const mapped = Array.from(map.values()).map(a => {
          a.role = a.asClient && a.asVendor ? 'Oba' : a.asVendor ? 'Dostawca' : 'Klient';
          a.nip = a.nip || '—';
          a.initials = a.name.split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '??';
          a.items.sort((x, y) => (y.issueDate || '').localeCompare(x.issueDate || ''));
          return a;
        });
        mapped.sort((a, b) => b.totalGross - a.totalGross);
        setContractors(mapped);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [context]);

  const rows = contractors.filter(c => {
    const matchRole =
      filter === 'Wszystkie' ? true :
      filter === 'Klient' ? c.asClient :
      filter === 'Dostawca' ? c.asVendor :
      (c.asClient && c.asVendor); // Oba
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || c.nip.includes(q);
    return matchRole && matchSearch;
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, flexDirection: 'column', gap: 12 }}>
        <div className="spinner" />
        <span style={{ color: 'var(--fg-3)', fontSize: 14 }}>Ładowanie kontrahentów…</span>
      </div>
    );
  }

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Kontrahenci</h1>
          <p className="page-sub">{contractors.length} kontrahentów w bazie</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary"><Ico name="Download" size={15} /> Eksportuj</button>
        </div>
      </div>

      <div className="card">
        <div className="filterbar">
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {FILTERS.map(f => (
              <button key={f} className={`chip${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
          {/* Szukaj — zaokrąglone (pigułka) jak przyciski */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--border)', borderRadius: 999, padding: '6px 14px', maxWidth: 280, flex: 1 }}>
            <Ico name="Search" size={15} style={{ opacity: 0.4, flexShrink: 0 }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Szukaj kontrahenta…"
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, width: '100%', color: 'var(--fg-1)' }} />
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Kontrahent</th>
                  <th>NIP</th>
                  <th>Rola</th>
                  <th style={{ textAlign: 'center' }}>Faktury</th>
                  <th style={{ textAlign: 'right' }}>Obrót netto (PLN)</th>
                  <th style={{ textAlign: 'right' }}>Obrót brutto (PLN)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="empty">Brak kontrahentów dla podanych filtrów</td></tr>
                )}
                {rows.map(c => {
                  const open = expanded === c.key;
                  return (
                    <Fragment key={c.key}>
                      <tr onClick={() => setExpanded(open ? null : c.key)} style={{ cursor: 'pointer', background: open ? 'var(--lf-navy-50, #f0f4ff)' : undefined }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--navy-100, #e8edf7)', color: 'var(--navy-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.7rem', flexShrink: 0 }}>{c.initials}</div>
                            <span style={{ fontWeight: 500 }}>{c.name}</span>
                          </div>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--fg-3)' }}>{c.nip}</td>
                        <td>
                          {c.role === 'Oba' ? (
                            <span style={{ display: 'inline-flex', gap: 4 }}>
                              <span className="badge" style={{ background: `${ROLE_COLORS.Klient}20`, color: ROLE_COLORS.Klient, border: `1px solid ${ROLE_COLORS.Klient}40` }}>Klient</span>
                              <span className="badge" style={{ background: `${ROLE_COLORS.Dostawca}20`, color: ROLE_COLORS.Dostawca, border: `1px solid ${ROLE_COLORS.Dostawca}40` }}>Dostawca</span>
                            </span>
                          ) : (
                            <span className="badge" style={{ background: `${ROLE_COLORS[c.role]}20`, color: ROLE_COLORS[c.role], border: `1px solid ${ROLE_COLORS[c.role]}40` }}>{c.role}</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{c.invoices}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmt(c.totalNet)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmt(c.totalGross)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <Ico name="ChevronRight" size={16} style={{ color: 'var(--fg-3)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
                        </td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={7} style={{ padding: 0, background: '#f9fafd', borderBottom: '2px solid var(--accent)' }}>
                            <div style={{ padding: '16px 20px' }}>
                              {/* Rozbicie: jako klient / jako dostawca */}
                              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                                {c.asClient && (
                                  <div style={{ flex: '1 1 220px', minWidth: 200, background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                      <span className="badge" style={{ background: `${ROLE_COLORS.Klient}20`, color: ROLE_COLORS.Klient }}>Jako klient (sprzedaż)</span>
                                    </div>
                                    <div style={{ fontSize: 13, color: 'var(--fg-2)' }}>{c.salesCount} faktur · netto <strong style={{ fontFamily: 'var(--font-mono)' }}>{fmt2(c.salesNet)}</strong> · brutto <strong style={{ fontFamily: 'var(--font-mono)' }}>{fmt2(c.salesGross)}</strong> PLN</div>
                                  </div>
                                )}
                                {c.asVendor && (
                                  <div style={{ flex: '1 1 220px', minWidth: 200, background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                      <span className="badge" style={{ background: `${ROLE_COLORS.Dostawca}20`, color: ROLE_COLORS.Dostawca }}>Jako dostawca (koszty)</span>
                                    </div>
                                    <div style={{ fontSize: 13, color: 'var(--fg-2)' }}>{c.costCount} faktur · netto <strong style={{ fontFamily: 'var(--font-mono)' }}>{fmt2(c.costNet)}</strong> · brutto <strong style={{ fontFamily: 'var(--font-mono)' }}>{fmt2(c.costGross)}</strong> PLN</div>
                                  </div>
                                )}
                              </div>

                              {/* Lista faktur + dokumenty */}
                              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--fg-3)', marginBottom: 8 }}>Faktury i dokumenty ({c.items.length})</div>
                              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                                {c.items.map((it, i) => {
                                  const isCost = it.type === 'cost';
                                  return (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px', borderTop: i ? '1px solid var(--border)' : 'none', flexWrap: 'wrap' }}>
                                      <span className="badge" style={{ background: isCost ? 'var(--lf-danger-bg, #fef2f2)' : 'var(--lf-green-100, #e0f3e6)', color: isCost ? 'var(--lf-danger)' : 'var(--lf-green-700)', flexShrink: 0 }}>{isCost ? 'Koszt' : 'Sprzedaż'}</span>
                                      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--accent)', minWidth: 120 }}>{it.number || '—'}</span>
                                      <span style={{ fontSize: 12, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{it.issueDate}</span>
                                      <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, marginLeft: 'auto' }}>{fmt2(it.grossTotal)} PLN</span>
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
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
