import { FileUp, ChevronRight, Check, Clock } from 'lucide-react';
import type { Invoice } from '../types';

function fmt(n: number) {
  return (n || 0).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function statusBadge(inv: Invoice) {
  const today = new Date().toISOString().split('T')[0];
  if (inv.paid) return { label: 'Opłacona', color: '#239d46', bg: '#f0faf2' };
  if (inv.dueDate < today) return { label: 'Przeterminowana', color: '#c8362d', bg: '#fef2f2' };
  return { label: 'Oczekuje', color: '#d28a17', bg: '#fffbf0' };
}

/**
 * Szczegóły faktury — rozwijane INLINE pod klikniętym wierszem tabeli (akordeon).
 * Pełna szerokość; sekcje układają się obok siebie i zawijają na wąskich ekranach.
 */
export default function InvoiceDetail({ inv, onTogglePaid, onEdit, onDelete }: {
  inv: Invoice;
  onTogglePaid: (i: Invoice) => void;
  onEdit: (i: Invoice) => void;
  onDelete: (i: Invoice) => void;
}) {
  const s = statusBadge(inv);
  const docs = inv.attachments?.length
    ? inv.attachments
    : (inv.fileUrl ? [{ name: 'Faktura (oryginał)', url: inv.fileUrl }] : []);

  return (
    <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {/* Dane + kwoty */}
      <div style={{ flex: '1 1 260px', minWidth: 240 }}>
        <span style={{ padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, color: s.color, background: s.bg, display: 'inline-block', marginBottom: 14 }}>{s.label}</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginBottom: 14, fontSize: 13 }}>
          {[['Data wystawienia', inv.issueDate], ['Termin płatności', inv.dueDate], ['NIP', inv.nip || '—'], ['Waluta', inv.currency || 'PLN']].map(([l, v]) => (
            <div key={l}><div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 2 }}>{l}</div><div style={{ fontWeight: 500 }}>{v}</div></div>
          ))}
          {inv.category && (
            <div><div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 2 }}>Kategoria</div><div style={{ fontWeight: 500 }}>{inv.category}</div></div>
          )}
        </div>
        <div style={{ background: '#f4f6fb', borderRadius: 8, padding: 12, fontSize: 13, maxWidth: 320 }}>
          {[['Netto', fmt(inv.netTotal)], ['VAT', fmt(inv.vatTotal)]].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: 'var(--fg-2)' }}>
              <span>{l}</span><span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{v} PLN</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <span>Brutto</span><span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{fmt(inv.grossTotal)} PLN</span>
          </div>
        </div>
      </div>

      {/* Pozycje */}
      {inv.lines && inv.lines.length > 0 && (
        <div style={{ flex: '1 1 240px', minWidth: 220 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', marginBottom: 8 }}>POZYCJE</div>
          {inv.lines.map((line, i) => (
            <div key={i} style={{ fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 500 }}>{line.description}</div>
              <div style={{ color: 'var(--fg-3)', marginTop: 2 }}>{line.quantity} × {fmt(line.unitPrice)} · VAT {line.vatRate}% · <strong>{fmt(line.grossAmount)} PLN</strong></div>
            </div>
          ))}
        </div>
      )}

      {/* Dokumenty + akcje */}
      <div style={{ flex: '1 1 240px', minWidth: 220 }}>
        {docs.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', marginBottom: 6 }}>DOKUMENTY</div>
            {docs.map((doc, i) => (
              <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', marginBottom: 6, background: 'var(--lf-navy-50, #f0f4ff)', border: '1px solid var(--lf-navy-200, #c7d0ec)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>
                <FileUp size={14} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{doc.name}</span>
                <ChevronRight size={14} />
              </a>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => onTogglePaid(inv)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: inv.paid ? '#fff' : '#239d46', color: inv.paid ? 'var(--fg-2)' : '#fff', border: `1px solid ${inv.paid ? 'var(--border)' : '#239d46'}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {inv.paid ? <Clock size={14} /> : <Check size={14} />}
            {inv.paid ? 'Oznacz nieopłacona' : 'Oznacz opłacona'}
          </button>
          <button onClick={() => onEdit(inv)} style={{ padding: '8px 14px', background: '#fff', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--fg-2)' }}>Edytuj</button>
          <button onClick={() => onDelete(inv)} style={{ padding: '8px 14px', background: '#fff', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#c8362d' }}>Usuń</button>
        </div>
      </div>
    </div>
  );
}
