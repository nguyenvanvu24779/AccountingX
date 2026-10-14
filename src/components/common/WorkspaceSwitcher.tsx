import { Building2, Check, ChevronDown, FolderPlus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ThreadCwdMode, useConfigStore } from '@/components/codex/stores';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AddCompanyForm } from '@/features/CompanySelector';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { AgentWorkspaceSelect } from './AgentWorkspaceSelect';

export function WorkspaceSwitcher() {
  const { t } = useTranslation('company');
  const [projectOpen, setProjectOpen] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const { cwd, companies, setCwd } = useWorkspaceStore();
  const { threadCwdMode, setThreadCwdMode } = useConfigStore();

  const handleSelectCompany = useCallback(
    (path: string) => {
      setCwd(path);
      setProjectOpen(false);
    },
    [setCwd]
  );

  const handleCreated = useCallback(() => {
    setAddMode(false);
    setProjectOpen(false);
  }, []);

  const activeCompany = companies.find((c) => c.path === cwd);
  const repoLabel = activeCompany
    ? activeCompany.name
    : cwd
      ? (cwd.split('/').filter(Boolean).pop() ?? cwd)
      : t('noCompanyFallback');

  return (
    <div className="flex items-center gap-1 font-mono py-2">
      {/* Left: Project selector */}
      <DropdownMenu
        open={projectOpen}
        onOpenChange={(o) => {
          setProjectOpen(o);
          if (!o) setAddMode(false);
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto gap-1 px-1.5 py-0.5 text-xs text-muted-foreground"
          >
            <Building2 className="h-3 w-3 shrink-0" />
            <span>{repoLabel}</span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-fix">
          {addMode ? (
            <div className="p-2">
              <AddCompanyForm onCreated={handleCreated} />
            </div>
          ) : (
            <>
              <div className="max-h-60 overflow-y-auto p-1">
                {companies.map((company) => {
                  const isCurrent = company.path === cwd;
                  return (
                    <DropdownMenuItem
                      key={company.path}
                      asChild
                      onSelect={(e) => {
                        e.preventDefault();
                        handleSelectCompany(company.path);
                      }}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto w-full justify-start gap-2 px-2 py-1.5 text-xs focus-visible:ring-0"
                      >
                        <div className="flex w-full justify-between items-center">
                          <span className="font-medium">{company.name}</span>
                          {isCurrent ? (
                            <Check className="h-3 w-3 shrink-0 text-primary" />
                          ) : (
                            <span className="h-3 w-3 shrink-0" />
                          )}
                        </div>
                      </Button>
                    </DropdownMenuItem>
                  );
                })}
              </div>
              <div className="border-t p-1">
                <DropdownMenuItem
                  asChild
                  onSelect={(e) => {
                    e.preventDefault();
                    setAddMode(true);
                  }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto w-full justify-start gap-2 text-xs text-muted-foreground focus-visible:ring-0"
                  >
                    <FolderPlus className="h-3 w-3 shrink-0" />
                    <span>{t('addCompany')}</span>
                  </Button>
                </DropdownMenuItem>
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AgentWorkspaceSelect
        value={threadCwdMode}
        onValueChange={(v: ThreadCwdMode) => setThreadCwdMode(v)}
      />
    </div>
  );
}
