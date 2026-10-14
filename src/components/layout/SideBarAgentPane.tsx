import { ListFilter, Package2, Timer } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNewThread, useThreadList } from '@/components/codex/hooks';
import { NewAgentButton } from '@/components/common/NewAgentButton';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSidebar } from '@/components/ui/sidebar';
import { useLayoutStore } from '@/stores';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { SideBarAddProjectButton } from './SideBarAddProjectButton';
import { SideBarCodexTab } from './SideBarTab';

// Shared class for nav buttons (Automations / Marketplace)
const navBtnBase = 'justify-start gap-2 rounded-md border px-2.5';
const navBtnActive = 'border-border bg-accent/70 text-accent-foreground';
const navBtnInactive = 'border-transparent hover:border-border/60';
const navBtnCls = (active: boolean) => `${navBtnBase} ${active ? navBtnActive : navBtnInactive}`;

/** Always-visible navigation actions. */
export function SideBarAgentHeader() {
  const { t } = useTranslation('sidebar');
  const { setView, view } = useLayoutStore();

  return (
    <div className="flex flex-col">
      <NewAgentButton showLabel />
      <Button
        variant="ghost"
        size="sm"
        className={navBtnCls(view === 'plugins')}
        onClick={() => setView('plugins')}
      >
        <Package2 className="h-4 w-4" />
        {t('plugins')}
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className={navBtnCls(view === 'automations')}
        onClick={() => setView('automations')}
      >
        <Timer className="h-4 w-4" />
        {t('automations')}
      </Button>
    </div>
  );
}

/** Project-specific sorting and creation actions. */
export function SideBarProjectActions() {
  const { t } = useTranslation('sidebar');
  const { open: isSidebarOpen } = useSidebar();
  const { sortKey, setSortKey } = useThreadList({ enabled: isSidebarOpen });
  const currentThreadSortLabel = sortKey === 'created_at' ? t('sortCreated') : t('sortUpdated');

  return (
    <div className="flex items-center justify-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title={t('filterThreads', { sort: currentThreadSortLabel })}
          >
            <ListFilter className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup
            value={sortKey}
            onValueChange={(v) => setSortKey(v as 'created_at' | 'updated_at')}
          >
            <DropdownMenuRadioItem value="created_at">{t('sortByCreated')}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="updated_at">{t('sortByUpdated')}</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <SideBarAddProjectButton />
    </div>
  );
}

/** The list of conversations for each company folder. */
export function SideBarAgentList() {
  const { cwd, setCwd } = useWorkspaceStore();
  const { handleNewThread } = useNewThread();

  const handleCreateNewThreadForProject = useCallback(
    (project: string) => {
      if (project !== cwd) setCwd(project);
      void handleNewThread();
    },
    [cwd, handleNewThread, setCwd]
  );

  return <SideBarCodexTab onCreateNewThread={handleCreateNewThreadForProject} />;
}
