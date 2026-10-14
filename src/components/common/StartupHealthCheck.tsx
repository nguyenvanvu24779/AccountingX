import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/components/ui/use-toast';
import { systemCheck } from '@/services';

// Let the AI engine and Zalo finish starting before judging them.
const START_DELAY_MS = 12000;

/**
 * Looks the installation over once after launch and, only when something stops
 * the product from working, says where to look. Warnings are left to the
 * System check screen so people are not nagged.
 */
export function StartupHealthCheck() {
  const { t } = useTranslation('systemCheck');

  useEffect(() => {
    const timer = setTimeout(() => {
      systemCheck()
        .then((result) => {
          if (result.overall !== 'fail') return;
          const failing = result.checks.filter((c) => c.status === 'fail').length;
          toast({
            title: t('startup.title'),
            description: t('startup.description', { count: failing }),
            variant: 'destructive',
          });
        })
        .catch(() => undefined);
    }, START_DELAY_MS);
    return () => clearTimeout(timer);
  }, [t]);

  return null;
}
