import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getPermissionMode, type PermissionMode, setPermissionMode } from '@/services';

export function PermissionsSettings() {
  const { t } = useTranslation('permissions');
  const [mode, setMode] = useState<PermissionMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setMode((await getPermissionMode()).mode);
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const choose = async (auto: boolean) => {
    const previous = mode;
    const next: PermissionMode = auto ? 'auto' : 'ask';
    setMode(next);
    try {
      await setPermissionMode(next);
      setError(null);
    } catch (err) {
      setMode(previous);
      setError(String(err));
    }
  };

  return (
    <section className="space-y-3">
      <div className="px-1">
        <h3 className="text-sm font-medium">{t('title')}</h3>
        <p className="text-xs text-muted-foreground">{t('description')}</p>
      </div>

      <Card>
        <CardContent className="space-y-4 px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <Label htmlFor="permission-auto" className="flex-col items-start gap-0.5">
              <span className="text-sm font-medium">{t('auto.title')}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {t('auto.description')}
              </span>
            </Label>
            <Switch
              id="permission-auto"
              checked={mode === 'auto'}
              disabled={mode === null}
              onCheckedChange={(on) => void choose(on)}
            />
          </div>
          <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {t('note')}
          </p>
        </CardContent>
      </Card>

      {error && <p className="px-1 text-xs text-destructive">{t('failed', { error })}</p>}
    </section>
  );
}
