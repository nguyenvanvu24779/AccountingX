// Pinned threads/sessions across all projects, shown as a collapsible sidebar section.
import { ChevronDown, ChevronRight, Pin, PinOff } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { codexService } from '@/services/codexService';
import { useAgentCenterStore, useLayoutStore } from '@/stores';
import { type PinnedItem, usePinStore } from '@/stores/usePinStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { getFilename } from '@/utils/getFilename';

export function SideBarPinnedList() {
  const { t } = useTranslation('sidebar');
  const pinned = usePinStore((s) => s.pinned);
  const unpin = usePinStore((s) => s.unpin);
  const { setCwd } = useWorkspaceStore();
  const { setView } = useLayoutStore();
  const open = useLayoutStore((s) => s.isPinnedListOpen);
  const setOpen = useLayoutStore((s) => s.setPinnedListOpen);
  const { addAgentCard, setCurrentAgentCardId } = useAgentCenterStore();

  const handleOpen = useCallback(
    async (item: PinnedItem) => {
      setCwd(item.cwd);
      addAgentCard({ kind: 'codex', id: item.id, preview: item.title, cwd: item.cwd });
      setCurrentAgentCardId(item.id);
      setView('agent');
      await codexService.setCurrentThread(item.id);
    },
    [addAgentCard, setCurrentAgentCardId, setCwd, setView]
  );

  if (pinned.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-accent/50">
        <Pin className="h-4 w-4" />
        <span className="flex-1 text-left">{t('pinned')}</span>
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </CollapsibleTrigger>
      <CollapsibleContent>
        {pinned.map((item) => (
          <div
            key={item.id}
            role="button"
            tabIndex={0}
            onClick={() => void handleOpen(item)}
            title={`${item.title}\n${item.cwd}`}
            className="group flex w-full items-center gap-2 rounded-md px-2.5 py-1 text-left hover:bg-accent/50"
          >
            <span className="min-w-0 flex-1 truncate text-xs">{item.title || t('untitled')}</span>
            <span className="shrink-0 text-[10px] text-muted-foreground group-hover:hidden">
              {getFilename(item.cwd)}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              title={t('unpin')}
              className="hidden shrink-0 group-hover:inline-flex"
              onClick={(e) => {
                e.stopPropagation();
                unpin(item.id);
              }}
            >
              <PinOff />
            </Button>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
