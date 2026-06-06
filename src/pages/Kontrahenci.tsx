import { useState, useEffect } from 'react';
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

type Filter = 'Wszystkie' | Role;
const FILTERS: Filter[] = ['Wszystkie', 'Klient', 'Dostawca', 'Oba'];

type Contractor = {
  name: string;
  nip: string;
  role: Role;
  initials: string;
  invoices: number;
  totalNet: number;
  totalGross: number;
};

export default function Kontrahenci() {
  const { context } = useOutletContext<{ context: string }>();
  const [filter, setFilter] = useState<Filter>('Wszystkie');
  const [search, setSearch] = useState('');
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // Kontrahenci liczeni NA ŻYWO z faktur — zawsze aktualni po synchronizacji z inFakt.
    // Sprzedaż → Klient, Koszty → Dostawca, oba → Oba. Grupowanie po NIP (lub nazwie).
    Promise.all([getInvoices('sales', context), getInvoices('cost', context)])
      .then(([sales, costs]) => {
        type Agg = { name: string; nip: string; asClient: boolean; asVendor: boolean; invoices: number; totalNet: number; totalGross: number };
        const map = new Map<string, Agg>();
        const add = (inv: typeof sales[number], kind: 'sales' | 'cost') => {
          const name = (inv.counterparty || '').trim();
          const nip = (inv.nip || '').trim();
          if (!name && !nip) return;
          const key = nip || name.toLowerCase();
          let a = map.get(key);
          if (!a) { a = { name, nip, asClient: false, asVendor: false, invoices: 0, totalNet: 0, totalGross: 0 }; map.set(key, a); }
          if (!a.name && name) a.name = name;
          if ((!a.nip || a.nip === '—') && nip) a.nip = nip;
          if (kind === 'sales') a.asClient = true; else a.asVendor = true;
          a.invoices += 1;
          a.totalNet += inv.netTotal || 0;
          a.totalGross += inv.grossTotal || 0;
        };
        sales.forEach(i => add(i, 'sales'));
        costs.forEach(i => add(i, 'cost'));
        const mapped: Contractor[] = Array.from(map.values()).map(a => {
          const role: Role = a.asClient && a.asVendor ? 'Oba' : a.asVendor ? 'Dostawca' : 'Klient';
          return {
            name: a.name,
            nip: a.nip || '—',
            role,
            initials: a.name.split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '??',
            invoices: a.invoices,
            totalNet: a.totalNet,
            totalGross: a.totalGross,
          };
        });
        mapped.sort((a, b) => b.totalGross - a.totalGross);
        setContractors(mapped);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [context]);

  const rows = contractors.filter(c => {
    const matchRole = filter === 'Wszystkie' || c.role === filter;
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
          <button className="btn btn-primary"><Ico name="Plus" size={15} /> Nowy kontrahent</button>
          <button className="btn btn-secondary"><Ico name="Download" size={15} /> Eksportuj</button>
        </div>
      </div>

      <div className="card">
        <div className="filterbar">
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {FILTERS.map(f => (
              <button
                key={f}
                className={`chip${filter === f ? ' active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <div style={{ position: 'relative', flex: 1, maxWidth: '280px' }}>
            <Ico name="Search" size={15} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
            <input
              className="search-input"
              style={{ paddingLeft: '2rem', width: '100%' }}
              placeholder="Szukaj kontrahenta…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
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
                {rows.map((c, i) => (
                  <tr key={i}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: 'var(--navy-100, #e8edf7)', color: 'var(--navy-800)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: '0.7rem', flexShrink: 0,
                        }}>{c.initials}</div>
                        <span style={{ fontWeight: 500 }}>{c.name}</span>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--fg-3)' }}>{c.nip}</td>
                    <td>
                      <span className="badge" style={{ background: `${ROLE_COLORS[c.role]}20`, color: ROLE_COLORS[c.role], border: `1px solid ${ROLE_COLORS[c.role]}40` }}>
                        {c.role}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{c.invoices}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmt(c.totalNet)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmt(c.totalGross)}</td>
                    <td>
                      <button className="btn" style={{ padding: '0.25rem 0.5rem' }}><Ico name="Eye" size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
