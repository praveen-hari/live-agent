import { Routes, Route } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import Dashboard from "@/pages/Dashboard";
import AgentChat from "@/pages/AgentChat";
import Memory from "@/pages/Memory";
import Cron from "@/pages/Cron";
import Skills from "@/pages/Skills";
import Logs from "@/pages/Logs";
import Config from "@/pages/Config";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="chat" element={<AgentChat />} />
        <Route path="memory" element={<Memory />} />
        <Route path="cron" element={<Cron />} />
        <Route path="skills" element={<Skills />} />
        <Route path="logs" element={<Logs />} />
        <Route path="config" element={<Config />} />
      </Route>
    </Routes>
  );
}
