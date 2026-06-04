import { useUiStore } from '../../stores/uiStore';
import { Ico } from '../ui/icons';
import type { Lang } from '../../i18n';
import { makeT } from '../../i18n';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const CRUMBS: Record<string, [string, string]> = {
  '':                  ['Faktury', 'Dashboard'],
  'faktury-sprzedazy': ['Faktury', 'Faktury sprzedaży'],
  'faktury-kosztowe':  ['Faktury', 'Faktury kosztowe'],
  'bank':              ['Bank', 'Bank firmowy'],
  'bank-prywatny':     ['Bank', 'Bank prywatny'],
  'kontrahenci':       ['Analiza', 'Kontrahenci'],
  'koszty':            ['Analiza', 'Koszty'],
  'raporty':           ['Analiza', 'Raporty'],
  'jpk':               ['Admin', 'JPK'],
  'ustawienia':        ['Admin', 'Ustawienia'],
};

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
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
