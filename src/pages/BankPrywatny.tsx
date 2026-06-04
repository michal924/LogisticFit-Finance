import { useState } from 'react';
import { Ico } from '../components/ui/icons';

function fmt(n: number) {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Account = 'gotowka' | 'dom' | 'oszczednosci' | 'tarnograd';

const ACCOUNTS: { id: Account; label: string; balance: number; bank: string }[] = [
  { id: 'gotowka',     label: 'Gotówka',     balance: 3200.00,   bank: 'Portfel / Kasa' },
  { id: 'dom',         label: 'Dom',          balance: 18450.00,  bank: 'PKO BP · PL 61 1020 5226' },
  { id: 'oszczednosci',label: 'Oszczędności', balance: 87300.00,  bank: 'ING · PL 20 1050 1025' },
  { id: 'tarnograd',   label: 'Tarnogród',    balance: 5600.00,   bank: 'Konto lokalne' },
];

type Txn = { date: string; title: string; contractor: string; amount: number; balance: number; dir: 'in' | 'out' };

const DATA: Record<Account, Txn[]> = {
  gotowka: [
    { date: '2026-06-02', title: 'Wypłata ATM', contractor: 'PKO BP ATM', amount: -500.00, balance: 3200.00, dir: 'out' },
    { date: '2026-05-28', title: 'Zakupy spożywcze', contractor: 'Biedronka', amount: -142.30, balance: 3700.00, dir: 'out' },
    { date: '2026-05-25', title: 'Wypłata ATM', contractor: 'Santander ATM', amount: -300.00, balance: 3842.30, dir: 'out' },
    { date: '2026-05-20', title: 'Depozyt gotówki', contractor: 'Własny', amount: 800.00, balance: 4142.30, dir: 'in' },
  ],
  dom: [
    { date: '2026-06-01', title: 'Czynsz za czerwiec', contractor: 'Spółdzielnia Mieszkaniowa', amount: -1200.00, balance: 18450.00, dir: 'out' },
    { date: '2026-05-30', title: 'Prąd – maj 2026', contractor: 'PGE Obrót S.A.', amount: -287.50, balance: 19650.00, dir: 'out' },
    { date: '2026-05-29', title: 'Gaz – maj 2026', contractor: 'PGNiG Obrót', amount: -183.20, balance: 19937.50, dir: 'out' },
    { date: '2026-05-25', title: 'Wynagrodzenie', contractor: 'LogisticFit Sp. z o.o.', amount: 8500.00, balance: 20120.70, dir: 'in' },
    { date: '2026-05-22', title: 'Internet domowy', contractor: 'UPC Polska', amount: -89.00, balance: 11620.70, dir: 'out' },
    { date: '2026-05-20', title: 'Ubezpieczenie mieszkania', contractor: 'Allianz Polska', amount: -320.00, balance: 11709.70, dir: 'out' },
  ],
  oszczednosci: [
    { date: '2026-06-01', title: 'Przelew z konta Dom', contractor: 'Własny', amount: 2000.00, balance: 87300.00, dir: 'in' },
    { date: '2026-05-01', title: 'Przelew z konta Dom', contractor: 'Własny', amount: 2000.00, balance: 85300.00, dir: 'in' },
    { date: '2026-04-01', title: 'Przelew z konta Dom', contractor: 'Własny', amount: 2000.00, balance: 83300.00, dir: 'in' },
    { date: '2026-03-15', title: 'Odsetki od lokaty', contractor: 'ING Bank Śląski', amount: 412.50, balance: 81300.00, dir: 'in' },
    { date: '2026-03-01', title: 'Przelew z konta Dom', contractor: 'Własny', amount: 2000.00, balance: 80887.50, dir: 'in' },
  ],
  tarnograd: [
    { date: '2026-05-30', title: 'Wypłata', contractor: 'Tarnogród ATM', amount: -200.00, balance: 5600.00, dir: 'out' },
    { date: '2026-05-15', title: 'Przelew przychodzący', contractor: 'Własny', amount: 1000.00, balance: 5800.00, dir: 'in' },
    { date: '2026-04-30', title: 'Opłaty lokalne', contractor: 'Gmina Tarnogród', amount: -150.00, balance: 4800.00, dir: 'out' },
    { date: '2026-04-15', title: 'Przelew przychodzący', contractor: 'Własny', amount: 500.00, balance: 4950.00, dir: 'in' },
  ],
};

export default function BankPrywatny() {
  const [selected, setSelected] = useState<Account>('dom');

  const rows = DATA[selected];
  const acct = ACCOUNTS.find(a => a.id === selected)!;

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
                {fmt(a.balance)} <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--muted)' }}>PLN</span>
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
