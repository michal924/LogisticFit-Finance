import { useNavigate, useLocation } from 'react-router-dom';
import { useUiStore } from '../../stores/uiStore';
import { useAuth } from '../../hooks/useAuth';
import { Ico } from '../ui/icons';
import type { Lang } from '../../i18n';
import { makeT } from '../../i18n';

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

  const currentId = location.pathname === '/' ? '' : location.pathname.replace('/', '').split('/')[0];

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="sidebar-logo">
          <img src="/logo-mark.png" alt="LogisticFit" />
        </div>
        {!collapsed && (
          <>
            <div className="sidebar-brand">
              <span><strong>Finance</strong></span>
              <span className="sub">LogisticFit</span>
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
        {NAV.map(sec => (
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
