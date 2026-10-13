import { create } from 'zustand';
import { useEditorStore } from './useEditorStore';

export type ProjectSortKey = 'added_desc' | 'added_asc' | 'name_asc' | 'name_desc';
const MAX_HISTORY_PROJECTS = 30;

/** A company workspace: its own folder under `~/.accountingx/companies/`. */
export interface Company {
  /** The folder path — matches an entry in `projects`/`cwd`, the join key to the rest of the app. */
  path: string;
  name: string;
  /** Tax code (mã số thuế) — required, since it's the one id that tells two companies apart. */
  mst: string;
}

function normalizeProjectPath(project: string): string {
  return project.trim();
}

function dedupeProjects(projects: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const project of projects) {
    const normalized = normalizeProjectPath(project);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    next.push(normalized);
  }
  return next;
}

function pushRecentProject(history: string[], project: string | null): string[] {
  if (!project) {
    return history;
  }
  const normalized = normalizeProjectPath(project);
  if (!normalized) {
    return history;
  }
  const withoutCurrent = history.filter((item) => item !== normalized);
  return [normalized, ...withoutCurrent].slice(0, MAX_HISTORY_PROJECTS);
}

export function sortProjects(projects: string[], sortKey: ProjectSortKey): string[] {
  const next = [...projects];
  if (sortKey === 'added_desc') {
    return next.reverse();
  }
  if (sortKey === 'added_asc') {
    return next;
  }
  return next.sort((a, b) =>
    sortKey === 'name_asc'
      ? a.localeCompare(b, undefined, { sensitivity: 'base' })
      : b.localeCompare(a, undefined, { sensitivity: 'base' })
  );
}

interface WorkspaceStore {
  projects: string[];
  setProjects: (projects: string[]) => void;
  addProject: (project: string) => void;
  removeProject: (project: string) => void;
  addProjectAndSelect: (project: string) => void;
  historyProjects: string[];
  setHistoryProjects: (projects: string[]) => void;
  addHistoryProject: (project: string) => void;
  clearHistoryProjects: () => void;
  projectSort: ProjectSortKey;
  setProjectSort: (sortKey: ProjectSortKey) => void;
  cwd: string | null;
  setCwd: (path: string | null) => void;
  companies: Company[];
  setCompanies: (companies: Company[]) => void;
  addCompany: (company: Company) => void;
  removeCompany: (path: string) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  projects: [],
  setProjects: (projects) => set({ projects: dedupeProjects(projects) }),
  addProject: (project) =>
    set((state) => {
      const normalized = normalizeProjectPath(project);
      if (!normalized) {
        return state;
      }
      return {
        projects: state.projects.includes(normalized)
          ? state.projects
          : [...state.projects, normalized],
        historyProjects: pushRecentProject(state.historyProjects, normalized),
      };
    }),
  removeProject: (project) =>
    set((state) => {
      const normalized = normalizeProjectPath(project);
      const projects = state.projects.filter((p) => p !== normalized);
      const shouldClearCwd = state.cwd === normalized;
      const nextCwd = shouldClearCwd ? (projects[0] ?? null) : state.cwd;

      if (shouldClearCwd) {
        useEditorStore.getState().resetFiles();
      }

      return {
        projects,
        cwd: nextCwd,
      };
    }),
  addProjectAndSelect: (project) => {
    const trimmed = normalizeProjectPath(project);
    const state = get();
    if (trimmed && !state.projects.includes(trimmed)) {
      set({
        projects: [...state.projects, trimmed],
        cwd: trimmed,
        historyProjects: pushRecentProject(state.historyProjects, trimmed),
      });
    }
  },
  historyProjects: [],
  setHistoryProjects: (projects) => set({ historyProjects: dedupeProjects(projects) }),
  addHistoryProject: (project) =>
    set((state) => ({
      historyProjects: pushRecentProject(state.historyProjects, project),
    })),
  clearHistoryProjects: () => set({ historyProjects: [] }),
  projectSort: 'added_desc',
  setProjectSort: (sortKey) => set({ projectSort: sortKey }),
  cwd: null,
  setCwd: (path) => {
    const normalized = path ? normalizeProjectPath(path) : null;
    useEditorStore.getState().resetFiles();
    set((state) => ({
      cwd: normalized,
      historyProjects: normalized
        ? pushRecentProject(state.historyProjects, normalized)
        : state.historyProjects,
    }));
  },
  companies: [],
  setCompanies: (companies) => set({ companies }),
  addCompany: (company) =>
    set((state) => ({
      companies: [...state.companies.filter((c) => c.path !== company.path), company],
    })),
  removeCompany: (path) =>
    set((state) => ({
      companies: state.companies.filter((c) => c.path !== path),
    })),
}));
