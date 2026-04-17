import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquare,
  Database,
  Clock,
  Puzzle,
  Settings,
  ScrollText,
  Zap,
} from "lucide-react";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/chat", icon: MessageSquare, label: "Chat" },
  { to: "/memory", icon: Database, label: "Memory" },
  { to: "/cron", icon: Clock, label: "Cron" },
  { to: "/skills", icon: Puzzle, label: "Skills" },
  { to: "/logs", icon: ScrollText, label: "Logs" },
  { to: "/config", icon: Settings, label: "Config" },
];

export default function Sidebar() {
  return (
    <aside className="flex flex-col w-56 min-h-screen bg-gray-900 border-r border-gray-800">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-14 border-b border-gray-800">
        <Zap className="w-5 h-5 text-blue-400" />
        <span className="text-sm font-semibold tracking-wide text-white">
          Live Agent
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-0.5 px-2">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              [
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-gray-400 hover:text-gray-100 hover:bg-gray-800",
              ].join(" ")
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-gray-800 text-xs text-gray-600">
        live-agent v0.1.0
      </div>
    </aside>
  );
}
