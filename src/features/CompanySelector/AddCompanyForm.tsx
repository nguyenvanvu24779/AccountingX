import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Company } from '@/stores/useWorkspaceStore';
import { createCompany } from './createCompany';

export function AddCompanyForm({ onCreated }: { onCreated: (company: Company) => void }) {
  const { t } = useTranslation('company');
  const [name, setName] = useState('');
  const [mst, setMst] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim() || !mst.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const company = await createCompany({ name, mst });
      setName('');
      setMst('');
      onCreated(company);
    } catch (err) {
      setError(String(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="space-y-1.5">
        <Label htmlFor="company-name">{t('nameLabel')}</Label>
        <Input
          id="company-name"
          value={name}
          placeholder={t('namePlaceholder')}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="company-mst">{t('mstLabel')}</Label>
        <Input
          id="company-mst"
          value={mst}
          placeholder={t('mstPlaceholder')}
          onChange={(e) => setMst(e.target.value)}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button
        className="w-full"
        disabled={!name.trim() || !mst.trim() || creating}
        onClick={() => void handleCreate()}
      >
        {creating ? t('creating') : t('createButton')}
      </Button>
    </div>
  );
}
