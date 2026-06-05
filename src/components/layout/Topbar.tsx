import { useState } from 'react';
import { useUiStore } from '../../stores/uiStore';
import { Ico } from '../ui/icons';
import type { Lang } from '../../i18n';
import { makeT } from '../../i18n';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useContextStore, CONTEXTS, getContext } from '../../stores/contextStore';

const CRUMBS: Record<string, [string, string]> = {
  '':                  ['Faktury', 'Dashboard'],
  'faktury-sprzedazy': ['Faktury', 'Faktury sprzedaży'],
  'faktury-kosztowe':  ['Faktury', 'Faktury kosztowe'],
  'bank':              ['Bank', 'Bank firmowy'],
  'bank-prywatny':     ['Bank', 'Bank prywatny'],
  'kontrahenci':       ['Analiza', 'Kontrahenci'],
  'koszty':            ['Analiza', 'Koszty'],
  'raporty':           ['Analiza', 'Raporty'],
  'dokumenty':         ['Admin', 'Dokumenty'],
  'jpk':               ['Admin', 'JPK'],
  'ustawienia':        ['Admin', 'Ustawienia'],
};

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function ContextSwitcher() {
  const { active, setActive } = useContextStore();
  const [open, setOpen] = useState(false);
  const ctx = getContext(active);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
          background: '#fff', border: '1px solid var(--border-1)', borderRadius: 8,
          fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--fg-1)',
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: ctx.color, flexShrink: 0 }} />
        {ctx.short}
        <Ico name="ChevronDown" size={14} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, minWidth: 220,
          background: '#fff', border: '1px solid var(--border-1)', borderRadius: 10,
          boxShadow: 'var(--shadow-md)', zIndex: 100, overflow: 'hidden',
        }}>
          {CONTEXTS.map(c => (
            <button
              key={c.key}
              onMouseDown={() => { setActive(c.key); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 14px', border: 'none', cursor: 'pointer', textAlign: 'left',
                background: c.key === active ? 'var(--lf-slate-50)' : '#fff',
                fontSize: 13,
              }}
            >
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--fg-1)' }}>{c.name}</div>
                <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>
                  {c.type === 'private' ? 'Finanse osobiste' : `${c.type === 'jdg' ? 'JDG' : 'Spółka'}${c.nip ? ' · ' + c.nip : ''}`}
                </div>
              </div>
              {c.key === active && <Ico name="Check" size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Topbar({ lang, query, setQuery }: { lang: Lang; query: string; setQuery: (q: string) => void }) {
  const t = makeT(lang);
  const { sidebarCollapsed, setSidebarCollapsed } = useUiStore();
  const location = useLocation();
  const { user } = useAuth();
  const id = location.pathname === '/' ? '' : location.pathname.replace('/', '').split('/')[0];
  const [crumb, title] = CRUMBS[id] ?? ['', id];

  return (
    <header className="topbar">
      {sidebarCollapsed && (
        <button className="icon-btn" onClick={() => setSidebarCollapsed(false)} aria-label="Rozwiń" style={{ marginRight: 4 }}>
          <Ico name="PanelLeft" size={18} />
        </button>
      )}
      <div className="topbar-title">
        <span className="crumb">{crumb}</span>
        <span className="name">{title}</span>
      </div>
      <div style={{ marginLeft: 16 }}>
        <ContextSwitcher />
      </div>
      <div className="topbar-search">
        <span className="search-ico"><Ico name="Search" size={16} /></span>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('search.placeholder')} />
      </div>
      <div className="topbar-right">
        <button className="icon-btn" aria-label="Powiadomienia">
          <Ico name="Bell" size={18} />
        </button>
        <span className="avatar" data-color="navy" title={user?.name ?? 'MR'} style={{ fontSize: 12 }}>
          {initials(user?.name ?? 'Michał Rzeźnik')}
        </span>
      </div>
    </header>
  );
}

export default Topbar;
