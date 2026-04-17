import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/chat": "Agent Chat",
  "/memory": "Memory",
  "/cron": "Cron Jobs",
  "/skills": "Skills",
  "/logs": "Logs",
  "/config": "Configuration",
};

export default function Layout() {
  const { pathname } = useLocation();
  const title = TITLES[pathname] ?? "Live Agent";

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title={title} />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
