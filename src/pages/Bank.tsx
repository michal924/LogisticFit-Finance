import { useState } from 'react';
import { Ico } from '../components/ui/icons';
import { TransactionsService } from '../services/graphService';

void TransactionsService; // imported but using placeholder data

function fmt(n: number) {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const ROWS = [
  { date: '2026-06-03', title: 'Przelew przychodzący – LogiGroup S.A.', contractor: 'LogiGroup S.A.', invoice: 'FV/2026/089', amount: 14760.00, balance: 214800.00, dir: 'in' },
  { date: '2026-06-02', title: 'Opłata za paliwo – ORLEN', contractor: 'PKN Orlen S.A.', invoice: 'FC/2026/041', amount: -3200.00, balance: 200040.00, dir: 'out' },
  { date: '2026-06-02', title: 'Przelew – Pol-Trans Sp. z o.o.', contractor: 'Pol-Trans Sp. z o.o.', invoice: 'FV/2026/088', amount: 22140.00, balance: 203240.00, dir: 'in' },
  { date: '2026-06-01', title: 'Wynajem biura – maj 2026', contractor: 'Biuro Premium Sp. z o.o.', invoice: 'FC/2026/038', amount: -4500.00, balance: 181100.00, dir: 'out' },
  { date: '2026-05-31', title: 'Przelew – TechDist Polska', contractor: 'TechDist Polska', invoice: 'FV/2026/085', amount: 9840.00, balance: 185600.00, dir: 'in' },
  { date: '2026-05-30', title: 'Abonament Microsoft 365', contractor: 'Microsoft Ireland', invoice: 'FC/2026/035', amount: -1230.00, balance: 175760.00, dir: 'out' },
  { date: '2026-05-29', title: 'Przelew – Cargo Express', contractor: 'Cargo Express', invoice: 'FV/2026/082', amount: 18500.00, balance: 176990.00, dir: 'in' },
  { date: '2026-05-28', title: 'ZUS – składki', contractor: 'Zakład Ubezpieczeń Społ.', invoice: '—', amount: -4200.00, balance: 158490.00, dir: 'out' },
  { date: '2026-05-27', title: 'Przelew – MedLogistics', contractor: 'MedLogistics', invoice: 'FV/2026/079', amount: 11200.00, balance: 162690.00, dir: 'in' },
  { date: '2026-05-26', title: 'Usługi telekomunikacyjne – T-Mobile', contractor: 'T-Mobile Polska S.A.', invoice: 'FC/2026/032', amount: -890.00, balance: 151490.00, dir: 'out' },
  { date: '2026-05-23', title: 'Przelew – LogiGroup S.A.', contractor: 'LogiGroup S.A.', invoice: 'FV/2026/076', amount: 16300.00, balance: 152380.00, dir: 'in' },
  { date: '2026-05-22', title: 'Podatek VAT – kwiecień 2026', contractor: 'Urząd Skarbowy', invoice: '—', amount: -18200.00, balance: 136080.00, dir: 'out' },
  { date: '2026-05-21', title: 'Przelew – Pol-Trans Sp. z o.o.', contractor: 'Pol-Trans Sp. z o.o.', invoice: 'FV/2026/073', amount: 24500.00, balance: 154280.00, dir: 'in' },
  { date: '2026-05-20', title: 'Leasing samochód – maj', contractor: 'Santander Leasing S.A.', invoice: 'FC/2026/029', amount: -2800.00, balance: 129780.00, dir: 'out' },
  { date: '2026-05-19', title: 'Przelew – TechDist Polska', contractor: 'TechDist Polska', invoice: 'FV/2026/070', amount: 8900.00, balance: 132580.00, dir: 'in' },
  { date: '2026-05-16', title: 'Opłata za paliwo – ORLEN', contractor: 'PKN Orlen S.A.', invoice: 'FC/2026/027', amount: -2750.00, balance: 123680.00, dir: 'out' },
  { date: '2026-05-15', title: 'Przelew – Cargo Express', contractor: 'Cargo Express', invoice: 'FV/2026/067', amount: 12600.00, balance: 126430.00, dir: 'in' },
  { date: '2026-05-14', title: 'Wynajem magazynu – kwiecień', contractor: 'MagPro Logistics', invoice: 'FC/2026/025', amount: -3800.00, balance: 113830.00, dir: 'out' },
  { date: '2026-05-13', title: 'Przelew – MedLogistics', contractor: 'MedLogistics', invoice: 'FV/2026/064', amount: 9100.00, balance: 117630.00, dir: 'in' },
  { date: '2026-05-12', title: 'Ubezpieczenie floty', contractor: 'PZU S.A.', invoice: 'FC/2026/023', amount: -5600.00, balance: 108530.00, dir: 'out' },
];

export default function Bank() {
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const filtered = ROWS.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.title.toLowerCase().includes(q) || r.contractor.toLowerCase().includes(q) || r.invoice.toLowerCase().includes(q);
    const matchFrom = !from || r.date >= from;
    const matchTo = !to || r.date <= to;
    return matchSearch && matchFrom && matchTo;
  });

  const inflow = ROWS.filter(r => r.dir === 'in').reduce((s, r) => s + r.amount, 0);
  const outflow = Math.abs(ROWS.filter(r => r.dir === 'out').reduce((s, r) => s + r.amount, 0));
  const unmatched = ROWS.filter(r => r.invoice === '—').length;

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
          <div className="value" style={{ color: '#fff', fontSize: '1.6rem' }}>{fmt(214800.00)} <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>PLN</span></div>
          <div className="delta" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem' }}>Stan na 2026-06-03</div>
        </div>
        <div className="kpi">
          <div className="label"><span className="ico"><Ico name="TrendUp" size={15} /></span>Wpływy (miesiąc)</div>
          <div className="value" style={{ color: 'var(--green-600)' }}>{fmt(inflow)} <span className="unit">PLN</span></div>
        </div>
        <div className="kpi">
          <div className="label"><span className="ico"><Ico name="TrendDown" size={15} /></span>Wydatki (miesiąc)</div>
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
