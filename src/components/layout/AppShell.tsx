import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { StagingBar } from "./StagingBar";
import { useUiStore } from "../../stores/uiStore";

export function AppShell() {
  const env = import.meta.env.VITE_ENV ?? "prod";
  const isStaging = env === "staging";

  const { sidebarCollapsed, density } = useUiStore();

  return (
    <div
      className="app"
      data-sidebar={sidebarCollapsed ? "collapsed" : "expanded"}
      data-staging={isStaging ? "true" : "false"}
      data-density={density}
    >
      {isStaging && <StagingBar />}
      <Sidebar />
      <Topbar />
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
