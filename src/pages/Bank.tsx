import { useState, useEffect, useRef, Fragment } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Ico } from '../components/ui/icons';
import { TransactionsService, addListItem, filterByContext } from '../services/graphService';

function fmt(n: number) {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Liczba w formacie polskim: "-16,00", "1 000,00" → number
function plNum(s: string): number {
  const c = (s || '').replace(/[\s ]/g, '').replace(',', '.');
  const n = parseFloat(c);
  return isNaN(n) ? 0 : n;
}

// Nazwa właściciela rachunku (firmowy) — pomijana jako "kontrahent"
const OWNER_RE = /LogisticFit/i;

function deriveKind(d: string): string {
  const s = (d || '').toLowerCase();
  if (s.includes('pobranie opłaty') || s.includes('prowizj') || s.includes('prowadzenie rachunku') || s.includes('opł. za') || s.includes('opłata za')) return 'Opłata / prowizja';
  if (s.includes('płatność kartą') || s.includes('platnosc karta')) return 'Płatność kartą';
  if (s.includes('wpłatomat') || s.includes('wpłata gotówk') || s.includes('wpłata własna')) return 'Wpłata gotówki';
  if (s.includes('wypłata') || s.includes('bankomat')) return 'Wypłata gotówki';
  if (s.includes('zus') || s.includes('us-') || s.includes('urząd skarb') || s.includes('/vat/')) return 'ZUS / US / VAT';
  if (s.includes('przelew')) return 'Przelew';
  return 'Płatność';
}

type Row = { id?: string; date: string; title: string; counterparty: string; amount: number; balance: number; kind: string; dir: 'in' | 'out'; account?: string; ref?: string; };

// Parser CSV Alior Bank — kolumny:
// 0:Data transakcji 1:Data księgowania 2:Nadawca 3:Odbiorca 4:Szczegóły 5:Kwota operacji 6:Waluta ...
function parseAliorCSV(text: string): Row[] {
  const lines = text.split(/\r?\n/);
  const rows: Row[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.split(';').map(c => c.replace(/^"|"$/g, '').trim());
    // tylko wiersze danych: kol[0] = data DD-MM-YYYY (pomija "Kryteria…" i nagłówek)
    if (!/^\d{2}-\d{2}-\d{4}$/.test(cols[0] || '')) continue;
    const [dd, mm, yyyy] = cols[0].split('-');
    const date = `${yyyy}-${mm}-${dd}`;
    const sender = cols[2] || '';
    const receiver = cols[3] || '';
    const details = cols[4] || '';
    const amount = plNum(cols[5] || '');
    const dir: 'in' | 'out' = amount < 0 ? 'out' : 'in';
    const other = dir === 'out' ? receiver : sender;
    const counterparty = (other && !OWNER_RE.test(other)) ? other : '';
    let title = details || counterparty || receiver || sender || '—';
    if (counterparty && !title.includes(counterparty)) title = `${title} · ${counterparty}`;
    rows.push({ date, title, counterparty, amount, balance: 0, kind: deriveKind(details), dir, account: 'firmowy', ref: '' });
  }
  return rows;
}

// Parser ING — eksport XML (ISO 20022 / CAMT.052 „Historia operacji").
// Kwoty zawsze dodatnie; kierunek z <CdtDbtInd> (CRDT=wpływ, DBIT=wydatek).
// Kontrahent: przy wpływie <Dbtr>, przy wydatku <Cdtr>; tytuł z <RmtInf><Ustrd>.
// Brak salda w pliku → liczone narastająco przy odczycie. <TxId> = unikalny ref (dedup).
function parseINGXml(text: string): Row[] {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) return [];
  const t = (el: Element | null | undefined) => (el?.textContent || '').trim();
  const first = (parent: Element | Document, tag: string) => parent.getElementsByTagName(tag)[0] as Element | undefined;

  const iban = t(first(doc, 'IBAN')).replace(/\s/g, '');
  const account = iban ? iban.slice(-4) : 'ING';
  const rows: Row[] = [];

  for (const ntry of Array.from(doc.getElementsByTagName('Ntry'))) {
    const amt = Math.abs(plNum(t(first(ntry, 'Amt'))));
    if (!amt) continue;
    const dir: 'in' | 'out' = t(first(ntry, 'CdtDbtInd')) === 'DBIT' ? 'out' : 'in';
    const amount = dir === 'out' ? -amt : amt;

    const bookg = first(ntry, 'BookgDt');
    const dEl = bookg ? (first(bookg, 'DtTm') || first(bookg, 'Dt')) : undefined;
    const date = t(dEl).split('T')[0];
    if (!date) continue;

    // strona przeciwna: wydatek → odbiorca (Cdtr), wpływ → nadawca (Dbtr)
    const partyEl = first(ntry, dir === 'out' ? 'Cdtr' : 'Dbtr');
    let cp = partyEl ? t(first(partyEl, 'Nm')).split('|')[0].trim() : '';
    if (OWNER_RE.test(cp)) cp = '';   // własne konto/przeksięgowanie

    const ustrd = t(first(ntry, 'Ustrd'));
    const ref = t(first(ntry, 'TxId'));
    let title = ustrd || cp || '—';
    if (cp && !title.includes(cp)) title = `${title} · ${cp}`;

    rows.push({ date, title, counterparty: cp, amount, balance: 0, kind: deriveKind(title), dir, account, ref });
  }
  return rows;
}

// Wykrywa format i dekoduje (ING XML bywa w WINDOWS-1250), zwraca transakcje
function parseBankFile(buf: ArrayBuffer): Row[] {
  const utf8 = new TextDecoder('utf-8').decode(buf);
  const isXml = /^﻿?\s*<\?xml|BkToCstmrAcctRpt/.test(utf8.slice(0, 300));
  if (isXml) {
    const enc = (utf8.match(/encoding=["']([\w-]+)["']/i)?.[1] || 'utf-8').toLowerCase();
    const text = /1250/.test(enc) ? new TextDecoder('windows-1250').decode(buf) : utf8;
    return parseINGXml(text);
  }
  return parseAliorCSV(utf8);
}

export default function Bank() {
  const { context } = useOutletContext<{ context: string }>();
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = () => {
    setLoading(true); setExpanded(null);
    TransactionsService.getAll()
      .then((rawItems: any[]) => {
        const items = filterByContext(rawItems, context);
        const mapped: Row[] = items.map(item => {
          const f = item.fields || {};
          const amount = f.Amount ?? 0;
          const title = f.Description || '';
          return {
            id: item.id,
            date: (f.TransactionDate || '').split('T')[0],
            title,
            counterparty: title.includes(' · ') ? title.split(' · ').slice(1).join(' · ') : '',
            amount,
            balance: 0,
            kind: deriveKind(title),
            dir: amount < 0 ? 'out' : 'in',
            account: f.BankAccount || 'firmowy',
            ref: f.ExtRef || '',
          };
        });
        // Saldo narastająco PER KONTO (pliki banków nie zawierają salda) —
        // Spółka ma 2 rachunki ING (bieżący + VAT), więc nie mieszamy ich sald.
        const byAcct: Record<string, Row[]> = {};
        for (const r of mapped) (byAcct[r.account || 'firmowy'] ||= []).push(r);
        for (const group of Object.values(byAcct)) {
          const asc = [...group].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
          let run = 0;
          asc.forEach(r => { run += r.amount; r.balance = run; });
        }
        mapped.sort((a, b) => b.date.localeCompare(a.date));
        setRows(mapped);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [context]);

  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    return (!q || r.title.toLowerCase().includes(q)) &&
           (!from || r.date >= from) &&
           (!to || r.date <= to);
  });

  // Saldo łączne = suma sald wszystkich kont (najnowszy rekord każdego konta)
  const balance = (() => {
    const latest: Record<string, Row> = {};
    for (const r of rows) {
      const a = r.account || 'firmowy';
      if (!latest[a] || r.date > latest[a].date) latest[a] = r;
    }
    return Object.values(latest).reduce((s, r) => s + r.balance, 0);
  })();
  const inflow  = rows.filter(r => r.dir === 'in').reduce((s, r) => s + Math.abs(r.amount), 0);
  const outflow = rows.filter(r => r.dir === 'out').reduce((s, r) => s + Math.abs(r.amount), 0);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportMsg('');
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseBankFile(buf);
      if (!parsed.length) { setImportMsg('Nie rozpoznano transakcji w pliku (obsługiwane: Alior CSV, ING XML)'); return; }
      // dedup: ING ma unikalny TxId (ref); Alior bez ref → klucz data|kwota|opis
      const keyOf = (r: Row) => r.ref ? `ref:${r.ref}` : `${r.date}|${r.amount}|${r.title}`;
      const existing = new Set(rows.map(keyOf));
      let ok = 0, skip = 0;
      for (let i = 0; i < parsed.length; i++) {
        const r = parsed[i];
        const key = keyOf(r);
        if (existing.has(key)) { skip++; continue; }
        existing.add(key);
        await addListItem('Finance Transactions', {
          TransactionDate: r.date + 'T00:00:00Z',
          Description: r.title,
          Amount: r.amount,
          Balance: 0,
          TransactionType: r.dir === 'in' ? 'credit' : 'debit',
          BankAccount: r.account || 'firmowy',
          ExtRef: r.ref || '',
          Context: context,
        });
        ok++;
        if (i % 10 === 0) setImportMsg(`Importuję… ${i + 1}/${parsed.length}`);
      }
      setImportMsg(`✓ Zaimportowano ${ok} transakcji${skip ? ` · pominięto ${skip} duplikatów` : ''}`);
      reload();
    } catch (err: any) {
      setImportMsg('Błąd importu: ' + err.message);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }

  async function clearAll() {
    if (!rows.length) return;
    if (!confirm(`Usunąć wszystkie ${rows.length} transakcji banku firmowego w tym kontekście? Tej operacji nie można cofnąć.`)) return;
    setImporting(true); setImportMsg('');
    try {
      const raw = await TransactionsService.getAll();
      const mine = filterByContext(raw, context);
      let n = 0;
      for (const it of mine) {
        try { await TransactionsService.delete(it.id); n++; if (n % 10 === 0) setImportMsg(`Usuwam… ${n}/${mine.length}`); } catch { /* skip */ }
      }
      setImportMsg(`✓ Usunięto ${n} transakcji`);
      reload();
    } catch (err: any) {
      setImportMsg('Błąd czyszczenia: ' + err.message);
    } finally { setImporting(false); }
  }

  function handleExport() {
    const header = 'Data;Opis;Rodzaj;Kwota;Saldo\n';
    const csv = header + filtered.map(r => `${r.date};"${r.title}";${r.kind};${r.amount};${r.balance}`).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `bank-firmowy-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Bank firmowy</h1>
          <div className="page-sub">
            {context === 'spolka'
              ? 'Rachunek firmowy · ING Bank Śląski · import historii operacji (XML)'
              : 'Rachunek bieżący · Alior Bank · import historii operacji (CSV)'}
          </div>
        </div>
        <div className="page-actions">
          <label className={`btn btn-secondary${importing ? ' disabled' : ''}`} style={{ cursor: importing ? 'default' : 'pointer' }}>
            <Ico name="Upload" size={15} />
            {importing ? 'Pracuję…' : 'Importuj CSV'}
            <input ref={fileRef} type="file" accept=".csv,.txt,.xml" style={{ display: 'none' }} onChange={handleImport} disabled={importing} />
          </label>
          <button className="btn btn-secondary" onClick={handleExport}><Ico name="Download" size={15} /> Eksportuj</button>
          {rows.length > 0 && (
            <button className="btn btn-secondary" onClick={clearAll} disabled={importing} style={{ color: '#c8362d', borderColor: '#fecaca' }}>
              <Ico name="Trash" size={15} /> Wyczyść
            </button>
          )}
        </div>
      </div>

      {importMsg && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600,
          background: importMsg.startsWith('✓') ? 'var(--lf-green-100)' : importMsg.startsWith('Błąd') ? 'var(--lf-danger-bg)' : 'var(--lf-navy-100)',
          color: importMsg.startsWith('✓') ? 'var(--lf-green-900)' : importMsg.startsWith('Błąd') ? 'var(--lf-danger)' : 'var(--lf-navy-700)' }}>
          {importMsg}
        </div>
      )}

      {/* KPI */}
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <div className="kpi" style={{ background: 'var(--lf-navy-900)', borderColor: 'var(--lf-navy-900)' }}>
          <div className="label" style={{ color: 'var(--fg-on-dark-2)' }}>
            <span className="ico" style={{ color: 'var(--fg-on-dark-2)' }}><Ico name="Bank" size={15} /></span>
            Saldo narastająco
          </div>
          <div className="value" style={{ color: '#fff', fontSize: 26 }}>
            {loading ? '…' : fmt(balance)}<span className="unit" style={{ color: 'var(--fg-on-dark-2)' }}> PLN</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg-on-dark-2)' }}>od początku importu (CSV bez salda)</div>
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

      <div className="card">
        <div className="card-head">
          <div><h3>Transakcje</h3></div>
          <span style={{ fontSize: 12, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{filtered.length} rekordów</span>
        </div>
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <div className="filterbar" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--border)', borderRadius: 999, padding: '6px 14px', flex: 1 }}>
              <Ico name="Search" size={14} style={{ color: 'var(--fg-3)', flexShrink: 0 }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Szukaj w opisie…"
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
              <button className="btn btn-secondary" onClick={() => { setSearch(''); setFrom(''); setTo(''); }}><Ico name="X" size={14} /> Wyczyść</button>
            )}
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Opis</th>
                <th>Rodzaj</th>
                <th style={{ textAlign: 'right' }}>Kwota</th>
                <th style={{ textAlign: 'right' }}>Saldo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)' }}>Ładowanie…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)' }}>{context === 'spolka' ? 'Brak transakcji — zaimportuj plik XML z ING (Historia operacji)' : 'Brak transakcji — zaimportuj plik CSV z Alior Banku'}</td></tr>
              ) : filtered.map((r, i) => {
                const open = expanded === (r.id || String(i));
                const key = r.id || String(i);
                return (
                  <Fragment key={key}>
                    <tr onClick={() => setExpanded(open ? null : key)} style={{ cursor: 'pointer', background: open ? 'var(--lf-navy-50, #f0f4ff)' : undefined }}>
                      <td className="mono" style={{ fontSize: 12, color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>{r.date}</td>
                      <td style={{ maxWidth: 460, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</td>
                      <td><span className="badge" style={{ background: 'var(--lf-slate-100)', color: 'var(--fg-2)' }}>{r.kind}</span></td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: r.dir === 'in' ? 'var(--lf-green)' : 'var(--lf-danger)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Ico name={r.dir === 'in' ? 'TrendUp' : 'TrendDown'} size={13} />
                          {r.dir === 'in' ? '+' : ''}{fmt(r.amount)}
                        </span>
                      </td>
                      <td className="mono" style={{ textAlign: 'right', fontSize: 13, color: 'var(--fg-3)' }}>{fmt(r.balance)}</td>
                      <td style={{ textAlign: 'center' }}><Ico name="ChevronRight" size={15} style={{ color: 'var(--fg-3)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} /></td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={6} style={{ padding: 0, background: '#f9fafd', borderBottom: '2px solid var(--accent)' }}>
                          <div style={{ padding: '14px 20px', display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: 13, flex: '1 1 320px' }}>
                              {[
                                ['Data', r.date],
                                ['Rodzaj', r.kind],
                                ['Kierunek', r.dir === 'in' ? 'Wpływ' : 'Wydatek'],
                                ['Kontrahent', r.counterparty || '—'],
                                ['Konto', r.account && r.account !== 'firmowy' ? `…${r.account}` : 'firmowy'],
                                ['Kwota', `${r.dir === 'in' ? '+' : ''}${fmt(r.amount)} PLN`],
                                ['Saldo po operacji (konto)', `${fmt(r.balance)} PLN`],
                              ].map(([l, v]) => (
                                <div key={l}><div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 2 }}>{l}</div><div style={{ fontWeight: 500 }}>{v}</div></div>
                              ))}
                            </div>
                            <div style={{ flex: '1 1 280px', minWidth: 220 }}>
                              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 4 }}>Pełny opis</div>
                              <div style={{ fontSize: 13, background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', lineHeight: 1.5 }}>{r.title}</div>
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
          {filtered.length > 0 && (
            <div className="pager"><span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{filtered.length} z {rows.length} transakcji</span></div>
          )}
        </div>
      </div>
    </div>
  );
}
