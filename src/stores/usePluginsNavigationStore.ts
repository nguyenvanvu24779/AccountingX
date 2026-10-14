import { create } from 'zustand';

export type PluginsTab = 'Plugins' | 'Tools' | 'Skills' | 'Connectors';

/** Navigation only; connector definitions remain owned by their runtime. */
export const usePluginsNavigationStore = create<{
  mainTab: PluginsTab;
  setMainTab: (tab: PluginsTab) => void;
}>((set) => ({
  mainTab: 'Plugins',
  setMainTab: (mainTab) => set({ mainTab }),
}));
