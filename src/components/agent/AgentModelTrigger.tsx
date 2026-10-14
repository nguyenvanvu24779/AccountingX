import { ChevronDown } from 'lucide-react';
import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '@/components/codex/stores';
import { AgentIcon } from '@/components/common/AgentIcon';
import { Button } from '@/components/ui/button';

/**
 * Plain button trigger for `AgentModelPanel`. Deliberately has no popover of
 * its own — the panel owns the popover, so a selector like `ModelReasonSelector`
 * can't be used directly as `trigger` (it renders its own nested `Popover`,
 * which swallows the click before the panel's `PopoverTrigger asChild` sees it).
 *
 * Shows the current model and effort.
 */
export const AgentModelTrigger = forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(
  function AgentModelTrigger(props, ref) {
    const { t } = useTranslation('agent');
    const model = useConfigStore((s) => s.model);
    const reasoningEffort = useConfigStore((s) => s.reasoningEffort);

    const label = model || t('selectModelFallback');
    const effort = reasoningEffort !== 'none' ? reasoningEffort : undefined;

    return (
      <Button
        ref={ref}
        variant="ghost"
        size="sm"
        className="h-8 gap-2 px-2 border border-transparent transition-all hover:border-input hover:bg-accent/50"
        {...props}
      >
        <AgentIcon agent="codex" />
        <div className="flex items-center gap-1.5 text-xs text-foreground">
          <span className="font-medium max-w-[120px] truncate">{label}</span>
          {effort && (
            <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono capitalize text-muted-foreground border">
              {effort}
            </span>
          )}
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </Button>
    );
  }
);
