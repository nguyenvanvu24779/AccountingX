import { Button } from '@/components/ui/button';
import { ProjectSelector } from '@/features/ProjectSelector';
import { cn } from '@/lib/utils';
import { usePluginsViewContext } from '../hooks';

/** Bottom bar: skill scope switcher or MCP config scope selector, depending on tab. */
export function PluginsViewBottomBar() {
  const { mainTab, overlay, manageTab, scope, setScope } = usePluginsViewContext();

  return (
    <>
      {((!overlay && mainTab === 'Skills') || (overlay === 'manage' && manageTab === 'Skills')) && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-t">
          Scope:
          <div className="flex items-center gap-0.5 rounded-lg bg-muted/50 p-0.5">
            {(['user', 'project'] as const).map((s) => (
              <Button
                key={s}
                variant="ghost"
                size="sm"
                onClick={() => setScope(s)}
                className={cn(
                  'h-6 px-2.5 text-[10px] uppercase tracking-wider',
                  scope === s ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                )}
              >
                {s}
              </Button>
            ))}
          </div>
          {scope === 'project' && <ProjectSelector />}
        </div>
      )}
    </>
  );
}
