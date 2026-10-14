import { lazy, Suspense } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLayoutStore } from '@/stores';
import { RightPanelHeader } from './RightPanelHeader';

const TodoView = lazy(() => import('@/features/todos/TodoView'));
const FilesPanel = lazy(() => import('@/features/files/FilesPanel'));
const TasksPanel = lazy(() => import('@/components/agent/TasksPanel'));

export function RightPanel() {
  const { activeRightPanelTab, openRightPanelTabs } = useLayoutStore();
  const isMobile = useIsMobile();

  return (
    <div
      className={`h-full w-full min-h-0 border-l border-white/10 flex flex-col overflow-hidden ${isMobile ? 'bg-sidebar' : 'bg-sidebar/30'}`}
    >
      <RightPanelHeader />
      {openRightPanelTabs.length > 0 && (
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
            {activeRightPanelTab === 'tasks' && (
              <div className="h-full min-h-0 overflow-hidden">
                <Suspense fallback={null}>
                  <TasksPanel />
                </Suspense>
              </div>
            )}

            {activeRightPanelTab === 'todo' && (
              <div className="h-full min-h-0 overflow-hidden">
                <Suspense fallback={null}>
                  <TodoView />
                </Suspense>
              </div>
            )}

            {activeRightPanelTab === 'files' && (
              <Suspense fallback={null}>
                <FilesPanel />
              </Suspense>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
