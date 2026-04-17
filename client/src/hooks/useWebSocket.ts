import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { agentWs } from "@/lib/ws";
import type { WsMessage } from "@/types/api";

export function useWsConnection() {
  // initialise from current singleton state so first render is accurate
  const [connected, setConnected] = useState(() => agentWs.connected);

  useEffect(() => {
    agentWs.connect();
    // subscribe — will fire whenever the WS opens/closes
    const off = agentWs.onStateChange(setConnected);
    return off;
  }, []);

  return connected;
}

export function useWsMessages(handler: (msg: WsMessage) => void) {
  const handlerRef = useRef(handler);
  // Keep ref current without triggering renders; useLayoutEffect runs
  // synchronously after DOM mutations but before paint, so the ref is
  // always fresh when the WS message handler fires.
  useLayoutEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const off = agentWs.onMessage((msg) => handlerRef.current(msg));
    return off;
  }, []);
}

export interface ChatState {
  thinking: boolean;
  streaming: string;
  threadId: string | undefined;
}

export function useAgentChat() {
  const [state, setState] = useState<ChatState>({
    thinking: false,
    streaming: "",
    threadId: undefined,
  });

  const sendMessage = useCallback(
    (message: string, threadId?: string) => {
      setState((s) => ({ ...s, thinking: true, streaming: "" }));
      agentWs.send({ message, thread_id: threadId ?? state.threadId });
    },
    [state.threadId],
  );

  useWsMessages((msg) => {
    switch (msg.type) {
      case "thinking":
        setState((s) => ({ ...s, thinking: true }));
        break;
      case "chunk":
        setState((s) => ({
          ...s,
          thinking: false,
          streaming: s.streaming + msg.content,
        }));
        break;
      case "done":
        setState((s) => ({
          ...s,
          thinking: false,
          streaming: "",
          threadId: msg.thread_id ?? s.threadId,
        }));
        break;
      case "error":
        setState((s) => ({ ...s, thinking: false, streaming: "" }));
        break;
    }
  });

  return { ...state, sendMessage };
}
