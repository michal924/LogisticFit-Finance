import { useState, useEffect } from 'react';
import { useUiStore } from '../../stores/uiStore';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Receipt, TrendingDown, Landmark, Wallet,
  Users, BarChart2, FileText, PieChart, Settings, ChevronDown, PanelLeftClose, PanelLeft,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import logoWordmark from '../../assets/logo-wordmark.png';
import logoMark from '../../assets/logo-mark.png';

/* ─── Types ──────────────────────────────────────────────────── */
interface NavItem {
  id: string;
  path: string;
  label: string;
  Icon: React.ElementType;
  roles: string[];
  adminFlag?: boolean;
  badge?: number;
}
interface NavSection {
  key: string;
  title: string;
  items: NavItem[];
}

/* ─── Nav blueprint ──────────────────────────────────────────── */
const NAV_SECTIONS: NavSection[] = [
  {
    key: 'invoices', title: 'Faktury',
    items: [
      { id: '',                    path: '/',                      label: 'Dashboard',           Icon: LayoutDashboard, roles: ['*'] },
      { id: 'faktury-sprzedazy',   path: '/faktury-sprzedazy',     label: 'Faktury sprzedaży',   Icon: Receipt,         roles: ['*'] },
      { id: 'faktury-kosztowe',    path: '/faktury-kosztowe',      label: 'Faktury kosztowe',    Icon: TrendingDown,    roles: ['*'] },
    ],
  },
  {
    key: 'bank', title: 'Bank',
    items: [
      { id: 'bank',                path: '/bank',                  label: 'Bank firmowy',        Icon: Landmark,        roles: ['*'] },
      { id: 'bank-prywatny',       path: '/bank-prywatny',         label: 'Bank prywatny',       Icon: Wallet,          roles: ['*'] },
    ],
  },
  {
    key: 'analysis', title: 'Analiza',
    items: [
      { id: 'kontrahenci',         path: '/kontrahenci',           label: 'Kontrahenci',         Icon: Users,           roles: ['*'] },
      { id: 'koszty',              path: '/koszty',                label: 'Koszty',              Icon: BarChart2,       roles: ['*'] },
      { id: 'raporty',             path: '/raporty',               label: 'Raporty',             Icon: PieChart,        roles: ['*'] },
    ],
  },
  {
    key: 'admin', title: 'Admin',
    items: [
      { id: 'jpk',                 path: '/jpk',                   label: 'JPK',                 Icon: FileText,        roles: ['*'] },
      { id: 'ustawienia',          path: '/ustawienia',            label: 'Ustawienia',          Icon: Settings,        roles: ['*'], adminFlag: true },
    ],
  },
];

/* ─── Badge counts from localStorage ───────────────────────── */
function useNavBadges() {
  const [badges, setBadges] = useState<Record<string, number>>({});

  useEffect(() => {
    function calc() {
      try {
        const clients: { id: string; companyName: string; eudr: { active: boolean; status: string }; ppwr: { active: boolean; status: string } }[] =
          JSON.parse(localStorage.getItem('lf_offer_clients') || '[]');
        const auditMeta: { clientName: string; regulation: string }[] =
          JSON.parse(localStorage.getItem('lf_audit_meta') || '[]');

        // Oferty przyjęte → gotowe do wdrożenia
        const acceptedCount = clients.filter(c =>
          (c.eudr.active && c.eudr.status === 'accepted') ||
          (c.ppwr.active && c.ppwr.status === 'accepted')
        ).length;

        // Gotowe do audytu
        let auditReady = 0;
        for (const c of clients) {
          const regs: string[] = [];
          if (c.eudr?.active && c.eudr?.status === 'accepted') regs.push('eudr');
          if (c.ppwr?.active && c.ppwr?.status === 'accepted') regs.push('ppwr');
          for (const reg of regs) {
            const raw = localStorage.getItem(`lf_impl_${c.id}_${reg}`);
            if (!raw) continue;
            const impl = JSON.parse(raw);
            if ((impl.phase ?? 1) < 2) continue;
            const hasAudit = auditMeta.some(a => a.clientName === c.companyName && a.regulation.toLowerCase() === reg);
            if (!hasAudit) auditReady++;
          }
        }

        setBadges({ implementation: acceptedCount || 0, audits: auditReady || 0 });
      } catch { setBadges({}); }
    }
    calc();
    window.addEventListener('storage', calc);
    const id = setInterval(calc, 5000);
    return () => { window.removeEventListener('storage', calc); clearInterval(id); };
  }, []);

  return badges;
}

/* ─── Avatar ─────────────────────────────────────────────────── */
function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%',
      background: 'var(--lf-navy-100)', color: 'var(--accent)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 700, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

/* ─── Sidebar ────────────────────────────────────────────────── */
export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, user, login, logout, status } = useAuth();
  const { isAdmin } = usePermissions();
  const badges = useNavBadges();

  const { sidebarCollapsed: collapsed, setSidebarCollapsed } = useUiStore();
  const toggleCollapsed = () => setSidebarCollapsed(!collapsed);

  function currentId(): string {
    const path = location.pathname;
    if (path === '/') return 'dashboard';
    return path.replace('/', '').split('/')[0];
  }

  function handleNav(path: string) {
    navigate(path);
  }

  const current = currentId();

  const visibleSections = NAV_SECTIONS.map(sec => ({
    ...sec,
    items: sec.items.filter(() => isAdmin),
  })).filter(sec => sec.items.length > 0);

  return (
    <aside className="sidebar">
      {/* Head */}
      <div className="sidebar-head">
        {!collapsed ? (
          <>
            <div className="sidebar-logo wordmark">
              <img src={logoWordmark} alt="LogisticFit" />
            </div>
            <button className="sidebar-collapse-btn" onClick={toggleCollapsed} aria-label="Zwiń sidebar" title="Zwiń">
              <PanelLeftClose size={14} />
            </button>
          </>
        ) : (
          <div className="sidebar-logo mark">
            <img src={logoMark} alt="LogisticFit" />
          </div>
        )}
      </div>

      {collapsed && (
        <button
          className="icon-btn"
          onClick={toggleCollapsed}
          aria-label="Rozwiń sidebar"
          title="Rozwiń"
          style={{ margin: '10px auto 0', borderColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 8, border: '1px solid transparent', background: 'transparent', cursor: 'pointer', color: 'var(--fg-3)' }}
        >
          <PanelLeft size={16} />
        </button>
      )}

      {/* Nav */}
      <nav className="sidebar-nav">
        {!isLoggedIn && (
          <div style={{ padding: '8px 4px' }}>
            <button
              onClick={login}
              disabled={status === 'loading'}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 8,
                background: 'var(--accent)', color: '#fff',
                border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 8,
              }}
            >
              {!collapsed && (status === 'loading' ? 'Łączenie...' : 'Zaloguj przez Microsoft')}
            </button>
          </div>
        )}

        {visibleSections.map(sec => (
          <div key={sec.key}>
            <div className="sidebar-section">{collapsed ? '' : sec.title}</div>
            {sec.items.map(it => {
              const badgeCount = badges[it.id];
              return (
                <button
                  key={it.id}
                  className="nav-item"
                  data-active={current === it.id ? 'true' : undefined}
                  data-admin={it.adminFlag ? 'true' : undefined}
                  onClick={() => handleNav(it.path)}
                  title={collapsed ? it.label : undefined}
                >
                  <span className="nav-icon"><it.Icon size={17} /></span>
                  <span className="nav-label">{it.label}</span>
                  {badgeCount > 0 && <span className="nav-badge">{badgeCount}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User card */}
      <div className="sidebar-user">
        {isLoggedIn && user ? (
          <>
            <Avatar name={user.name ?? user.username ?? 'U'} />
            {!collapsed && (
              <>
                <div className="user-meta">
                  <div className="name">{user.name ?? user.username}</div>
                  <div className="email">{user.username}</div>
                </div>
                <button className="user-action" onClick={logout} aria-label="Wyloguj" title="Wyloguj">
                  <ChevronDown size={14} />
                </button>
              </>
            )}
          </>
        ) : (
          !collapsed && (
            <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Niezalogowany</div>
          )
        )}
      </div>
    </aside>
  );
}
