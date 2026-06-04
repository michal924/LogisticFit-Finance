import { useState, useEffect } from 'react';
import { Ico } from '../components/ui/icons';
import { JPKService } from '../services/graphService';

function fmt(n: number) {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

type JpkStatus = 'sent' | 'processing' | 'error' | 'draft';

const STATUS_LABELS: Record<JpkStatus, string> = {
  sent:       'Wysłano',
  processing: 'W trakcie',
  error:      'Błąd',
  draft:      'Szkic',
};

const STATUS_COLORS: Record<JpkStatus, { bg: string; color: string }> = {
  sent:       { bg: 'var(--green-50, #f0fdf4)',  color: 'var(--green-600)' },
  processing: { bg: 'var(--blue-50, #eff6ff)',   color: 'var(--blue-600, #2563eb)' },
  error:      { bg: 'var(--red-50, #fef2f2)',    color: 'var(--red-600, #dc2626)' },
  draft:      { bg: 'var(--gray-100, #f3f4f6)',  color: 'var(--gray-500, #6b7280)' },
};

const STATUS_MAP: Record<string, JpkStatus> = {
  sent: 'sent', wysłano: 'sent', wyslano: 'sent',
  processing: 'processing', 'w trakcie': 'processing',
  error: 'error', błąd: 'error', blad: 'error',
  draft: 'draft', szkic: 'draft',
};

type JpkRow = {
  period: string;
  type: string;
  fileName: string;
  uploadDate: string;
  status: JpkStatus;
};

export default function JPK() {
  const [rows, setRows] = useState<JpkRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    JPKService.getAll()
      .then((items: any[]) => {
        const mapped: JpkRow[] = items.map(item => {
          const f = item.fields || {};
          const rawStatus = (f.Status || 'draft').toLowerCase();
          const status: JpkStatus = STATUS_MAP[rawStatus] ?? 'draft';
          return {
            period: f.Period || '',
            type: f.JPKType || 'JPK_V7M',
            fileName: f.FileName || '—',
            uploadDate: (f.UploadDate || '').split('T')[0] || '—',
            status,
          };
        });
        // Sort by period descending (most recent first)
        mapped.sort((a, b) => b.period.localeCompare(a.period));
        setRows(mapped);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const sentCount = rows.filter(r => r.status === 'sent').length;
  const currentDraft = rows.find(r => r.status === 'draft');

  if (loading) {
    return (
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, flexDirection: 'column', gap: 12 }}>
        <div className="spinner" />
        <span style={{ color: 'var(--muted)', fontSize: 14 }}>Ładowanie JPK…</span>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-head">
        <div>
          <h1 className="page-h">JPK_V7</h1>
          <p className="page-sub">Jednolity Plik Kontrolny · deklaracje VAT</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary"><Ico name="ShieldCheck" size={15} /> Generuj JPK_V7M</button>
          <button className="btn btn-secondary"><Ico name="Download" size={15} /> Eksportuj</button>
        </div>
      </div>

      <div className="grid cols-3" style={{ marginBottom: '1.5rem' }}>
        <div className="kpi" style={{ background: 'var(--navy-900)', color: '#fff' }}>
          <div className="label" style={{ color: 'rgba(255,255,255,0.6)' }}>Bieżący okres</div>
          <div className="value" style={{ color: '#fff', fontSize: '1.2rem' }}>{currentDraft?.period ?? '—'}</div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.2rem' }}>termin: 25. następnego miesiąca</div>
        </div>
        <div className="kpi">
          <div className="label"><span className="ico"><Ico name="CheckCircle" size={15} /></span>Wysłane deklaracje</div>
          <div className="value">{sentCount}</div>
          <div className="delta" data-dir="up">w bazie</div>
        </div>
        <div className="kpi">
          <div className="label"><span className="ico"><Ico name="FileText" size={15} /></span>Łącznie plików</div>
          <div className="value">{rows.length}</div>
          <div className="delta">wszystkie okresy</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><span>Historia JPK_V7M</span></div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Okres</th>
                  <th>Typ</th>
                  <th>Plik</th>
                  <th>Data przesłania</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="empty">Brak plików JPK</td></tr>
                )}
                {rows.map((r, i) => {
                  const sc = STATUS_COLORS[r.status];
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{r.period}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>{r.type}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--muted)' }}>{r.fileName}</td>
                      <td style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{r.uploadDate}</td>
                      <td>
                        <span className="badge" style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.color}40` }}>
                          {STATUS_LABELS[r.status]}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          {r.status === 'sent' && (
                            <button className="btn" style={{ padding: '0.25rem 0.5rem' }} title="Pobierz">
                              <Ico name="Download" size={14} />
                            </button>
                          )}
                          {r.status === 'draft' && (
                            <button className="btn btn-primary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}>
                              Wyślij
                            </button>
                          )}
                          <button className="btn" style={{ padding: '0.25rem 0.5rem' }} title="Podgląd">
                            <Ico name="Eye" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
