import { useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Bell, HelpCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { isStaging } from '../../services/environment';

const MODULE_NAMES: Record<string, string> = {
  '/':                'Dashboard',
  '/offers':          'Oferty',
  '/pipeline':        'Pipeline',
  '/audits':          'Audyty',
  '/implementation':  'Wdrożenia',
  '/documents':       'Dokumenty',
  '/templates':       'Szablony',
  '/settings':        'Ustawienia',
};

function EnvBadge() {
  const staging = isStaging();
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 999,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
      textTransform: 'uppercase',
      background: staging ? 'var(--lf-warning-bg)' : 'var(--lf-green-100)',
      color: staging ? '#7a4e00' : 'var(--lf-green-900)',
      border: `1px solid ${staging ? '#e8c57a' : 'var(--lf-green-300)'}`,
    }}>
      {staging && (
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--lf-warning)',
          animation: 'pulse 1.6s ease-in-out infinite',
        }} />
      )}
      {staging ? 'STAGING' : 'PROD'}
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%',
      background: 'var(--lf-navy-100)', color: 'var(--accent)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 700, flexShrink: 0, cursor: 'pointer',
    }}>
      {initials}
    </div>
  );
}

export function Topbar() {
  const { user } = useAuth();
  const location = useLocation();
  const searchRef = useRef<HTMLInputElement>(null);

  // Normalize path: /audits/123 → /audits
  const basePath = '/' + location.pathname.split('/').filter(Boolean)[0] || '/';
  const moduleName = MODULE_NAMES[location.pathname] ?? MODULE_NAMES[basePath] ?? 'Compliance Manager';

  // ⌘K / Ctrl+K → focus search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-title">
        <span className="crumb">LogisticFit / Compliance</span>
        <span className="name">{moduleName}</span>
      </div>

      <div className="topbar-search">
        <span className="search-ico"><Search size={15} /></span>
        <input
          ref={searchRef}
          placeholder="Szukaj klienta, oferty, dokumentu… (⌘K)"
        />
      </div>

      <div className="topbar-right">
        <EnvBadge />
        <button className="icon-btn" aria-label="Powiadomienia" title="Powiadomienia" style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--lf-slate-200)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--fg-3)' }}>
          <Bell size={17} />
        </button>
        <button className="icon-btn" aria-label="Pomoc" title="Pomoc" style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--lf-slate-200)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--fg-3)' }}>
          <HelpCircle size={17} />
        </button>
        {user && <Avatar name={user.name ?? user.username ?? 'U'} />}
      </div>
    </header>
  );
}
