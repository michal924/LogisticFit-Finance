import { Ico } from '../components/ui/icons';

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

const JPK_ROWS: { period: string; type: string; vatDue: number; status: JpkStatus; sent: string; upo: string }[] = [
  { period: 'Maj 2026',       type: 'JPK_V7M', vatDue: 19600, status: 'draft',      sent: '—',          upo: '—' },
  { period: 'Kwiecień 2026',  type: 'JPK_V7M', vatDue: 18200, status: 'sent',       sent: '2026-05-25', upo: 'UPO/2026/04/001' },
  { period: 'Marzec 2026',    type: 'JPK_V7M', vatDue: 16400, status: 'sent',       sent: '2026-04-25', upo: 'UPO/2026/03/001' },
  { period: 'Luty 2026',      type: 'JPK_V7M', vatDue: 15300, status: 'sent',       sent: '2026-03-25', upo: 'UPO/2026/02/001' },
  { period: 'Styczeń 2026',   type: 'JPK_V7M', vatDue: 14200, status: 'sent',       sent: '2026-02-25', upo: 'UPO/2026/01/001' },
  { period: 'Grudzień 2025',  type: 'JPK_V7M', vatDue: 12800, status: 'processing', sent: '2026-01-25', upo: '—' },
];

const sentCount = JPK_ROWS.filter(r => r.status === 'sent').length;
const ytdVat = JPK_ROWS.filter(r => r.status === 'sent').reduce((s, r) => s + r.vatDue, 0);
const currentDue = JPK_ROWS.find(r => r.status === 'draft')?.vatDue ?? 0;

export default function JPK() {
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
          <div className="label" style={{ color: 'rgba(255,255,255,0.6)' }}>VAT do zapłaty (bieżący)</div>
          <div className="value" style={{ color: '#fff', fontSize: '1.5rem' }}>{fmt(currentDue)} <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>PLN</span></div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.2rem' }}>termin: 25. następnego miesiąca</div>
        </div>
        <div className="kpi">
          <div className="label"><span className="ico"><Ico name="CheckCircle" size={15} /></span>Wysłane deklaracje</div>
          <div className="value">{sentCount}</div>
          <div className="delta" data-dir="up">w bieżącym roku</div>
        </div>
        <div className="kpi">
          <div className="label"><span className="ico"><Ico name="Coins" size={15} /></span>Zapłacony VAT YTD</div>
          <div className="value">{fmt(ytdVat)} <span className="unit">PLN</span></div>
          <div className="delta">suma roku 2026</div>
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
                  <th style={{ textAlign: 'right' }}>VAT do zapłaty</th>
                  <th>Status</th>
                  <th>Wysłano</th>
                  <th>UPO</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {JPK_ROWS.map((r, i) => {
                  const sc = STATUS_COLORS[r.status];
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{r.period}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>{r.type}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmt(r.vatDue)}</td>
                      <td>
                        <span className="badge" style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.color}40` }}>
                          {STATUS_LABELS[r.status]}
                        </span>
                      </td>
                      <td style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{r.sent}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--muted)' }}>{r.upo}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          {r.status === 'sent' && (
                            <button className="btn" style={{ padding: '0.25rem 0.5rem' }} title="Pobierz UPO">
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
