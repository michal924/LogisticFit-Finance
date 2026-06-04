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
  jdg:    ['', 'faktury-sprzedazy', 'faktury-kosztowe', 'bank', 'kontrahenci', 'koszty', 'raporty', 'jpk', 'ustawienia'],
  spolka: ['', 'faktury-sprzedazy', 'faktury-kosztowe', 'bank', 'kontrahenci', 'koszty', 'raporty', 'jpk', 'ustawienia'],
  // Prywatne: tylko przepływy + analiza, bez faktur/VAT/kontrahentów
  prywatne: ['', 'bank-prywatny', 'koszty', 'raporty', 'ustawienia'],
};

// Finance module mark — navy ring + green growth arrow
function FinanceMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="11 11 78 78" fill="none" aria-label="Finance">
      <path d="M 76.0 29.7 A 33 33 0 1 1 60.2 18.6" stroke="var(--lf-navy)" strokeWidth="9" strokeLinecap="round" />
      <line x1="34" y1="66" x2="74" y2="26" stroke="var(--lf-green)" strokeWidth="9" strokeLinecap="round" />
      <polyline points="58 26 76 24 74 42" fill="none" stroke="var(--lf-green)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
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
        <div className="sidebar-logo" style={{ background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FinanceMark size={26} />
        </div>
        {!collapsed && (
          <>
            <div className="sidebar-brand">
              <span style={{ fontWeight: 800, letterSpacing: '-0.02em' }}>Finance</span>
              <span className="sub"><span style={{ color: 'var(--lf-navy)' }}>Logistic</span><span style={{ color: 'var(--lf-green)' }}>Fit</span></span>
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
