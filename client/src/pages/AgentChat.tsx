import {
  useState,
  useRef,
  useCallback,
  useMemo,
  memo,
  Fragment,
  FormEvent,
} from 'react';
import React from 'react';
import {
  ArrowUp,
  Square,
  Bot,
  CheckCircle,
  Circle,
  Clock,
  Copy,
  Check,
  Sparkles,
  Cpu,
  Hash,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useStickToBottom } from 'use-stick-to-bottom';
import { useAgentStream } from '@/hooks/useAgentStream';
import type { AgentTodo, ToolCall, RawMessage } from '@/types/api';
import { ToolCallBox } from '@/components/ToolCallBox';
import { ThreadSidebar } from '@/components/ThreadSidebar';

// ── Processed message type ────────────────────────────────────────────────────

interface ProcessedMsg {
  id: string;
  isUser: boolean;
  content: string;
  toolCalls: ToolCall[];
  showAvatar: boolean;
}

// ── MarkdownContent ───────────────────────────────────────────────────────────

const MarkdownContent = memo(function MarkdownContent({
  content,
  streaming = false,
}: {
  content: string;
  streaming?: boolean;
}) {
  return (
    <div className="prose min-w-0 max-w-full overflow-hidden break-words text-sm leading-relaxed text-inherit [&_h1:first-child]:mt-0 [&_h1]:mb-4 [&_h1]:mt-6 [&_h1]:font-semibold [&_h2:first-child]:mt-0 [&_h2]:mb-4 [&_h2]:mt-6 [&_h2]:font-semibold [&_h3:first-child]:mt-0 [&_h3]:mb-4 [&_h3]:mt-6 [&_h3]:font-semibold [&_h4:first-child]:mt-0 [&_h4]:mb-4 [&_h4]:mt-6 [&_h4]:font-semibold [&_p:last-child]:mb-0 [&_p]:mb-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({
            inline,
            className,
            children,
            ...props
          }: {
            inline?: boolean;
            className?: string;
            children?: React.ReactNode;
          }) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <div className="my-4 max-w-full overflow-hidden last:mb-0">
                <CodeBlockWithCopy language={match[1]}>
                  {String(children).replace(/\n$/, '')}
                </CodeBlockWithCopy>
              </div>
            ) : (
              <code
                className="rounded-sm bg-gray-800 px-1 py-0.5 font-mono text-[0.9em] text-blue-300"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre({ children }: { children?: React.ReactNode }) {
            return (
              <div className="my-4 max-w-full overflow-hidden last:mb-0">{children}</div>
            );
          },
          a({ href, children }: { href?: string; children?: React.ReactNode }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 no-underline hover:underline"
              >
                {children}
              </a>
            );
          },
          blockquote({ children }: { children?: React.ReactNode }) {
            return (
              <blockquote className="my-4 border-l-4 border-gray-600 pl-4 italic text-gray-400">
                {children}
              </blockquote>
            );
          },
          ul({ children }: { children?: React.ReactNode }) {
            return (
              <ul className="my-4 pl-6 [&>li:last-child]:mb-0 [&>li]:mb-1">{children}</ul>
            );
          },
          ol({ children }: { children?: React.ReactNode }) {
            return (
              <ol className="my-4 pl-6 [&>li:last-child]:mb-0 [&>li]:mb-1">{children}</ol>
            );
          },
          table({ children }: { children?: React.ReactNode }) {
            return (
              <div className="my-4 overflow-x-auto">
                <table className="w-full border-collapse [&_td]:border [&_td]:border-gray-700 [&_td]:p-2 [&_th]:border [&_th]:border-gray-700 [&_th]:bg-gray-800 [&_th]:p-2 [&_th]:text-left [&_th]:font-semibold">
                  {children}
                </table>
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
      {streaming && (
        <span
          className="ml-[1px] inline-block h-[1em] w-[2px] align-middle rounded-sm bg-blue-400"
          style={{ animation: 'blink 0.8s step-end infinite' }}
        />
      )}
    </div>
  );
});

// ── Code block with copy button ───────────────────────────────────────────────

function CodeBlockWithCopy({ language, children }: { language: string; children: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-lg border border-gray-700">
      <div className="flex items-center justify-between bg-gray-900/80 px-3 py-1.5">
        <span className="font-mono text-[11px] text-gray-500">{language}</span>
        <button
          onClick={() =>
            navigator.clipboard.writeText(children).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            })
          }
          className="flex items-center gap-1 text-[11px] text-gray-500 transition-colors hover:text-gray-200"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-green-400" />
              <span className="text-green-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        PreTag="div"
        wrapLines
        wrapLongLines
        lineProps={{ style: { wordBreak: 'break-all', whiteSpace: 'pre-wrap' } }}
        customStyle={{
          margin: 0,
          maxWidth: '100%',
          overflowX: 'auto',
          fontSize: '0.8rem',
          background: '#0d1117',
        }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

// ── Thinking dots ─────────────────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <span className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-blue-400"
          style={{
            animation: 'thinkPulse 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </span>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() =>
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
      }
      className="rounded p-1 text-gray-600 transition-colors hover:bg-gray-700/60 hover:text-gray-300"
    >
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

// ── Todo status icon ──────────────────────────────────────────────────────────

function TodoStatusIcon({ status }: { status: AgentTodo['status'] }) {
  if (status === 'done')
    return <CheckCircle size={14} className="mt-0.5 shrink-0 text-green-400" />;
  if (status === 'in_progress')
    return (
      <Clock
        size={14}
        className="mt-0.5 shrink-0 text-yellow-400"
        style={{ animation: 'spin 2s linear infinite' }}
      />
    );
  return <Circle size={14} className="mt-0.5 shrink-0 text-gray-600" />;
}

// ── SubAgentCard ──────────────────────────────────────────────────────────────

const SubAgentCard = memo(function SubAgentCard({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(true);
  const subAgentName = String(toolCall.args['subagent_type'] ?? toolCall.name);
  const inputContent =
    typeof toolCall.args['description'] === 'string'
      ? toolCall.args['description']
      : typeof toolCall.args['prompt'] === 'string'
        ? toolCall.args['prompt']
        : JSON.stringify(toolCall.args, null, 2);
  return (
    <div className="w-full max-w-full overflow-hidden rounded-lg border border-gray-700/50 bg-gray-800/30">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left"
      >
        <span className="text-[14px] font-bold tracking-tight text-gray-300">{subAgentName}</span>
        {expanded ? (
          <ChevronUp size={13} className="shrink-0 text-gray-600" />
        ) : (
          <ChevronDown size={13} className="shrink-0 text-gray-600" />
        )}
      </button>
      {expanded && (
        <div className="space-y-3 border-t border-gray-700/50 px-4 pb-4 pt-3">
          <div>
            <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
              Input
            </h4>
            <MarkdownContent content={inputContent} />
          </div>
          {toolCall.result && (
            <div>
              <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                Output
              </h4>
              <MarkdownContent content={toolCall.result} />
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ── ChatMessageRow ────────────────────────────────────────────────────────────

const ChatMessageRow = memo(function ChatMessageRow({
  msg,
  isStreaming,
  showAvatar,
}: {
  msg: ProcessedMsg;
  isStreaming: boolean;
  showAvatar: boolean;
}) {
  const { isUser, content, toolCalls } = msg;
  const [hovered, setHovered] = useState(false);
  const hasContent = content.trim() !== '';

  const regularToolCalls = toolCalls.filter((tc) => tc.name !== 'task');
  const subAgentCalls = toolCalls.filter(
    (tc) => tc.name === 'task' && tc.args['subagent_type'],
  );

  return (
    <div
      className={['flex w-full max-w-full overflow-x-hidden', isUser && 'flex-row-reverse']
        .filter(Boolean)
        .join(' ')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={['min-w-0 max-w-full', isUser ? 'max-w-[70%]' : 'w-full'].join(' ')}>
        {hasContent && (
          <div
            className={['relative flex items-end gap-0', isUser && 'justify-end']
              .filter(Boolean)
              .join(' ')}
          >
            {!isUser && showAvatar && (
              <div className="mb-0.5 mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-blue-500/20 bg-gradient-to-br from-blue-600/30 to-purple-600/30">
                <Bot className="h-3 w-3 text-blue-400" />
              </div>
            )}
            {!isUser && !showAvatar && <div className="mr-2 w-6 shrink-0" />}
            <div
              className={[
                'mt-4 overflow-hidden break-words text-sm font-normal leading-[150%]',
                isUser
                  ? 'rounded-xl rounded-br-none border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100'
                  : 'text-gray-100',
              ].join(' ')}
            >
              {isUser ? (
                <p className="m-0 whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {content}
                </p>
              ) : (
                <MarkdownContent content={content} streaming={isStreaming} />
              )}
            </div>
          </div>
        )}

        {/* Regular tool calls */}
        {!isUser && regularToolCalls.length > 0 && (
          <div className="ml-8 mt-4 flex w-full flex-col gap-1">
            {regularToolCalls.map((tc) => (
              <ToolCallBox key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}

        {/* Sub-agent calls */}
        {!isUser && subAgentCalls.length > 0 && (
          <div className="ml-8 mt-4 flex flex-col gap-3">
            {subAgentCalls.map((tc) => (
              <SubAgentCard key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}

        {/* Hover copy button */}
        {hasContent && (
          <div
            className={[
              'mt-0.5 flex items-center gap-1 transition-opacity duration-150',
              isUser ? 'justify-end' : 'pl-8',
              hovered ? 'opacity-100' : 'opacity-0',
            ].join(' ')}
          >
            <CopyButton text={content} />
          </div>
        )}
      </div>
    </div>
  );
});

// ── Main AgentChat component ──────────────────────────────────────────────────

export default function AgentChat() {
  const [input, setInput] = useState('');
  const [metaOpen, setMetaOpen] = useState<'tasks' | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    rawMessages,
    isStreaming,
    error: streamError,
    threadId,
    threads,
    send: sendMsg,
    stop,
    startNewThread,
    switchThread,
    deleteThread,
  } = useAgentStream();

  const { scrollRef, contentRef } = useStickToBottom({ resize: 'smooth', initial: 'instant' });

  // Placeholder todos — extend when backend surfaces them in SSE values event
  const todos: AgentTodo[] = [];

  const adjustTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, []);

  // ── processedMessages ─────────────────────────────────────────────────────
  const processedMessages = useMemo((): ProcessedMsg[] => {
    // During streaming rawMessages hasn't been updated for the current exchange yet
    if (isStreaming || rawMessages.length === 0) {
      return messages.map((msg, i): ProcessedMsg => ({
        id: msg.id,
        isUser: msg.role === 'user',
        content: msg.content,
        toolCalls: [],
        showAvatar: i === 0 || messages[i - 1].role !== msg.role,
      }));
    }

    // After streaming: derive full tool-call context from rawMessages
    const messageMap = new Map<string, { raw: RawMessage; toolCalls: ToolCall[] }>();

    rawMessages.forEach((msg) => {
      if (msg.type === 'ai') {
        const tcs: ToolCall[] = (msg.tool_calls ?? []).map((tc) => ({
          id: tc.id,
          name: tc.name,
          args: tc.args,
          status: 'pending' as const,
        }));
        messageMap.set(msg.id, { raw: msg, toolCalls: tcs });
      } else if (msg.type === 'tool' && msg.tool_call_id) {
        for (const [, data] of messageMap.entries()) {
          const idx = data.toolCalls.findIndex((tc) => tc.id === msg.tool_call_id);
          if (idx !== -1) {
            data.toolCalls[idx] = {
              ...data.toolCalls[idx],
              status: 'completed' as const,
              result: msg.content,
            };
            break;
          }
        }
      } else if (msg.type === 'human') {
        messageMap.set(msg.id, { raw: msg, toolCalls: [] });
      }
    });

    const arr = Array.from(messageMap.values());
    return arr.map((data, i): ProcessedMsg => ({
      id: data.raw.id,
      isUser: data.raw.type === 'human',
      content: data.raw.content,
      toolCalls: data.toolCalls,
      showAvatar: i === 0 || arr[i - 1].raw.type !== data.raw.type,
    }));
  }, [isStreaming, messages, rawMessages]);

  const lastMsg = processedMessages.at(-1);
  const isActiveStreaming =
    isStreaming && !!lastMsg && !lastMsg.isUser && lastMsg.content !== '';
  const isThinking = isStreaming && !isActiveStreaming;

  const streamedTokens = useMemo(
    () => (isActiveStreaming && lastMsg ? Math.ceil(lastMsg.content.length / 4) : 0),
    [isActiveStreaming, lastMsg],
  );

  const hasTasks = todos.length > 0;
  const groupedTodos = useMemo(
    () => ({
      in_progress: todos.filter((t) => t.status === 'in_progress'),
      pending: todos.filter((t) => t.status === 'pending'),
      done: todos.filter((t) => t.status === 'done'),
    }),
    [todos],
  );

  const send = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      const text = input.trim();
      if (!text || isStreaming) return;
      setInput('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      void sendMsg(text);
    },
    [input, isStreaming, sendMsg],
  );

  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    },
    [send],
  );

  return (
    <>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes thinkPulse {
          0%,80%,100%{transform:scale(0.6);opacity:0.4}
          40%{transform:scale(1);opacity:1}
        }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        .msg-enter { animation: fadeUp 0.18s ease-out; }
      `}</style>

      <div className="flex h-full flex-1 overflow-hidden">
        {/* Thread sidebar */}
        <ThreadSidebar
          threads={threads}
          activeThreadId={threadId}
          onNewThread={startNewThread}
          onSwitchThread={switchThread}
          onDeleteThread={deleteThread}
        />

        {/* Main chat area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900/60 px-5 py-2.5 backdrop-blur-sm">
            <div className="flex items-center gap-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-purple-600">
                <Sparkles className="h-3 w-3 text-white" />
              </div>
              <span className="text-sm font-semibold text-gray-200">Live Agent</span>
              <span className="flex items-center gap-1 rounded-full border border-gray-700/60 bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-500">
                <Cpu className="h-2.5 w-2.5" />
                claude-sonnet
              </span>
            </div>
            <div className="flex items-center gap-3">
              {isStreaming && (
                <span className="flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-[10px] text-blue-400">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-blue-400"
                    style={{ animation: 'blink 1s ease infinite' }}
                  />
                  {streamedTokens} tokens
                </span>
              )}
              {threadId && (
                <span className="flex items-center gap-1 rounded bg-gray-800 px-2 py-1 font-mono text-[10px] text-gray-600">
                  <Hash className="h-2.5 w-2.5" />
                  {String(threadId).slice(0, 8)}…
                </span>
              )}
            </div>
          </div>

          {/* Messages scroll area */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden" ref={scrollRef}>
            <div
              className="mx-auto w-full max-w-[860px] px-6 pb-6 pt-4"
              ref={contentRef}
            >
              {processedMessages.length === 0 && !isStreaming && (
                <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-600/20 to-purple-600/20">
                    <Bot className="h-6 w-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="mb-1 text-sm font-medium text-gray-300">
                      How can I help you today?
                    </p>
                    <p className="text-xs text-gray-600">
                      Ask anything — I can browse the web, write code, and more.
                    </p>
                  </div>
                </div>
              )}

              {processedMessages.map((msg, idx) => (
                <div key={msg.id} className="msg-enter">
                  <ChatMessageRow
                    msg={msg}
                    isStreaming={isActiveStreaming && idx === processedMessages.length - 1}
                    showAvatar={msg.showAvatar}
                  />
                </div>
              ))}

              {isThinking && (
                <div className="msg-enter mt-3 flex items-end gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-blue-500/20 bg-gradient-to-br from-blue-600/30 to-purple-600/30">
                    <Bot className="h-3 w-3 text-blue-400" />
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-gray-700/60 bg-gray-800/60 px-4 py-3">
                    <ThinkingDots />
                    <span className="text-xs text-gray-500">Thinking…</span>
                  </div>
                </div>
              )}

              {streamError && (
                <div className="mt-3 flex gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-red-500/20 bg-red-900/30">
                    <Bot className="h-3 w-3 text-red-400" />
                  </div>
                  <div className="rounded-xl border border-red-900/40 bg-gray-800/60 px-4 py-2.5 text-sm text-red-400">
                    ⚠ {streamError}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Input area */}
          <div className="shrink-0 bg-gray-950">
            <div className="mx-auto mb-5 flex w-[calc(100%-32px)] max-w-[860px] flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-900/80">
              {/* Tasks panel */}
              {hasTasks && (
                <div className="flex max-h-72 flex-col overflow-y-auto border-b border-gray-800 bg-gray-900/50">
                  {metaOpen === null ? (
                    <button
                      type="button"
                      onClick={() => setMetaOpen('tasks')}
                      className="grid w-full cursor-pointer grid-cols-[auto_auto_1fr] items-center gap-3 px-[18px] py-3 text-left"
                    >
                      {(() => {
                        const active = todos.find((t) => t.status === 'in_progress');
                        const done = groupedTodos.done.length;
                        const total = todos.length;
                        if (done === total)
                          return [
                            <CheckCircle key="i" size={16} className="text-green-400/80" />,
                            <span
                              key="l"
                              className="ml-[1px] min-w-0 truncate text-sm text-gray-300"
                            >
                              All tasks completed
                            </span>,
                          ];
                        if (active)
                          return [
                            <Clock key="i" size={16} className="text-yellow-400/80" />,
                            <span key="l" className="ml-[1px] min-w-0 truncate text-sm">
                              Task {done} of {total}
                            </span>,
                            <span key="c" className="min-w-0 truncate text-sm text-gray-500">
                              {active.content}
                            </span>,
                          ];
                        return [
                          <Circle key="i" size={16} className="text-gray-600" />,
                          <span key="l" className="ml-[1px] min-w-0 truncate text-sm">
                            Task {done} of {total}
                          </span>,
                        ];
                      })()}
                    </button>
                  ) : (
                    <>
                      <div className="sticky top-0 flex items-stretch border-b border-gray-800 bg-gray-900/80 text-sm">
                        <button
                          type="button"
                          className="px-[18px] py-3 font-semibold text-gray-300"
                          onClick={() => setMetaOpen(null)}
                        >
                          Tasks
                        </button>
                        <button
                          aria-label="Close"
                          className="flex-1"
                          onClick={() => setMetaOpen(null)}
                        />
                      </div>
                      <div className="px-[18px] py-3">
                        {(Object.entries(groupedTodos) as [string, AgentTodo[]][])
                          .filter(([, arr]) => arr.length > 0)
                          .map(([status, arr]) => (
                            <div key={status} className="mb-4">
                              <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                                {
                                  {
                                    pending: 'Pending',
                                    in_progress: 'In Progress',
                                    done: 'Completed',
                                  }[status]
                                }
                              </h3>
                              <div className="grid grid-cols-[auto_1fr] gap-3 p-1 pl-0 text-sm">
                                {arr.map((todo, i) => (
                                  <Fragment key={`${status}_${todo.id}_${i}`}>
                                    <TodoStatusIcon status={todo.status} />
                                    <span className="break-words text-gray-300">
                                      {todo.content}
                                    </span>
                                  </Fragment>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Textarea + send button */}
              <form onSubmit={send} className="flex flex-col">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    adjustTextarea();
                  }}
                  onKeyDown={handleKey}
                  placeholder={isStreaming ? 'Running…' : 'Write your message…'}
                  rows={1}
                  className="flex-1 resize-none border-0 bg-transparent px-[18px] pb-[13px] pt-[14px] text-sm leading-7 text-gray-100 outline-none placeholder:text-gray-600"
                  style={{ maxHeight: '160px' }}
                />
                <div className="flex justify-end gap-2 p-3">
                  <button
                    type={isStreaming ? 'button' : 'submit'}
                    onClick={isStreaming ? stop : undefined}
                    disabled={!isStreaming && !input.trim()}
                    className={[
                      'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                      isStreaming
                        ? 'bg-red-600/20 text-red-400 hover:bg-red-600/40'
                        : 'bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-30',
                    ].join(' ')}
                  >
                    {isStreaming ? (
                      <>
                        <Square size={14} />
                        <span>Stop</span>
                      </>
                    ) : (
                      <>
                        <ArrowUp size={18} />
                        <span>Send</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
