import { useNavigate, useLocation } from 'react-router-dom';
import { useUiStore } from '../../stores/uiStore';
import { useAuth } from '../../hooks/useAuth';
import { Ico } from '../ui/icons';
import type { Lang } from '../../i18n';
import { makeT } from '../../i18n';
import { useContextStore } from '../../stores/contextStore';

// Ekrany dostępne w każdym kontekście (id z NAV)
const SCREENS_BY_CONTEXT: Record<string, string[]> = {
  // JDG i Spółka: pełen zakres
  jdg:    ['', 'faktury-sprzedazy', 'faktury-kosztowe', 'bank', 'kontrahenci', 'koszty', 'raporty', 'dokumenty', 'jpk', 'ustawienia'],
  spolka: ['', 'faktury-sprzedazy', 'faktury-kosztowe', 'bank', 'kontrahenci', 'koszty', 'raporty', 'dokumenty', 'jpk', 'ustawienia'],
  // Prywatne: tylko przepływy + analiza + dokumenty
  prywatne: ['', 'bank-prywatny', 'koszty', 'raporty', 'dokumenty', 'ustawienia'],
};

// Finance brand mark — bar-chart + rising green arrow on deep-navy tile (znak własny, niesie własne tło)
function FinanceMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role="img" aria-label="LogisticFit Finance" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="200" height="200" rx="28" fill="#0A2540" />
      <g fill="#C2D1E0">
        <rect x="46" y="112" width="24" height="42" rx="6" />
        <rect x="88" y="88" width="24" height="66" rx="6" />
        <rect x="130" y="62" width="24" height="92" rx="6" />
      </g>
      <path d="M48,130 L150,52 M150,52 L124,54 M150,52 L148,78" fill="none" stroke="#1C7C56" strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const NAV = [
  { section: 'sec.invoices', items: [
    { id: '',            path: '/',                  icon: 'Dashboard',   label: 'nav.dashboard' },
    { id: 'faktury-sprzedazy', path: '/faktury-sprzedazy', icon: 'FileText', label: 'nav.sales' },
    { id: 'faktury-kosztowe',  path: '/faktury-kosztowe',  icon: 'Receipt',  label: 'nav.costs' },
  ]},
  { section: 'sec.bank', items: [
    { id: 'bank',         path: '/bank',         icon: 'Bank',    label: 'nav.bankCompany' },
    { id: 'bank-prywatny',path: '/bank-prywatny',icon: 'Wallet',  label: 'nav.bankPrivate' },
  ]},
  { section: 'sec.analysis', items: [
    { id: 'kontrahenci',  path: '/kontrahenci',  icon: 'Users',    label: 'nav.contractors' },
    { id: 'koszty',       path: '/koszty',       icon: 'PieChart', label: 'nav.costAnalysis' },
    { id: 'raporty',      path: '/raporty',      icon: 'BarChart', label: 'nav.reports' },
  ]},
  { section: 'sec.admin', items: [
    { id: 'dokumenty',    path: '/dokumenty',    icon: 'FileText',    label: 'nav.documents' },
    { id: 'jpk',          path: '/jpk',          icon: 'ShieldCheck', label: 'nav.jpk',      admin: true },
    { id: 'ustawienia',   path: '/ustawienia',   icon: 'Settings',    label: 'nav.settings', admin: true },
  ]},
];

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export function Sidebar({ lang }: { lang: Lang }) {
  const t = makeT(lang);
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarCollapsed: collapsed, setSidebarCollapsed } = useUiStore();
  const { user, logout } = useAuth();
  const { active } = useContextStore();

  const allowed = SCREENS_BY_CONTEXT[active] ?? SCREENS_BY_CONTEXT.jdg;
  const currentId = location.pathname === '/' ? '' : location.pathname.replace('/', '').split('/')[0];

  // Filtruj sekcje i pozycje wg kontekstu
  const visibleNav = NAV
    .map(sec => ({ ...sec, items: sec.items.filter(it => allowed.includes(it.id)) }))
    .filter(sec => sec.items.length > 0);

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        {/* Znak niesie własne navy tło — renderujemy bezpośrednio, bez dodatkowego boxa */}
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <FinanceMark size={34} />
        </div>
        {!collapsed && (
          <>
            <div className="sidebar-brand" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, fontFamily: "'Poppins', system-ui, sans-serif" }}>
              <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: '#0A2540' }}>
                Logistic<span style={{ color: '#1C7C56' }}>Fit</span>
              </span>
              <span style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: '0.34em', color: '#5B7186', marginTop: 3 }}>
                FINANCE
              </span>
            </div>
            <button className="sidebar-collapse-btn" onClick={() => setSidebarCollapsed(true)} aria-label="Zwiń">
              <Ico name="PanelLeftClose" size={15} />
            </button>
          </>
        )}
      </div>

      {collapsed && (
        <div style={{ padding: '8px 12px' }}>
          <button className="icon-btn" onClick={() => setSidebarCollapsed(false)} aria-label="Rozwiń" style={{ margin: '0 auto', display: 'flex' }}>
            <Ico name="PanelLeft" size={18} />
          </button>
        </div>
      )}

      <nav className="sidebar-nav">
        {visibleNav.map(sec => (
          <div key={sec.section}>
            <div className="sidebar-section">{t(sec.section)}</div>
            {sec.items.map(it => (
              <button
                key={it.id}
                className="nav-item"
                data-active={currentId === it.id ? 'true' : 'false'}
                data-admin={'admin' in it && it.admin ? 'true' : 'false'}
                onClick={() => navigate(it.path)}
                title={collapsed ? t(it.label) : undefined}
              >
                <span className="nav-icon"><Ico name={it.icon} size={18} /></span>
                <span className="nav-label">{t(it.label)}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-user">
        <span className="avatar" data-color="navy" title={user?.name ?? 'MR'}>
          {initials(user?.name ?? 'Michał Rzeźnik')}
        </span>
        {!collapsed && (
          <>
            <div className="user-meta">
              <div className="name">{user?.name ?? 'Michał Rzeźnik'}</div>
              <div className="email">{user?.username ?? 'michal@logisticfit.com'}</div>
            </div>
            <button className="user-action" onClick={logout} aria-label="Wyloguj" title="Wyloguj">
              <Ico name="ChevronDown" size={16} />
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
