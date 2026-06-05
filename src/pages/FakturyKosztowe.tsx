// Identyczny ekran co FakturySprzedazy — tylko typ "cost"
import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Upload, FileUp, Loader2, X, Check, Clock, Search, ChevronRight, RefreshCw } from 'lucide-react';
import type { Invoice } from '../types';
import { getInvoices, saveInvoice, removeInvoice, processPdfWithAI } from '../services/invoiceService';
import { uploadDocument } from '../services/graphService';
import { fetchInfakt } from '../services/infaktService';

type Filter = 'all' | 'paid' | 'pending' | 'overdue';

type PdfItem = { name: string; status: 'processing' | 'done' | 'error' };

function statusBadge(inv: Invoice) {
  const today = new Date().toISOString().split('T')[0];
  if (inv.paid) return { label: 'Opłacona', color: '#239d46', bg: '#f0faf2' };
  if (inv.dueDate < today) return { label: 'Przeterminowana', color: '#c8362d', bg: '#fef2f2' };
  return { label: 'Oczekuje', color: '#d28a17', bg: '#fffbf0' };
}

function fmt(n: number) {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function FakturyKosztowe() {
  const { context } = useOutletContext<{ lang: any; query: string; context: string }>();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [pdfError, setPdfError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pdfQueue, setPdfQueue] = useState<PdfItem[]>([]);
  const [importSummary, setImportSummary] = useState<{ ok: number; total: number } | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const today = new Date().toISOString().split('T')[0];

  async function handleInfaktSync() {
    setSyncing(true); setSyncMsg('Pobieram faktury kosztowe z inFakt…');
    try {
      const fromInfakt = await fetchInfakt('cost');
      let ok = 0;
      for (const inv of fromInfakt) {
        const existing = invoices.find(x => x.number && inv.number && x.number.trim().toLowerCase() === inv.number.trim().toLowerCase());
        // inFakt = źródło prawdy: zachowujemy tylko spId (upsert). Status/kwoty/fileUrl(PDF) bierzemy z inFakt
        if (existing) { inv.spId = existing.spId; if (!inv.fileUrl) inv.fileUrl = existing.fileUrl; }
        await saveInvoice(inv, context);
        ok++;
      }
      setSyncMsg(`✓ Zsynchronizowano ${ok} faktur z inFakt`);
      await reload();
    } catch (e: any) {
      setSyncMsg('Błąd inFakt: ' + (e.message || e));
    } finally { setSyncing(false); }
  }

  const reload = async () => {
    setLoading(true);
    try { setInvoices(await getInvoices('cost', context)); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { reload(); }, [context]);

  const filtered = invoices.filter(inv => {
    if (filter === 'paid' && !inv.paid) return false;
    if (filter === 'pending' && (inv.paid || inv.dueDate < today)) return false;
    if (filter === 'overdue' && (inv.paid || inv.dueDate >= today)) return false;
    if (search && !inv.counterparty.toLowerCase().includes(search.toLowerCase()) &&
        !inv.number.toLowerCase().includes(search.toLowerCase())) return false;
    if (dateFrom && inv.issueDate < dateFrom) return false;
    if (dateTo && inv.issueDate > dateTo) return false;
    return true;
  });

  const totalGross = filtered.reduce((s, i) => s + i.grossTotal, 0);
  const totalPaid  = filtered.filter(i => i.paid).reduce((s, i) => s + i.grossTotal, 0);

  async function processFiles(files: File[]) {
    const pdfs = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (!pdfs.length) return;
    setPdfError('');
    setImportSummary(null);
    const queue: PdfItem[] = pdfs.map(f => ({ name: f.name, status: 'processing' }));
    setPdfQueue(queue);
    let ok = 0;
    for (let i = 0; i < pdfs.length; i++) {
      try {
        const buffer = await pdfs[i].arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        const data = await processPdfWithAI(base64, 'cost');
        const inv: Invoice = { ...data, type: 'cost', paid: false, lines: data.lines || [], currency: 'PLN' } as Invoice;
        // Dedup: jeśli faktura o tym numerze już istnieje w tym kontekście — aktualizuj (dograj PDF), nie twórz duplikatu
        const existing = invoices.find(x => x.number && inv.number && x.number.trim().toLowerCase() === inv.number.trim().toLowerCase());
        if (existing) { inv.spId = existing.spId; inv.paid = existing.paid; }
        // Archiwizuj oryginalny PDF w bibliotece dokumentów
        try {
          const baseName = (inv.number || pdfs[i].name).replace(/\.pdf$/i, '');
          inv.fileUrl = await uploadDocument(context, 'Faktury kosztowe', inv.issueDate, `${baseName}.pdf`, buffer);
        } catch (e) { console.warn('Archiwizacja PDF nieudana:', e); }
        await saveInvoice(inv, context);
        ok++;
        setPdfQueue(q => q.map((item, idx) => idx === i ? { ...item, status: 'done' } : item));
      } catch {
        setPdfQueue(q => q.map((item, idx) => idx === i ? { ...item, status: 'error' } : item));
      }
    }
    setImportSummary({ ok, total: pdfs.length });
    await reload();
    setTimeout(() => { setPdfQueue([]); }, 3000);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length) processFiles(files);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) processFiles(files);
  }

  async function handleSave(inv: Invoice) {
    await saveInvoice(inv, context);
    setShowForm(false); setEditing(null);
    await reload();
  }

  async function handleDelete(inv: Invoice) {
    if (!inv.spId || !confirm(`Usunąć fakturę ${inv.number}?`)) return;
    await removeInvoice(inv.spId);
    setSelected(null); await reload();
  }

  async function togglePaid(inv: Invoice) {
    await saveInvoice({ ...inv, paid: !inv.paid, paymentDate: !inv.paid ? today : undefined }, context);
    await reload();
    setSelected(s => s?.spId === inv.spId ? { ...inv, paid: !inv.paid } : s);
  }

  return (
    <div style={{ display: 'flex', gap: 24, height: '100%' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--lf-navy-900)', margin: 0 }}>Faktury kosztowe</h1>
            <p style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 4 }}>
              {filtered.length} faktur · brutto: <strong style={{ color: 'var(--lf-navy-700)', fontFamily: 'JetBrains Mono, monospace' }}>{fmt(totalGross)} PLN</strong>
              {' · '}opłacone: <strong style={{ color: '#239d46', fontFamily: 'JetBrains Mono, monospace' }}>{fmt(totalPaid)} PLN</strong>
            </p>
          </div>
          {context !== 'prywatne' && (
            <button onClick={handleInfaktSync} disabled={syncing} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: syncing ? 'var(--lf-slate-100)' : 'var(--accent)', color: syncing ? 'var(--fg-3)' : '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: syncing ? 'default' : 'pointer' }}>
              {syncing ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={15} />}
              {syncing ? 'Synchronizuję…' : 'Synchronizuj z inFakt'}
            </button>
          )}
        </div>

        {syncMsg && (
          <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600,
            background: syncMsg.startsWith('✓') ? 'var(--lf-green-100)' : syncMsg.startsWith('Błąd') ? 'var(--lf-danger-bg)' : 'var(--lf-navy-100)',
            color: syncMsg.startsWith('✓') ? 'var(--lf-green-900)' : syncMsg.startsWith('Błąd') ? 'var(--lf-danger)' : 'var(--lf-navy-700)' }}>
            {syncMsg}
          </div>
        )}

        {/* Drag & Drop upload */}
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileRef.current?.click()}
          style={{ border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--lf-navy-300, #a0aec0)'}`, borderRadius: 10, padding: 20, textAlign: 'center', cursor: 'pointer', marginBottom: 16, background: dragOver ? 'var(--lf-navy-50, #f0f4ff)' : '#fafbff', transition: 'all .15s' }}
        >
          <Upload size={22} color="var(--fg-3)" style={{ marginBottom: 6 }} />
          <div style={{ fontSize: 13, color: 'var(--fg-2)', fontWeight: 500 }}>Przeciągnij faktury PDF tutaj lub kliknij by wybrać</div>
          <input ref={fileRef} type="file" accept=".pdf" multiple style={{ display: 'none' }} onChange={handleFileInput} />
        </div>

        {/* Progress list */}
        {pdfQueue.length > 0 && (
          <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {pdfQueue.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '4px 10px', background: '#f4f6fb', borderRadius: 6 }}>
                {item.status === 'processing' && <Loader2 size={13} style={{ flexShrink: 0, animation: 'spin 1s linear infinite' }} />}
                {item.status === 'done' && <Check size={13} color="#239d46" style={{ flexShrink: 0 }} />}
                {item.status === 'error' && <X size={13} color="#c8362d" style={{ flexShrink: 0 }} />}
                <span style={{ color: 'var(--fg-2)' }}>{item.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Import summary */}
        {importSummary && (
          <div style={{ background: '#f0faf2', border: '1px solid #b7ebc8', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#239d46', fontWeight: 600, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Zaimportowano {importSummary.ok} z {importSummary.total} faktur</span>
            <button onClick={() => setImportSummary(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#239d46' }}><X size={14} /></button>
          </div>
        )}

        {pdfError && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#c8362d', marginBottom: 16 }}>{pdfError}</div>}

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {(['all', 'paid', 'pending', 'overdue'] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: '5px 14px', borderRadius: 999, fontSize: 13, fontWeight: 500, border: '1px solid', cursor: 'pointer', background: filter === f ? 'var(--accent)' : '#fff', color: filter === f ? '#fff' : 'var(--fg-2)', borderColor: filter === f ? 'var(--accent)' : 'var(--border)' }}>
              {f === 'all' ? 'Wszystkie' : f === 'paid' ? 'Opłacone' : f === 'pending' ? 'Oczekuje' : 'Przeterminowane'}
            </button>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="Od" style={{ padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--fg-2)' }} />
            <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>–</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="Do" style={{ padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--fg-2)' }} />
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px' }}>
            <Search size={14} color="var(--fg-3)" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Szukaj..." style={{ border: 'none', outline: 'none', fontSize: 13, width: 160, color: 'var(--fg-1)' }} />
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f4f6fb', borderBottom: '1px solid var(--border)' }}>
                {['Nr faktury', 'Data', 'Kontrahent', 'Netto', 'VAT', 'Brutto', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Netto' || h === 'VAT' || h === 'Brutto' ? 'right' : 'left', fontWeight: 600, color: 'var(--fg-2)', fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center' }}><Loader2 size={20} style={{ display: 'inline' }} /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center', color: 'var(--fg-3)' }}>Brak faktur kosztowych</td></tr>
              ) : filtered.map(inv => {
                const s = statusBadge(inv);
                const isActive = selected?.spId === inv.spId;
                return (
                  <tr key={inv.spId} onClick={() => setSelected(inv)}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: isActive ? '#f4f6fb' : '#fff' }}
                    onMouseEnter={e => !isActive && (e.currentTarget.style.background = '#f8f9fd')}
                    onMouseLeave={e => !isActive && (e.currentTarget.style.background = '#fff')}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--accent)' }}>{inv.number}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--fg-2)' }}>{inv.issueDate}</td>
                    <td style={{ padding: '10px 14px' }}>{inv.counterparty}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>{fmt(inv.netTotal)}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', textAlign: 'right', color: 'var(--fg-3)' }}>{fmt(inv.vatTotal)}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', textAlign: 'right', fontWeight: 600 }}>{fmt(inv.grossTotal)}</td>
                    <td style={{ padding: '10px 14px' }}><span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, color: s.color, background: s.bg }}>{s.label}</span></td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}><ChevronRight size={15} color="var(--fg-3)" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div style={{ width: 360, flexShrink: 0, background: '#fff', borderRadius: 10, border: '1px solid var(--border)', padding: 20, alignSelf: 'flex-start', position: 'sticky', top: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{selected.number}</div>
              <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>{selected.counterparty}</div>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)' }}><X size={18} /></button>
          </div>
          {(() => { const s = statusBadge(selected); return <span style={{ padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, color: s.color, background: s.bg, display: 'inline-block', marginBottom: 16 }}>{s.label}</span>; })()}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginBottom: 16, fontSize: 13 }}>
            {[['Data wystawienia', selected.issueDate], ['Termin płatności', selected.dueDate], ['NIP', selected.nip || '—'], ['Waluta', selected.currency]].map(([l, v]) => (
              <div key={l}><div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 2 }}>{l}</div><div style={{ fontWeight: 500 }}>{v}</div></div>
            ))}
          </div>
          <div style={{ background: '#f4f6fb', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13 }}>
            {[['Netto', fmt(selected.netTotal)], ['VAT', fmt(selected.vatTotal)]].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: 'var(--fg-2)' }}>
                <span>{l}</span><span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{v} PLN</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <span>Brutto</span><span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{fmt(selected.grossTotal)} PLN</span>
            </div>
          </div>
          {selected.lines?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', marginBottom: 8 }}>POZYCJE</div>
              {selected.lines.map((line, i) => (
                <div key={i} style={{ fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 500 }}>{line.description}</div>
                  <div style={{ color: 'var(--fg-3)', marginTop: 2 }}>{line.quantity} × {fmt(line.unitPrice)} · VAT {line.vatRate}% · <strong>{fmt(line.grossAmount)} PLN</strong></div>
                </div>
              ))}
            </div>
          )}
          {selected.fileUrl && (
            <a href={selected.fileUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', marginBottom: 12, background: 'var(--lf-navy-50, #f0f4ff)', border: '1px solid var(--lf-navy-200, #c7d0ec)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', justifyContent: 'center' }}>
              <FileUp size={14} /> Otwórz oryginał PDF
            </a>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => togglePaid(selected)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: selected.paid ? '#fff' : '#239d46', color: selected.paid ? 'var(--fg-2)' : '#fff', border: `1px solid ${selected.paid ? 'var(--border)' : '#239d46'}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {selected.paid ? <Clock size={14} /> : <Check size={14} />}
              {selected.paid ? 'Nieopłacona' : 'Opłacona'}
            </button>
            <button onClick={() => { setEditing(selected); setShowForm(true); }} style={{ padding: '8px 14px', background: '#fff', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--fg-2)' }}>Edytuj</button>
            <button onClick={() => handleDelete(selected)} style={{ padding: '8px 14px', background: '#fff', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#c8362d' }}>Usuń</button>
          </div>
        </div>
      )}

      {showForm && <InvoiceModal invoice={editing} type="cost" onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); }} />}
    </div>
  );
}

function InvoiceModal({ invoice, type, onSave, onClose }: { invoice: Invoice | null; type: 'sales' | 'cost'; onSave: (inv: Invoice) => Promise<void>; onClose: () => void; }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Invoice>(invoice || { type, number: '', issueDate: '', dueDate: '', counterparty: '', nip: '', lines: [], netTotal: 0, vatTotal: 0, grossTotal: 0, currency: 'PLN', paid: false });
  async function handleSubmit(e: React.FormEvent) { e.preventDefault(); setSaving(true); try { await onSave(form); } finally { setSaving(false); } }
  const field = (label: string, key: keyof Invoice, t = 'text') => (
    <div><label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-3)', display: 'block', marginBottom: 4 }}>{label}</label>
    <input type={t} value={(form[key] as string) || ''} onChange={e => setForm(f => ({ ...f, [key]: t === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} /></div>
  );
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{form.spId ? 'Edytuj fakturę' : 'Nowa faktura kosztowa'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {field('Nr faktury', 'number')}{field('Kontrahent', 'counterparty')}
            {field('NIP', 'nip')}{field('Waluta', 'currency')}
            {field('Data wystawienia', 'issueDate', 'date')}{field('Termin płatności', 'dueDate', 'date')}
            {field('Netto (PLN)', 'netTotal', 'number')}{field('VAT (PLN)', 'vatTotal', 'number')}
            {field('Brutto (PLN)', 'grossTotal', 'number')}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 20 }}>
            <input type="checkbox" checked={form.paid} onChange={e => setForm(f => ({ ...f, paid: e.target.checked }))} /> Opłacona
          </label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}>Anuluj</button>
            <button type="submit" disabled={saving} style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{saving ? 'Zapisuję...' : 'Zapisz'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
