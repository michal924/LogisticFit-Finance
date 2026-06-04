import { useState, useEffect } from 'react';
import { Ico } from '../components/ui/icons';
import { PrivateTransactionsService } from '../services/graphService';

function fmt(n: number) {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type AccountId = 'cash' | 'home' | 'savings' | 'tarnogrod';

const ACCOUNTS: { id: AccountId; label: string; bank: string }[] = [
  { id: 'cash',      label: 'Gotówka',     bank: 'Portfel / Kasa' },
  { id: 'home',      label: 'Dom',          bank: 'PKO BP · PL 61 1020 5226' },
  { id: 'savings',   label: 'Oszczędności', bank: 'ING · PL 20 1050 1025' },
  { id: 'tarnogrod', label: 'Tarnogród',    bank: 'Konto lokalne' },
];

type Txn = { date: string; title: string; contractor: string; amount: number; balance: number; dir: 'in' | 'out' };

export default function BankPrywatny() {
  const [selected, setSelected] = useState<AccountId>('home');
  const [allTxns, setAllTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    PrivateTransactionsService.getAll()
      .then((items: any[]) => setAllTxns(items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function getTxnsForAccount(accountId: AccountId): Txn[] {
    return allTxns
      .filter(item => {
        const acc = (item.fields?.Account || '').toLowerCase();
        return acc === accountId;
      })
      .map(item => {
        const f = item.fields || {};
        const amount = f.Amount ?? 0;
        const type = (f.TransactionType || '').toLowerCase();
        const dir: 'in' | 'out' = (type === 'credit' || amount > 0) ? 'in' : 'out';
        return {
          date: (f.TransactionDate || '').split('T')[0],
          title: f.Description || '',
          contractor: f.Contractor || '',
          amount,
          balance: f.Balance ?? 0,
          dir,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  function getBalanceForAccount(accountId: AccountId): number {
    const txns = getTxnsForAccount(accountId);
    return txns[0]?.balance ?? 0;
  }

  const acct = ACCOUNTS.find(a => a.id === selected)!;
  const rows = getTxnsForAccount(selected);

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
          <h1 className="page-h">Bank prywatny</h1>
          <p className="page-sub">Konta osobiste i oszczędnościowe</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary"><Ico name="Download" size={15} /> Eksportuj</button>
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: '1.5rem' }}>
        {ACCOUNTS.map(a => (
          <div
            key={a.id}
            className="card"
            style={{
              cursor: 'pointer',
              border: selected === a.id ? '2px solid var(--navy-900)' : '2px solid transparent',
              transition: 'border-color 0.15s',
            }}
            onClick={() => setSelected(a.id)}
          >
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>{a.label}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{a.bank}</div>
                </div>
                {selected === a.id && <Ico name="CheckCircle" size={18} style={{ color: 'var(--navy-900)' }} />}
              </div>
              <div style={{ marginTop: '0.75rem', fontFamily: 'var(--font-mono)', fontSize: '1.15rem', fontWeight: 700 }}>
                {fmt(getBalanceForAccount(a.id))} <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--muted)' }}>PLN</span>
              </div>
              <div style={{ marginTop: '0.75rem' }}>
                <button
                  className="btn"
                  style={{ fontSize: '0.75rem', color: 'var(--red, #e53e3e)', borderColor: 'var(--red, #e53e3e)' }}
                  onClick={e => { e.stopPropagation(); }}
                >
                  <Ico name="Trash" size={13} /> Wyczyść konto
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-head">
          <span>Transakcje · {acct.label}</span>
          <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>{rows.length} rekordów</span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tytuł</th>
                  <th>Kontrahent</th>
                  <th style={{ textAlign: 'right' }}>Kwota</th>
                  <th style={{ textAlign: 'right' }}>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="empty">Brak transakcji dla tego konta</td></tr>
                )}
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)', fontSize: '0.82rem' }}>{r.date}</td>
                    <td>{r.title}</td>
                    <td style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{r.contractor}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
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
