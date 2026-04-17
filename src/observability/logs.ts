/**
 * In-memory ring buffer for recent log entries.
 * The gateway exposes these via GET /api/logs.
 */

export interface LogEntry {
  id: string;
  level: "info" | "warn" | "error";
  message: string;
  timestamp: string;
  source?: string;
}

const MAX_LOGS = 500;
const _logs: LogEntry[] = [];

export function addLog(
  level: LogEntry["level"],
  message: string,
  source?: string,
): void {
  _logs.push({
    id: crypto.randomUUID(),
    level,
    message,
    timestamp: new Date().toISOString(),
    source,
  });
  if (_logs.length > MAX_LOGS) _logs.shift();
}

export function getLogs(limit = 100): LogEntry[] {
  return _logs.slice(-limit);
}

// Patch console to capture logs
const _origInfo = console.log.bind(console);
const _origWarn = console.warn.bind(console);
const _origError = console.error.bind(console);

console.log = (...args: unknown[]) => {
  _origInfo(...args);
  addLog("info", args.map(String).join(" "));
};
console.warn = (...args: unknown[]) => {
  _origWarn(...args);
  addLog("warn", args.map(String).join(" "));
};
console.error = (...args: unknown[]) => {
  _origError(...args);
  addLog("error", args.map(String).join(" "));
};
