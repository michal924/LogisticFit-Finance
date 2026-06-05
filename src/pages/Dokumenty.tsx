import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Ico } from '../components/ui/icons';
import { listDocuments, libraryForContext, type DriveEntry } from '../services/graphService';
import { getContext } from '../stores/contextStore';

function fmtSize(b?: number): string {
  if (!b) return '';
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB';
  return (b / 1024 / 1024).toFixed(1) + ' MB';
}

function fileIcon(name: string): { ico: string; color: string } {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return { ico: 'FileText', color: '#c8362d' };
  if (ext === 'csv' || ext === 'xlsx' || ext === 'xls') return { ico: 'BarChart', color: '#239d46' };
  if (ext === 'xml') return { ico: 'FileText', color: '#d28a17' };
  return { ico: 'FileText', color: 'var(--fg-3)' };
}

export default function Dokumenty() {
  const { context } = useOutletContext<{ lang: any; query: string; context: string }>();
  const [path, setPath] = useState('');
  const [entries, setEntries] = useState<DriveEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const library = libraryForContext(context);
  const ctx = getContext(context as any);

  const load = (p: string) => {
    setLoading(true); setError('');
    listDocuments(context, p)
      .then(setEntries)
      .catch(e => setError(e.message || 'Błąd ładowania'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { setPath(''); load(''); /* reset przy zmianie kontekstu */ }, [context]);
  useEffect(() => { load(path); }, [path]);

  const segments = path ? path.split('/') : [];

  function openFolder(name: string) {
    setPath(p => (p ? `${p}/${name}` : name));
  }
  function goToSegment(idx: number) {
    setPath(segments.slice(0, idx + 1).join('/'));
  }

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Dokumenty</h1>
          <div className="page-sub">Archiwum dokumentów · biblioteka <strong>{library}</strong></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--fg-3)' }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: ctx.color }} />
          {ctx.name}
        </div>
      </div>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 13, flexWrap: 'wrap' }}>
        <button onClick={() => setPath('')} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: path ? 'var(--accent)' : 'var(--fg-1)', fontWeight: 600, padding: '4px 6px' }}>
          <Ico name="Bank" size={14} /> {library}
        </button>
        {segments.map((seg, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Ico name="ChevronRight" size={13} />
            <button onClick={() => goToSegment(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: i === segments.length - 1 ? 'var(--fg-1)' : 'var(--accent)', fontWeight: i === segments.length - 1 ? 600 : 500, padding: '4px 6px' }}>
              {seg}
            </button>
          </span>
        ))}
      </div>

      {error && (
        <div style={{ background: 'var(--lf-danger-bg)', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--lf-danger)', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Lista folderów/plików */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--border-1)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--fg-3)' }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--fg-3)', fontSize: 14 }}>
            {path ? 'Folder jest pusty' : 'Brak dokumentów — uruchom synchronizację z inFakt, by zarchiwizować pliki'}
          </div>
        ) : (
          entries.map(e => {
            const fi = e.isFolder ? { ico: 'Bank', color: 'var(--accent)' } : fileIcon(e.name);
            return (
              <div
                key={e.id}
                onClick={() => e.isFolder ? openFolder(e.name) : window.open(e.webUrl, '_blank')}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: '1px solid var(--border-1)', cursor: 'pointer', transition: 'background .1s' }}
                onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--lf-slate-50)')}
                onMouseLeave={ev => (ev.currentTarget.style.background = '#fff')}
              >
                <span style={{ color: fi.color, flexShrink: 0, display: 'flex' }}>
                  <Ico name={e.isFolder ? 'Bank' : fi.ico} size={18} />
                </span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: e.isFolder ? 600 : 500, color: 'var(--fg-1)' }}>{e.name}</span>
                {e.isFolder
                  ? <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{e.childCount ?? 0} elem.</span>
                  : <span style={{ fontSize: 12, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{fmtSize(e.size)}</span>}
                <Ico name={e.isFolder ? 'ChevronRight' : 'ArrowUpRight'} size={15} />
              </div>
            );
          })
        )}
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--fg-3)' }}>
        {entries.filter(e => !e.isFolder).length > 0 && `${entries.filter(e => !e.isFolder).length} plików · `}
        Kliknij plik, by otworzyć z SharePoint
      </div>
    </div>
  );
}
