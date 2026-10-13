import { Building2, Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { AddCompanyForm } from './AddCompanyForm';

/**
 * Forced onboarding when no company is open yet — the AccountingX
 * replacement for the generic "pick any folder" dialog. Every session
 * belongs to exactly one company's workspace, so unlike the generic dialog
 * it has no "skip" and no close button while the list is empty.
 */
export function CompanyOnboardingDialog() {
  const { t } = useTranslation('company');
  const { projects, companies, cwd, setCwd } = useWorkspaceStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(projects.length === 0);
  }, [projects.length]);

  const selectCompany = (path: string) => {
    setCwd(path);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => projects.length > 0 && setOpen(next)}>
      <DialogContent showCloseButton={projects.length > 0}>
        <DialogHeader>
          <DialogTitle>{t('onboardingTitle')}</DialogTitle>
          <DialogDescription>{t('onboardingDescription')}</DialogDescription>
        </DialogHeader>

        {companies.length > 0 && (
          <ScrollArea className="max-h-48 rounded-md border">
            <div className="flex flex-col gap-1 p-2">
              {companies.map((company) => (
                <Button
                  key={company.path}
                  variant="ghost"
                  className="h-auto w-full justify-start gap-2 px-2 py-2"
                  onClick={() => selectCompany(company.path)}
                >
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex min-w-0 flex-1 flex-col items-start">
                    <span className="truncate text-sm font-medium">{company.name}</span>
                    {company.mst && (
                      <span className="truncate text-xs text-muted-foreground">{company.mst}</span>
                    )}
                  </span>
                  {company.path === cwd && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </Button>
              ))}
            </div>
          </ScrollArea>
        )}

        <AddCompanyForm onCreated={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
