import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Bot, User, CheckCircle2, Circle, Loader } from "lucide-react";
import { agentWs } from "@/lib/ws";
import { useWsConnection, useWsMessages } from "@/hooks/useWebSocket";
import type { AgentTodo, WsMessage } from "@/types/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

export default function AgentChat() {
  const connected = useWsConnection();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [threadId, setThreadId] = useState<string | undefined>();
  const [todos, setTodos] = useState<AgentTodo[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const assistantIdRef = useRef<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  useWsMessages(
    useCallback((msg: WsMessage) => {
      switch (msg.type) {
        case "thinking":
          setThinking(true);
          assistantIdRef.current = null;
          break;

        case "chunk": {
          const chunkId = assistantIdRef.current ?? `asst-${Date.now()}`;
          if (!assistantIdRef.current) {
            assistantIdRef.current = chunkId;
            setMessages((prev) => [
              ...prev,
              { id: chunkId, role: "assistant", content: msg.content, streaming: true },
            ]);
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === chunkId
                  ? { ...m, content: m.content + msg.content }
                  : m,
              ),
            );
          }
          setThinking(false);
          break;
        }

        case "done":
          assistantIdRef.current = null;
          setThinking(false);
          setMessages((prev) =>
            prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)),
          );
          if (msg.thread_id) setThreadId(msg.thread_id);
          break;

        case "error":
          setThinking(false);
          assistantIdRef.current = null;
          setMessages((prev) => [
            ...prev,
            { id: `err-${Date.now()}`, role: "assistant", content: `⚠️ Error: ${msg.error}` },
          ]);
          break;

        case "todos":
          setTodos(msg.todos);
          break;
      }
    }, []),
  );

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || !connected || thinking) return;
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: "user", content: text },
    ]);
    setInput("");
    setThinking(true);
    agentWs.send({ message: text, thread_id: threadId });
  }, [input, connected, thinking, threadId]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }, [send]);

  return (
    <div className="flex h-full">
      {/* Chat area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && !thinking && (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-600 gap-2">
              <Bot className="w-8 h-8" />
              <p className="text-sm">Send a message to start a conversation</p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-blue-600/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-blue-400" />
                </div>
              )}
              <div
                className={[
                  "max-w-[72%] rounded-lg px-3.5 py-2.5 text-sm whitespace-pre-wrap",
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-100",
                ].join(" ")}
              >
                {msg.content}
                {msg.streaming && (
                  <span className="inline-block w-0.5 h-4 ml-0.5 bg-blue-400 animate-pulse" />
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                </div>
              )}
            </div>
          ))}

          {thinking && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-600/20 flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div className="bg-gray-800 rounded-lg px-3.5 py-2.5 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                <span className="text-sm text-gray-400">Thinking…</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-gray-800">
          {threadId && (
            <p className="text-xs text-gray-600 mb-2">
              Thread: <span className="font-mono">{threadId}</span>
            </p>
          )}
          <div className="flex gap-2">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={connected ? "Message the agent…" : "Connecting…"}
              disabled={!connected || thinking}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-600 resize-none focus:outline-none focus:border-blue-600 disabled:opacity-50 transition-colors"
            />
            <button
              onClick={send}
              disabled={!connected || thinking || !input.trim()}
              className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Todos panel */}
      {todos.length > 0 && (
        <div className="w-64 border-l border-gray-800 bg-gray-900 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-800 text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Agent Tasks
          </div>
          <div className="flex-1 overflow-y-auto py-2 px-3 space-y-1.5">
            {todos.map((todo) => (
              <div
                key={todo.id}
                className="flex items-start gap-2 text-xs text-gray-300"
              >
                {todo.status === "done" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />
                ) : todo.status === "in_progress" ? (
                  <Loader className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-gray-600 shrink-0 mt-0.5" />
                )}
                <span
                  className={
                    todo.status === "done" ? "line-through text-gray-600" : ""
                  }
                >
                  {todo.content}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
