import { useState } from 'react';
import { Ico } from '../components/ui/icons';

type Role = 'Klient' | 'Dostawca' | 'Oba';

const CONTRACTORS: { name: string; nip: string; role: Role; initials: string; invoices: number; turnover: number; lastDoc: string }[] = [
  { name: 'Pol-Trans Sp. z o.o.',       nip: '123-456-78-90', role: 'Klient',   initials: 'PT', invoices: 24, turnover: 287400, lastDoc: '2026-06-02' },
  { name: 'LogiGroup S.A.',             nip: '987-654-32-10', role: 'Klient',   initials: 'LG', invoices: 18, turnover: 198600, lastDoc: '2026-06-01' },
  { name: 'TechDist Polska Sp. z o.o.', nip: '456-789-01-23', role: 'Oba',      initials: 'TD', invoices: 31, turnover: 156800, lastDoc: '2026-05-31' },
  { name: 'Cargo Express',              nip: '321-098-76-54', role: 'Klient',   initials: 'CE', invoices: 12, turnover: 142300, lastDoc: '2026-05-29' },
  { name: 'MedLogistics Sp. z o.o.',    nip: '654-321-09-87', role: 'Klient',   initials: 'ML', invoices: 9,  turnover: 98700,  lastDoc: '2026-05-27' },
  { name: 'PKN Orlen S.A.',             nip: '777-00-33-382', role: 'Dostawca', initials: 'OR', invoices: 48, turnover: 74200,  lastDoc: '2026-06-02' },
  { name: 'Biuro Premium Sp. z o.o.',   nip: '556-123-44-11', role: 'Dostawca', initials: 'BP', invoices: 14, turnover: 54000,  lastDoc: '2026-06-01' },
  { name: 'Microsoft Ireland Ltd.',     nip: 'EU-826-012-448',role: 'Dostawca', initials: 'MS', invoices: 6,  turnover: 14760,  lastDoc: '2026-05-30' },
];

const ROLE_COLORS: Record<Role, string> = {
  Klient:   'var(--green-600)',
  Dostawca: 'var(--navy-600, #2d4a8c)',
  Oba:      'var(--amber, #d97706)',
};

function fmt(n: number) {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

type Filter = 'Wszystkie' | Role;
const FILTERS: Filter[] = ['Wszystkie', 'Klient', 'Dostawca', 'Oba'];

export default function Kontrahenci() {
  const [filter, setFilter] = useState<Filter>('Wszystkie');
  const [search, setSearch] = useState('');

  const rows = CONTRACTORS.filter(c => {
    const matchRole = filter === 'Wszystkie' || c.role === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || c.nip.includes(q);
    return matchRole && matchSearch;
  });

  return (
    <div className="page-content">
      <div className="page-head">
        <div>
          <h1 className="page-h">Kontrahenci</h1>
          <p className="page-sub">{CONTRACTORS.length} kontrahentów w bazie</p>
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
                  <th style={{ textAlign: 'right' }}>Obrót (PLN)</th>
                  <th>Ostatni dok.</th>
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
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--muted)' }}>{c.nip}</td>
                    <td>
                      <span className="badge" style={{ background: `${ROLE_COLORS[c.role]}20`, color: ROLE_COLORS[c.role], border: `1px solid ${ROLE_COLORS[c.role]}40` }}>
                        {c.role}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{c.invoices}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmt(c.turnover)}</td>
                    <td style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{c.lastDoc}</td>
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
