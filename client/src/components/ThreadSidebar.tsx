/**
 * ThreadSidebar — conversation thread history panel.
 * Mirrors deep-agents-ui's ThreadList adapted for localStorage persistence.
 */

import React, { useState } from 'react';
import { MessageSquare, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Thread } from '@/types/api';

interface ThreadSidebarProps {
  threads: Thread[];
  activeThreadId: string | null;
  onNewThread: () => void;
  onSwitchThread: (id: string) => void;
  onDeleteThread?: (id: string) => void;
}

export const ThreadSidebar = React.memo<ThreadSidebarProps>(
  ({ threads, activeThreadId, onNewThread, onSwitchThread, onDeleteThread }) => {
    const [collapsed, setCollapsed] = useState(false);

    if (collapsed) {
      return (
        <div className="flex h-full flex-col items-center border-r border-gray-800 bg-gray-950 py-3 px-1.5 gap-3 w-10 shrink-0">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
            title="Expand sidebar"
          >
            <ChevronRight size={14} />
          </button>
          <button
            type="button"
            onClick={onNewThread}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
            title="New thread"
          >
            <Plus size={14} />
          </button>
          {threads.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSwitchThread(t.id)}
              className={[
                'p-1.5 rounded-md transition-colors',
                t.id === activeThreadId
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-gray-600 hover:text-gray-400 hover:bg-gray-800',
              ].join(' ')}
              title={t.title}
            >
              <MessageSquare size={13} />
            </button>
          ))}
        </div>
      );
    }

    return (
      <div className="flex h-full w-56 shrink-0 flex-col border-r border-gray-800 bg-gray-950">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-gray-800">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-600">
            Threads
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onNewThread}
              className="p-1 rounded text-gray-600 hover:text-gray-300 hover:bg-gray-800 transition-colors"
              title="New thread"
            >
              <Plus size={13} />
            </button>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="p-1 rounded text-gray-600 hover:text-gray-300 hover:bg-gray-800 transition-colors"
              title="Collapse sidebar"
            >
              <ChevronLeft size={13} />
            </button>
          </div>
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto py-1">
          {threads.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <MessageSquare size={20} className="mx-auto text-gray-700 mb-2" />
              <p className="text-[11px] text-gray-700">No threads yet</p>
            </div>
          ) : (
            threads.map((thread) => {
              const isActive = thread.id === activeThreadId;
              return (
                <div
                  key={thread.id}
                  className={[
                    'group flex items-center gap-2 px-2 py-2 mx-1 rounded-md cursor-pointer transition-colors',
                    isActive
                      ? 'bg-gray-800 text-gray-200'
                      : 'text-gray-500 hover:bg-gray-800/50 hover:text-gray-300',
                  ].join(' ')}
                  onClick={() => onSwitchThread(thread.id)}
                >
                  <MessageSquare size={13} className="shrink-0 text-gray-600" />
                  <span className="flex-1 truncate text-[12px] leading-relaxed">
                    {thread.title || 'Untitled'}
                  </span>
                  {onDeleteThread && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteThread(thread.id);
                      }}
                      className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all"
                      title="Delete thread"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  },
);

ThreadSidebar.displayName = 'ThreadSidebar';
