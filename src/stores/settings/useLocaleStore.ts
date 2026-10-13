import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppLocale } from '@/locales';

interface LocaleState {
  locale: AppLocale | 'auto';
  setLocale: (locale: AppLocale | 'auto') => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: 'vi',
      setLocale: (locale: AppLocale | 'auto') => set({ locale }),
    }),
    {
      name: 'locale-storage',
      version: 1,
      // v1: AccountingX defaults to Vietnamese instead of the inherited English default.
      migrate: (_persisted, version) =>
        version < 1 ? { locale: 'vi' } : (_persisted as LocaleState),
    }
  )
);
