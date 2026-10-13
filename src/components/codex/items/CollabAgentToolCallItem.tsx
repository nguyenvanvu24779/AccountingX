import { Bot, Clock, GitBranch, Play, Send, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type {
  CollabAgentState,
  CollabAgentStatus,
  CollabAgentTool,
  CollabAgentToolCallStatus,
} from '@/bindings/v2';
import { Badge } from '@/components/ui/badge';

const toolLabelKey = (tool: CollabAgentTool, done: boolean): string => {
  switch (tool) {
    case 'spawnAgent':
      return done ? 'collab.spawned' : 'collab.spawning';
    case 'sendInput':
      return done ? 'collab.sentInput' : 'collab.sendingInput';
    case 'resumeAgent':
      return done ? 'collab.resumed' : 'collab.resuming';
    case 'wait':
      return done ? 'collab.waited' : 'collab.waiting';
    case 'closeAgent':
      return done ? 'collab.closed' : 'collab.closing';
    default:
      return 'collab.operation';
  }
};

// Shape of the collabAgentToolCall item from item/completed.
export interface CollabAgentToolCallItemData {
  type: 'collabAgentToolCall';
  id: string;
  tool: CollabAgentTool;
  status: CollabAgentToolCallStatus;
  senderThreadId: string;
  receiverThreadIds: string[];
  prompt: string | null;
  model: string | null;
  reasoningEffort: string | null;
  agentsStates: Record<string, CollabAgentState>;
}

function toolIcon(tool: CollabAgentTool) {
  switch (tool) {
    case 'spawnAgent':
      return <GitBranch className="h-3.5 w-3.5" />;
    case 'sendInput':
      return <Send className="h-3.5 w-3.5" />;
    case 'resumeAgent':
      return <Play className="h-3.5 w-3.5" />;
    case 'wait':
      return <Clock className="h-3.5 w-3.5" />;
    case 'closeAgent':
      return <Square className="h-3.5 w-3.5" />;
    default:
      return <Bot className="h-3.5 w-3.5" />;
  }
}

// Map agent-level status to a badge variant + translation key.
function agentStatusDisplay(status: CollabAgentStatus): {
  labelKey: string;
  className: string;
} {
  switch (status) {
    case 'running':
      return {
        labelKey: 'collab.agentStatus.running',
        className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
      };
    case 'completed':
      return {
        labelKey: 'collab.agentStatus.done',
        className: 'bg-green-500/15 text-green-700 dark:text-green-400',
      };
    case 'errored':
      return {
        labelKey: 'collab.agentStatus.errored',
        className: 'bg-red-500/15 text-red-700 dark:text-red-400',
      };
    case 'interrupted':
      return {
        labelKey: 'collab.agentStatus.stopped',
        className: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
      };
    case 'shutdown':
      return {
        labelKey: 'collab.agentStatus.shutdown',
        className: 'bg-muted text-muted-foreground',
      };
    case 'pendingInit':
      return {
        labelKey: 'collab.agentStatus.starting',
        className: 'bg-muted text-muted-foreground',
      };
    case 'notFound':
      return {
        labelKey: 'collab.agentStatus.notFound',
        className: 'bg-red-500/15 text-red-700 dark:text-red-400',
      };
    default:
      return { labelKey: '', className: 'bg-muted text-muted-foreground' };
  }
}

// Shorten a full thread UUID to the last 8 chars for display.
function shortId(threadId: string): string {
  return threadId.length > 8 ? `…${threadId.slice(-8)}` : threadId;
}

interface CollabAgentToolCallItemProps {
  item: CollabAgentToolCallItemData;
}

export function CollabAgentToolCallItem({ item }: CollabAgentToolCallItemProps) {
  const { t } = useTranslation('thread');
  const { tool, status, receiverThreadIds, prompt, agentsStates } = item;

  const callStatusClass =
    status === 'completed'
      ? 'border-green-500/30 bg-green-500/5'
      : status === 'failed'
        ? 'border-red-500/30 bg-red-500/5'
        : 'border-blue-500/30 bg-blue-500/5';

  const agentEntries = Object.entries(agentsStates ?? {});

  return (
    <div className={`rounded-md border px-3 py-2.5 text-xs space-y-2 ${callStatusClass}`}>
      {/* Header row */}
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 text-muted-foreground">
          {toolIcon(tool)}
          <span className="font-medium text-foreground">
            {t(toolLabelKey(tool, status === 'completed'))}
          </span>
        </span>

        {/* Receiver thread IDs */}
        {receiverThreadIds.length > 0 && (
          <span className="text-muted-foreground">
            {receiverThreadIds.map((id) => (
              <code key={id} className="font-mono text-[10px] bg-muted rounded px-1 py-0.5 mr-1">
                {shortId(id)}
              </code>
            ))}
          </span>
        )}

        {/* Overall call status badge */}
        <Badge
          variant="outline"
          className={`ml-auto text-[10px] px-1.5 py-0 ${
            status === 'completed'
              ? 'border-green-500/40 text-green-700 dark:text-green-400'
              : status === 'failed'
                ? 'border-red-500/40 text-red-700 dark:text-red-400'
                : 'border-blue-500/40 text-blue-700 dark:text-blue-400'
          }`}
        >
          {t(`commandStatus.${status}`)}
        </Badge>
      </div>

      {/* Prompt snippet — first 120 chars */}
      {prompt && (
        <p className="text-muted-foreground italic line-clamp-2 leading-relaxed">
          {prompt.length > 120 ? `${prompt.slice(0, 120)}…` : prompt}
        </p>
      )}

      {/* Per-agent state rows */}
      {agentEntries.length > 0 && (
        <div className="space-y-1 pt-0.5">
          {agentEntries.map(([threadId, agentState]) => {
            const { labelKey, className } = agentStatusDisplay(agentState.status);
            return (
              <div key={threadId} className="flex items-center gap-2">
                <Bot className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <code className="font-mono text-[10px] text-muted-foreground">
                  {shortId(threadId)}
                </code>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${className}`}>
                  {labelKey ? t(labelKey) : agentState.status}
                </span>
                {agentState.message && (
                  <span className="text-muted-foreground truncate">{agentState.message}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
