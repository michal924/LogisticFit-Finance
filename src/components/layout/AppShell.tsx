import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useUiStore } from '../../stores/uiStore';
import type { Lang } from '../../i18n';

export function AppShell() {
  const { sidebarCollapsed, density } = useUiStore();
  const [lang] = useState<Lang>('pl');
  const [query, setQuery] = useState('');

  return (
    <div
      className="app"
      data-sidebar={sidebarCollapsed ? 'collapsed' : 'expanded'}
      data-density={density}
    >
      <Sidebar lang={lang} />
      <Topbar lang={lang} query={query} setQuery={setQuery} />
      <main className="content">
        <Outlet context={{ lang, query }} />
      </main>
    </div>
  );
}

export default AppShell;
