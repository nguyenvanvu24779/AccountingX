import { Bug, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { useTrafficLightConfig } from '@/hooks';
import { EDITION } from '@/lib/edition';
import { UpdateIndicator } from '../../features/UpdateIndicator';
import { SideBarAgentHeader, SideBarAgentList, SideBarProjectActions } from './SideBarAgentPane';
import { SideBarPinnedList } from './SideBarPinnedList';
import { UserInfo } from './UserInfo';

export function AppSideBar() {
  const { t } = useTranslation('sidebar');
  const { open: isSidebarOpen } = useSidebar();
  const { isMacos } = useTrafficLightConfig(isSidebarOpen);
  const [projectsOpen, setProjectsOpen] = useState(true);

  return (
    <Sidebar className="border-r border-sidebar-border bg-zinc-100/95 dark:bg-zinc-900/95">
      <SidebarHeader className="gap-1 p-1">
        {/* Header row: toggle */}
        <div
          className={`flex items-center gap-2 ${isMacos ? 'pl-20' : 'pl-2'}`}
          data-tauri-drag-region
        >
          <SidebarTrigger className="h-7 w-7" />
        </div>
      </SidebarHeader>

      <SidebarContent className="min-w-0 max-w-full overflow-x-hidden gap-0 px-0">
        <SideBarAgentHeader />

        <SideBarPinnedList />

        <Collapsible open={projectsOpen} onOpenChange={setProjectsOpen}>
          <div className="flex items-center px-1">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="flex-1 justify-start gap-2">
                <span>{t('projects')}</span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground/60 transition-transform ${projectsOpen ? '' : '-rotate-90'}`}
                />
              </Button>
            </CollapsibleTrigger>
            <SideBarProjectActions />
          </div>
          <CollapsibleContent>
            <SideBarAgentList />
          </CollapsibleContent>
        </Collapsible>
      </SidebarContent>

      <SidebarFooter className="flex-row items-center p-0 min-w-0 max-w-full overflow-x-hidden">
        <div className="flex-1 min-w-0 overflow-hidden">
          <UserInfo />
        </div>
        <div className="flex-shrink-0 pr-2 flex items-center gap-2">
          <UpdateIndicator
            fallback={
              EDITION.upstreamLinks ? (
                <a
                  href="https://github.com/milisp/codexia/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Bug className="h-4 w-4" />
                </a>
              ) : null
            }
          />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
