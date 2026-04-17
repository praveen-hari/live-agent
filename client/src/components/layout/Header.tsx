import { useWsConnection } from "@/hooks/useWebSocket";
import { Wifi, WifiOff } from "lucide-react";

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const connected = useWsConnection();

  return (
    <header className="flex items-center justify-between h-14 px-6 border-b border-gray-800 bg-gray-950 shrink-0">
      <h1 className="text-base font-semibold text-gray-100">{title}</h1>
      <div className="flex items-center gap-1.5 text-xs">
        {connected ? (
          <>
            <Wifi className="w-3.5 h-3.5 text-green-400" />
            <span className="text-green-400">Connected</span>
          </>
        ) : (
          <>
            <WifiOff className="w-3.5 h-3.5 text-red-400" />
            <span className="text-red-400">Disconnected</span>
          </>
        )}
      </div>
    </header>
  );
}
