import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProjectCommands, RunKind } from './detectProjectCommands';
import { useProjectRunStore } from './useProjectRunStore';

const RUN_KINDS: { kind: RunKind; labelKey: string }[] = [
  { kind: 'dev', labelKey: 'dev' },
  { kind: 'test', labelKey: 'test' },
  { kind: 'build', labelKey: 'build' },
  { kind: 'preview', labelKey: 'preview' },
];

interface EditRunCommandsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cwd: string;
  defaults: ProjectCommands;
  overrides: ProjectCommands;
}

type EditRunCommandsFormProps = Omit<EditRunCommandsDialogProps, 'open'>;

// Mounted fresh on every open (Radix unmounts closed content), so the draft
// always starts from the current overrides.
function EditRunCommandsForm({ onOpenChange, cwd, defaults, overrides }: EditRunCommandsFormProps) {
  const { t } = useTranslation('projectRun');
  const setOverride = useProjectRunStore((state) => state.setOverride);
  const [values, setValues] = useState<Record<RunKind, string>>(() => ({
    dev: overrides.dev ?? '',
    test: overrides.test ?? '',
    build: overrides.build ?? '',
    preview: overrides.preview ?? '',
  }));

  const handleSave = () => {
    for (const { kind } of RUN_KINDS) {
      setOverride(cwd, kind, values[kind]);
    }
    onOpenChange(false);
  };

  const handleReset = () => {
    setValues({ dev: '', test: '', build: '', preview: '' });
  };

  return (
    <>
      <div className="flex flex-col gap-3">
        {RUN_KINDS.map(({ kind, labelKey }) => (
          <div key={kind} className="flex flex-col gap-1.5">
            <Label htmlFor={`run-command-${kind}`}>{t(labelKey)}</Label>
            <Input
              id={`run-command-${kind}`}
              value={values[kind]}
              placeholder={defaults[kind] ?? t('notSet')}
              className="font-mono text-sm"
              onChange={(e) => setValues((prev) => ({ ...prev, [kind]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={handleReset}>
          {t('reset')}
        </Button>
        <Button onClick={handleSave}>{t('save')}</Button>
      </DialogFooter>
    </>
  );
}

export function EditRunCommandsDialog({ open, ...formProps }: EditRunCommandsDialogProps) {
  const { t } = useTranslation('projectRun');
  return (
    <Dialog open={open} onOpenChange={formProps.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('editTitle')}</DialogTitle>
          <DialogDescription>{t('editDescription')}</DialogDescription>
        </DialogHeader>
        <EditRunCommandsForm {...formProps} />
      </DialogContent>
    </Dialog>
  );
}
