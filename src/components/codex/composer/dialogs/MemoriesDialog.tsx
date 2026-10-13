import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useCodexStore } from '@/components/codex/stores/useCodexStore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { memoryReset, threadMemoryModeSet } from '@/services';

type MemoriesDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function MemoriesDialog({ open, onClose }: MemoriesDialogProps) {
  const { t } = useTranslation('composer');
  const currentThreadId = useCodexStore((state) => state.currentThreadId);
  // There is no read API for the current memory mode, so this switch only
  // reflects changes made from this dialog during the session.
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleToggle = async (next: boolean) => {
    if (!currentThreadId) return;
    const previous = enabled;
    setEnabled(next);
    setSaving(true);
    try {
      await threadMemoryModeSet({
        threadId: currentThreadId,
        mode: next ? 'enabled' : 'disabled',
      });
      toast.success(next ? t('memoriesDialog.enabledToast') : t('memoriesDialog.disabledToast'));
    } catch (error) {
      setEnabled(previous);
      toast.error(t('memoriesDialog.updateFailed', { error: String(error) }));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await memoryReset();
      toast.success(t('memoriesDialog.resetSuccess'));
    } catch (error) {
      toast.error(t('memoriesDialog.resetFailed', { error: String(error) }));
    } finally {
      setResetting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('memoriesDialog.title')}</DialogTitle>
          <DialogDescription>{t('memoriesDialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-4 rounded-md border p-3">
          <div className="space-y-1">
            <Label htmlFor="memory-mode">{t('memoriesDialog.memoryForThread')}</Label>
            <p className="text-muted-foreground text-xs">
              {currentThreadId
                ? t('memoriesDialog.appliesGoingForward')
                : t('memoriesDialog.startOrOpenThread')}
            </p>
          </div>
          <Switch
            id="memory-mode"
            checked={enabled}
            disabled={!currentThreadId || saving}
            onCheckedChange={handleToggle}
          />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-md border p-3">
          <div className="space-y-1">
            <Label>{t('memoriesDialog.resetAll')}</Label>
            <p className="text-muted-foreground text-xs">{t('memoriesDialog.resetDescription')}</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={resetting}>
                <Trash2 className="size-4" />
                {t('memoriesDialog.reset')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('memoriesDialog.resetConfirmTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('memoriesDialog.resetConfirmDescription')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>
                  {t('memoriesDialog.reset')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </DialogContent>
    </Dialog>
  );
}
