import { useState, useEffect, useRef } from 'react';
import { Ico } from '../components/ui/icons';
import { TransactionsService } from '../services/graphService';
import { addListItem } from '../services/graphService';

function fmt(n: number) {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Row = { date: string; title: string; amount: number; balance: number; dir: 'in' | 'out'; };

// Parser CSV Alior Bank (format 11 kolumn)
function parseAliorCSV(text: string): Row[] {
  const lines = text.split('\n').filter(l => l.trim());
  const rows: Row[] = [];
  for (const line of lines) {
    const cols = line.split(';').map(c => c.replace(/"/g, '').trim());
    if (cols.length < 6) continue;
    const dateStr = cols[0]; // DD-MM-YYYY lub YYYY-MM-DD
    if (!/\d{2}/.test(dateStr)) continue;
    const amountStr = cols[4]?.replace(/\s/g, '').replace(',', '.') || '0';
    const balanceStr = cols[5]?.replace(/\s/g, '').replace(',', '.') || '0';
    const amount = parseFloat(amountStr) || 0;
    const balance = parseFloat(balanceStr) || 0;
    // Konwertuj datę DD-MM-YYYY → YYYY-MM-DD
    const parts = dateStr.includes('-') ? dateStr.split('-') : dateStr.split('.');
    const date = parts.length === 3
      ? (parts[0].length === 4 ? dateStr : `${parts[2]}-${parts[1]}-${parts[0]}`)
      : dateStr;
    const title = cols[1] || cols[2] || '';
    rows.push({ date, title, amount, balance, dir: amount >= 0 ? 'in' : 'out' });
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export default function Bank() {
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = () => {
    setLoading(true);
    TransactionsService.getAll()
      .then((items: any[]) => {
        const mapped: Row[] = items.map(item => {
          const f = item.fields || {};
          const amount = f.Amount ?? 0;
          const type = (f.TransactionType || '').toLowerCase();
          return {
            date: (f.TransactionDate || '').split('T')[0],
            title: f.Description || '',
            amount,
            balance: f.Balance ?? 0,
            dir: (type === 'credit' || amount > 0) ? 'in' : 'out',
          };
        });
        mapped.sort((a, b) => b.date.localeCompare(a.date));
        setRows(mapped);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    return (!q || r.title.toLowerCase().includes(q)) &&
           (!from || r.date >= from) &&
           (!to || r.date <= to);
  });

  const balance   = rows[0]?.balance ?? 0;
  const inflow    = rows.filter(r => r.dir === 'in').reduce((s, r) => s + Math.abs(r.amount), 0);
  const outflow   = rows.filter(r => r.dir === 'out').reduce((s, r) => s + Math.abs(r.amount), 0);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportMsg('');
    try {
      const text = await file.text();
      const parsed = parseAliorCSV(text);
      if (!parsed.length) { setImportMsg('Nie rozpoznano formatu CSV'); return; }
      let ok = 0;
      for (const r of parsed) {
        await addListItem('Finance Transactions', {
          TransactionDate: r.date + 'T00:00:00Z',
          Description: r.title,
          Amount: r.amount,
          Balance: r.balance,
          TransactionType: r.dir === 'in' ? 'credit' : 'debit',
          BankAccount: 'firmowy',
        });
        ok++;
      }
      setImportMsg(`✓ Zaimportowano ${ok} transakcji`);
      reload();
    } catch (err: any) {
      setImportMsg('Błąd importu: ' + err.message);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }

  function handleExport() {
    const header = 'Data;Tytuł;Kwota;Saldo\n';
    const csv = header + filtered.map(r =>
      `${r.date};"${r.title}";${r.amount};${r.balance}`
    ).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bank-firmowy-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {/* Nagłówek */}
      <div className="page-h">
        <div>
          <h1>Bank firmowy</h1>
          <div className="page-sub">Rachunek bieżący · mBank · PL 10 1140 2004 0000 3002 0000 0001</div>
        </div>
        <div className="page-actions">
          <label className={`btn btn-secondary${importing ? ' disabled' : ''}`} style={{ cursor: 'pointer' }}>
            <Ico name="Upload" size={15} />
            {importing ? 'Importuję…' : 'Importuj CSV'}
            <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleImport} disabled={importing} />
          </label>
          <button className="btn btn-secondary" onClick={handleExport}>
            <Ico name="Download" size={15} /> Eksportuj
          </button>
        </div>
      </div>

      {importMsg && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600,
          background: importMsg.startsWith('✓') ? 'var(--lf-green-100)' : 'var(--lf-danger-bg)',
          color: importMsg.startsWith('✓') ? 'var(--lf-green-900)' : 'var(--lf-danger)' }}>
          {importMsg}
        </div>
      )}

      {/* KPI */}
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <div className="kpi" style={{ background: 'var(--lf-navy-900)', borderColor: 'var(--lf-navy-900)' }}>
          <div className="label" style={{ color: 'var(--fg-on-dark-2)' }}>
            <span className="ico" style={{ color: 'var(--fg-on-dark-2)' }}><Ico name="Bank" size={15} /></span>
            Saldo bieżące
          </div>
          <div className="value" style={{ color: '#fff', fontSize: 28 }}>
            {loading ? '…' : fmt(balance)}
            <span className="unit" style={{ color: 'var(--fg-on-dark-2)' }}> PLN</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg-on-dark-2)', fontFamily: 'var(--font-mono)' }}>
            {rows[0]?.date || '—'}
          </div>
        </div>
        <div className="kpi">
          <div className="label"><span className="ico"><Ico name="TrendUp" size={15} /></span>Wpływy (łącznie)</div>
          <div className="value" style={{ color: 'var(--lf-green)' }}>{fmt(inflow)}<span className="unit"> PLN</span></div>
        </div>
        <div className="kpi">
          <div className="label"><span className="ico"><Ico name="TrendDown" size={15} /></span>Wydatki (łącznie)</div>
          <div className="value" style={{ color: 'var(--lf-danger)' }}>{fmt(outflow)}<span className="unit"> PLN</span></div>
        </div>
        <div className="kpi">
          <div className="label"><span className="ico"><Ico name="Activity" size={15} /></span>Transakcji</div>
          <div className="value">{rows.length}<span className="unit"> szt.</span></div>
        </div>
      </div>

      {/* Filtry + tabela */}
      <div className="card">
        <div className="card-head">
          <div><h3>Transakcje</h3></div>
          <span style={{ fontSize: 12, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{filtered.length} rekordów</span>
        </div>
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <div className="filterbar" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--lf-slate-50)', border: '1px solid var(--border-1)', borderRadius: 8, padding: '6px 12px', flex: 1 }}>
              <Ico name="Search" size={14} style={{ color: 'var(--fg-3)', flexShrink: 0 }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Szukaj…"
                style={{ border: 'none', outline: 'none', fontSize: 13, background: 'transparent', width: '100%' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <span style={{ color: 'var(--fg-3)' }}>Od</span>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input" style={{ width: 150, fontSize: 13 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <span style={{ color: 'var(--fg-3)' }}>Do</span>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input" style={{ width: 150, fontSize: 13 }} />
            </div>
            {(search || from || to) && (
              <button className="btn btn-secondary" onClick={() => { setSearch(''); setFrom(''); setTo(''); }}>
                <Ico name="X" size={14} /> Wyczyść
              </button>
            )}
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tytuł</th>
                <th style={{ textAlign: 'right' }}>Kwota</th>
                <th style={{ textAlign: 'right' }}>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)' }}>Ładowanie…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)' }}>Brak transakcji</td></tr>
              ) : filtered.map((r, i) => (
                <tr key={i}>
                  <td className="mono" style={{ fontSize: 12, color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>{r.date}</td>
                  <td style={{ maxWidth: 500 }}>{r.title}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700,
                    color: r.dir === 'in' ? 'var(--lf-green)' : 'var(--lf-danger)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Ico name={r.dir === 'in' ? 'TrendUp' : 'TrendDown'} size={13} />
                      {r.dir === 'in' ? '+' : ''}{fmt(r.amount)}
                    </span>
                  </td>
                  <td className="mono" style={{ textAlign: 'right', fontSize: 13, color: 'var(--fg-3)' }}>{fmt(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 0 && (
            <div className="pager">
              <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{filtered.length} z {rows.length} transakcji</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
