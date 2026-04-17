import { useEffect, useRef, useState, useCallback } from "react";
import { agentWs } from "@/lib/ws";
import type { WsMessage } from "@/types/api";

export function useWsConnection() {
  const [connected, setConnected] = useState(agentWs.connected);

  useEffect(() => {
    agentWs.connect();
    const off = agentWs.onStateChange(setConnected);
    setConnected(agentWs.connected);
    return off;
  }, []);

  return connected;
}

export function useWsMessages(handler: (msg: WsMessage) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

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
