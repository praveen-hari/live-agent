/**
 * ToolCallBox — collapsible tool call display.
 * Mirrors deep-agents-ui's ToolCallBox adapted for plain Tailwind dark theme.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Terminal,
  AlertCircle,
  Loader2,
  CircleCheck,
  StopCircle,
} from 'lucide-react';
import type { ToolCall } from '@/types/api';

interface ToolCallBoxProps {
  toolCall: ToolCall;
  isLoading?: boolean;
}

export const ToolCallBox = React.memo<ToolCallBoxProps>(({ toolCall, isLoading: _isLoading }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedArgs, setExpandedArgs] = useState<Record<string, boolean>>({});

  const { name, args, result, status } = useMemo(
    () => ({
      name: toolCall.name || 'Unknown Tool',
      args: toolCall.args || {},
      result: toolCall.result,
      status: toolCall.status || 'completed',
    }),
    [toolCall],
  );

  const statusIcon = useMemo(() => {
    switch (status) {
      case 'completed':
        return <CircleCheck size={14} className="text-green-400 shrink-0" />;
      case 'error':
        return <AlertCircle size={14} className="text-red-400 shrink-0" />;
      case 'pending':
        return <Loader2 size={14} className="animate-spin text-blue-400 shrink-0" />;
      case 'interrupted':
        return <StopCircle size={14} className="text-orange-400 shrink-0" />;
      default:
        return <Terminal size={14} className="text-gray-500 shrink-0" />;
    }
  }, [status]);

  const toggleExpanded = useCallback(() => setIsExpanded((p) => !p), []);
  const toggleArg = useCallback(
    (key: string) => setExpandedArgs((p) => ({ ...p, [key]: !p[key] })),
    [],
  );

  const hasContent = result !== undefined || Object.keys(args).length > 0;

  return (
    <div
      className={[
        'w-full overflow-hidden rounded-lg transition-colors duration-150',
        isExpanded && hasContent ? 'bg-gray-800/50' : 'hover:bg-gray-800/30',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={hasContent ? toggleExpanded : undefined}
        disabled={!hasContent}
        className="flex w-full items-center justify-between gap-2 px-2 py-2 text-left disabled:cursor-default"
      >
        <div className="flex items-center gap-2">
          {statusIcon}
          <span className="text-[14px] font-medium tracking-tight text-gray-200">{name}</span>
        </div>
        {hasContent &&
          (isExpanded ? (
            <ChevronUp size={13} className="shrink-0 text-gray-600" />
          ) : (
            <ChevronDown size={13} className="shrink-0 text-gray-600" />
          ))}
      </button>

      {isExpanded && hasContent && (
        <div className="px-4 pb-4 space-y-3">
          {Object.keys(args).length > 0 && (
            <div>
              <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                Arguments
              </h4>
              <div className="space-y-1.5">
                {Object.entries(args).map(([key, value]) => (
                  <div key={key} className="rounded border border-gray-700/60 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleArg(key)}
                      className="flex w-full items-center justify-between bg-gray-900/50 px-2 py-1.5 text-left text-xs font-medium hover:bg-gray-900/80 transition-colors"
                    >
                      <span className="font-mono text-gray-400">{key}</span>
                      {expandedArgs[key] ? (
                        <ChevronUp size={11} className="text-gray-600" />
                      ) : (
                        <ChevronDown size={11} className="text-gray-600" />
                      )}
                    </button>
                    {expandedArgs[key] && (
                      <div className="border-t border-gray-700/60 bg-gray-900/30 p-2">
                        <pre className="m-0 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-5 text-gray-300">
                          {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {result !== undefined && (
            <div>
              <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                Result
              </h4>
              <pre className="m-0 overflow-x-auto whitespace-pre-wrap break-all rounded border border-gray-700/60 bg-gray-900/40 p-2 font-mono text-[11px] leading-5 text-gray-300">
                {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

ToolCallBox.displayName = 'ToolCallBox';
