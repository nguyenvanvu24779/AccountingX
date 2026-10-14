import { useTranslation } from 'react-i18next';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { DiffViewer } from '@/features/DiffViewer';
import { useWorkspaceStore } from '@/stores';
import type { AggregatedFileChange } from './fileChangeLogic';
import { getDiffViewerProps } from './fileChangeLogic';
import { toRelativePath } from './fileChangeUtils';

type ThreadFileChangesSummaryProps = {
  changes: AggregatedFileChange[];
};

/** Compact summary of the files a turn changed, with a diff preview on hover. */
export const ThreadFileChangesSummary = ({ changes }: ThreadFileChangesSummaryProps) => {
  const { t } = useTranslation('thread');
  const { cwd } = useWorkspaceStore();

  if (changes.length === 0) return null;

  const totals = changes.reduce(
    (acc, change) => {
      acc.added += change.addedCount;
      acc.removed += change.removedCount;
      return acc;
    },
    { added: 0, removed: 0 }
  );

  return (
    <div className="space-y-1 border rounded-md p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-muted-foreground">
          {t('fileChanges.changed', { count: changes.length })}
        </div>
        <span className="flex items-center gap-1.5 text-xs">
          <span className="text-green-600 dark:text-green-400">+{totals.added}</span>
          <span className="text-red-600 dark:text-red-400">-{totals.removed}</span>
        </span>
      </div>

      <div className="divide-y">
        {changes.map((change) => (
          <div
            key={change.path}
            className="flex w-full items-center justify-between gap-3 py-1.5 text-sm hover:bg-muted/50 rounded-sm px-1 -mx-1"
          >
            <HoverCard openDelay={200}>
              <HoverCardTrigger asChild>
                <button type="button" className="flex-1 min-w-0 cursor-default text-left">
                  <span className="font-mono truncate block">
                    {toRelativePath(change.path, cwd)}
                  </span>
                </button>
              </HoverCardTrigger>
              <HoverCardContent className="w-[36rem] max-w-[80vw] p-0 overflow-hidden">
                <DiffViewer
                  {...getDiffViewerProps(change)}
                  displayPath={toRelativePath(change.path, cwd)}
                  isCollapsed={false}
                  className="max-h-96"
                />
              </HoverCardContent>
            </HoverCard>
            <span className="flex items-center gap-2 text-xs shrink-0">
              <span className="text-green-600 dark:text-green-400">+{change.addedCount}</span>
              <span className="text-red-600 dark:text-red-400">-{change.removedCount}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
