import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useUiStore } from '../../stores/uiStore';
import { useContextStore } from '../../stores/contextStore';
import type { Lang } from '../../i18n';

export function AppShell() {
  const { sidebarCollapsed, density } = useUiStore();
  const { active } = useContextStore();
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
        {/* key={active} wymusza remount stron przy zmianie kontekstu → przeładowanie danych */}
        <Outlet key={active} context={{ lang, query, context: active }} />
      </main>
    </div>
  );
}

export default AppShell;
