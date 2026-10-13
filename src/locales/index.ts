import { en } from './en';
import { fr } from './fr';
import { ja } from './ja';
import { vi } from './vi';
import { zh } from './zh';

export const localeResources = {
  vi: { ...vi },
  en: { ...en },
  zh: { ...zh },
  ja: { ...ja },
  fr: { ...fr },
} as const;

export type AppLocale = keyof typeof localeResources;

export const localeLabels: Record<AppLocale, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
  zh: '中文',
  ja: '日本語',
  fr: 'Français',
};
