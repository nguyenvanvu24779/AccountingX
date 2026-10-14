import type { ReactNode } from 'react';
import { useState } from 'react';
import { ModelReasonSelector } from '@/components/codex/composer/ModelReasonSelector';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type AgentModelPanelProps = { trigger: ReactNode };

/** Popover with the model and reasoning-effort choices for the AI engine. */
export function AgentModelPanel({ trigger }: AgentModelPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-auto min-w-80 max-w-[calc(100vw-2rem)] p-2">
        <div className="max-h-[min(70vh,640px)] min-h-0 overflow-y-auto">
          <ModelReasonSelector mode="panel" />
        </div>
      </PopoverContent>
    </Popover>
  );
}
