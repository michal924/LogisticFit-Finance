import { useState, useEffect } from 'react';
import { Ico } from '../components/ui/icons';
import { TransactionsService } from '../services/graphService';

function fmt(n: number) {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Row = {
  date: string;
  title: string;
  contractor: string;
  invoice: string;
  amount: number;
  balance: number;
  dir: 'in' | 'out';
};

export default function Bank() {
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    TransactionsService.getAll()
      .then((items: any[]) => {
        const mapped: Row[] = items.map(item => {
          const f = item.fields || {};
          const amount = f.Amount ?? 0;
          const type = (f.TransactionType || '').toLowerCase();
          const dir: 'in' | 'out' = (type === 'credit' || amount > 0) ? 'in' : 'out';
          return {
            date: (f.TransactionDate || '').split('T')[0],
            title: f.Description || '',
            contractor: f.Contractor || '',
            invoice: f.InvoiceRef || '—',
            amount,
            balance: f.Balance ?? 0,
            dir,
          };
        });
        // Sort by date descending
        mapped.sort((a, b) => b.date.localeCompare(a.date));
        setRows(mapped);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.title.toLowerCase().includes(q) || r.contractor.toLowerCase().includes(q) || r.invoice.toLowerCase().includes(q);
    const matchFrom = !from || r.date >= from;
    const matchTo = !to || r.date <= to;
    return matchSearch && matchFrom && matchTo;
  });

  const balance = rows[0]?.balance ?? 0;
  const balanceDate = rows[0]?.date ?? '';
  const inflow = rows.filter(r => r.dir === 'in').reduce((s, r) => s + Math.abs(r.amount), 0);
  const outflow = rows.filter(r => r.dir === 'out').reduce((s, r) => s + Math.abs(r.amount), 0);
  const unmatched = rows.filter(r => r.invoice === '—').length;

  if (loading) {
    return (
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, flexDirection: 'column', gap: 12 }}>
        <div className="spinner" />
        <span style={{ color: 'var(--muted)', fontSize: 14 }}>Ładowanie transakcji…</span>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-head">
        <div>
          <h1 className="page-h">Bank firmowy</h1>
          <p className="page-sub">Rachunek bieżący · mBank · PL 10 1140 2004 0000 3002 0000 0001</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary"><Ico name="Upload" size={15} /> Import CSV</button>
          <button className="btn btn-secondary"><Ico name="Download" size={15} /> Eksportuj</button>
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: '1.5rem' }}>
        <div className="kpi" style={{ background: 'var(--navy-900)', color: '#fff', gridColumn: 'span 1' }}>
          <div className="label" style={{ color: 'rgba(255,255,255,0.6)' }}>Saldo bieżące</div>
          <div className="value" style={{ color: '#fff', fontSize: '1.6rem' }}>{fmt(balance)} <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>PLN</span></div>
          <div className="delta" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem' }}>Stan na {balanceDate || '—'}</div>
        </div>
        <div className="kpi">
          <div className="label"><span className="ico"><Ico name="TrendUp" size={15} /></span>Wpływy (łącznie)</div>
          <div className="value" style={{ color: 'var(--green-600)' }}>{fmt(inflow)} <span className="unit">PLN</span></div>
        </div>
        <div className="kpi">
          <div className="label"><span className="ico"><Ico name="TrendDown" size={15} /></span>Wydatki (łącznie)</div>
          <div className="value" style={{ color: 'var(--red, #e53e3e)' }}>{fmt(outflow)} <span className="unit">PLN</span></div>
        </div>
        <div className="kpi">
          <div className="label"><span className="ico"><Ico name="AlertTriangle" size={15} /></span>Niepowiązane</div>
          <div className="value">{unmatched}</div>
          <div className="delta" data-dir="down">transakcje bez FV</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span>Transakcje</span>
          <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>{rows.length} rekordów</span>
        </div>
        <div className="filterbar">
          <div style={{ position: 'relative', flex: 1 }}>
            <Ico name="Search" size={15} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
            <input
              className="search-input"
              style={{ paddingLeft: '2rem', width: '100%' }}
              placeholder="Szukaj transakcji…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--muted)' }}>
            Od <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ fontSize: '0.82rem' }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--muted)' }}>
            Do <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ fontSize: '0.82rem' }} />
          </label>
          {(search || from || to) && (
            <button className="btn" onClick={() => { setSearch(''); setFrom(''); setTo(''); }}>
              <Ico name="X" size={14} /> Wyczyść
            </button>
          )}
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tytuł</th>
                  <th>Kontrahent</th>
                  <th>Powiązana FV</th>
                  <th style={{ textAlign: 'right' }}>Kwota</th>
                  <th style={{ textAlign: 'right' }}>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="empty">Brak wyników dla podanych filtrów</td></tr>
                )}
                {filtered.map((r, i) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)', fontSize: '0.82rem' }}>{r.date}</td>
                    <td>{r.title}</td>
                    <td style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{r.contractor}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>{r.invoice}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }} data-dir={r.dir}>
                      <span style={{ color: r.dir === 'in' ? 'var(--green-600)' : 'var(--red, #e53e3e)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.2rem' }}>
                        <Ico name={r.dir === 'in' ? 'TrendUp' : 'TrendDown'} size={13} />
                        {r.dir === 'in' ? '+' : ''}{fmt(r.amount)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--muted)' }}>{fmt(r.balance)}</td>
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
