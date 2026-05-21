import { create } from 'zustand';
import type { FileDiff, FileStatus, RepoMeta, RepoStatus, WorkspaceStatus } from '../../shared/types';
import type { IconThemeData } from '../../../host/types/messages';

export type ViewMode = 'flat' | 'tree';

// fileSelections[repoId] = Set of file paths the user has checked
export type FileSelections = Record<string, Set<string>>;

export interface CommitState {
  status: WorkspaceStatus | null;
  repoMetas: RepoMeta[];
  iconTheme: IconThemeData | null;
  repoSelections: Record<string, boolean>;
  fileSelections: FileSelections;
  // collapsed state for repo headers and tree dirs (key = repoId or dirPath)
  collapsedKeys: Set<string>;
  selectedFile: { repoId: string; path: string } | null;
  currentDiff: FileDiff | null;
  loadingDiff: boolean;
  commitMessage: string;
  amendFlags: Record<string, boolean>;
  viewMode: ViewMode;
  shelveViewMode: ViewMode;
  shelveCollapsedKeys: Set<string>;
  loading: boolean;
  error: string | null;

  setStatus: (repos: RepoMeta[], status: WorkspaceStatus, iconTheme?: IconThemeData | null) => void;
  setRepoSelection: (repoId: string, selected: boolean) => void;
  toggleFileSelection: (repoId: string, path: string) => void;
  setFileSelections: (repoId: string, paths: string[], selected: boolean) => void;
  isFileSelected: (repoId: string, path: string) => boolean;
  getSelectedFilesForRepo: (repoId: string) => string[];
  selectFile: (repoId: string, path: string) => void;
  setDiff: (diff: FileDiff | null) => void;
  setLoadingDiff: (v: boolean) => void;
  setCommitMessage: (msg: string) => void;
  setAmend: (repoId: string, v: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
  setShelveViewMode: (mode: ViewMode) => void;
  isShelveCollapsed: (key: string) => boolean;
  toggleShelveCollapsed: (key: string) => void;
  shelveExpandAll: (shelveIds: string[], allDirPaths: string[]) => void;
  shelveCollapseAll: (shelveIds: string[], allDirPaths: string[]) => void;
  setLoading: (v: boolean) => void;
  setError: (err: string | null) => void;
  getRepoStatus: (repoId: string) => RepoStatus | undefined;
  getSelectedRepos: () => string[];
  isCollapsed: (key: string) => boolean;
  toggleCollapsed: (key: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
}

function allFilePaths(repoStatus: RepoStatus): string[] {
  const paths = new Set<string>();
  for (const f of repoStatus.stagedFiles) paths.add(f.path);
  for (const f of repoStatus.unstagedFiles) paths.add(f.path);
  return Array.from(paths);
}

export const useCommitStore = create<CommitState>((set, get) => ({
  status: null,
  repoMetas: [],
  iconTheme: null,
  repoSelections: {},
  fileSelections: {},
  collapsedKeys: new Set(),
  selectedFile: null,
  currentDiff: null,
  loadingDiff: false,
  commitMessage: '',
  amendFlags: {},
  viewMode: 'tree',
  shelveViewMode: 'tree',
  shelveCollapsedKeys: new Set(),
  loading: false,
  error: null,

  setStatus: (repoMetas, status, iconTheme) => {
    const prev = get().repoSelections;
    const prevFiles = get().fileSelections;
    const prevCollapsed = get().collapsedKeys;
    const repoSelections: Record<string, boolean> = {};
    const fileSelections: FileSelections = {};
    const collapsedKeys = new Set(prevCollapsed);

    for (const r of status.repos) {
      repoSelections[r.repoId] = prev[r.repoId] ?? true;
      const currentPaths = allFilePaths(r);
      const prevSet = prevFiles[r.repoId];
      const next = new Set<string>();
      for (const p of currentPaths) {
        // New file (not seen before) → auto-select; existing → preserve previous state
        if (!prevSet || prevSet.has(p)) next.add(p);
      }
      fileSelections[r.repoId] = next;

      // Auto-collapse repos with no changes; auto-expand when changes appear
      if (!(r.repoId in prev)) {
        if (currentPaths.length === 0) collapsedKeys.add(r.repoId);
      } else {
        const hadFiles = (prevFiles[r.repoId]?.size ?? 0) > 0 || prevCollapsed.has(r.repoId) === false;
        const wasCollapsed = prevCollapsed.has(r.repoId);
        if (wasCollapsed && currentPaths.length > 0 && (prevFiles[r.repoId]?.size ?? 0) === 0) {
          collapsedKeys.delete(r.repoId);
        }
      }
    }
    set({ repoMetas, status, repoSelections, fileSelections, collapsedKeys, ...(iconTheme !== undefined ? { iconTheme } : {}) });
  },

  setRepoSelection: (repoId, selected) =>
    set(s => ({ repoSelections: { ...s.repoSelections, [repoId]: selected } })),

  toggleFileSelection: (repoId, path) =>
    set(s => {
      const prev = new Set(s.fileSelections[repoId] ?? []);
      if (prev.has(path)) prev.delete(path);
      else prev.add(path);
      return { fileSelections: { ...s.fileSelections, [repoId]: prev } };
    }),

  setFileSelections: (repoId, paths, selected) =>
    set(s => {
      const next = new Set(s.fileSelections[repoId] ?? []);
      for (const p of paths) {
        if (selected) next.add(p);
        else next.delete(p);
      }
      return { fileSelections: { ...s.fileSelections, [repoId]: next } };
    }),

  isFileSelected: (repoId, path) =>
    get().fileSelections[repoId]?.has(path) ?? false,

  getSelectedFilesForRepo: (repoId) =>
    Array.from(get().fileSelections[repoId] ?? []),

  selectFile: (repoId, path) =>
    set({ selectedFile: { repoId, path }, currentDiff: null }),

  setDiff: (diff) => set({ currentDiff: diff, loadingDiff: false }),
  setLoadingDiff: (v) => set({ loadingDiff: v }),
  setCommitMessage: (msg) => set({ commitMessage: msg }),
  setAmend: (repoId, v) => set(s => ({ amendFlags: { ...s.amendFlags, [repoId]: v } })),
  setViewMode: (mode) => set({ viewMode: mode }),
  setShelveViewMode: (mode) => set({ shelveViewMode: mode }),
  // shelveCollapsedKeys tracks *expanded* items — absence means collapsed (default)
  isShelveCollapsed: (key) => !get().shelveCollapsedKeys.has(key),
  toggleShelveCollapsed: (key) => set(s => {
    const next = new Set(s.shelveCollapsedKeys);
    if (next.has(key)) next.delete(key); else next.add(key);
    return { shelveCollapsedKeys: next };
  }),
  shelveExpandAll: (shelveIds: string[], allDirPaths: string[]) => {
    const keys = new Set<string>();
    for (const id of shelveIds) {
      keys.add(id);
      for (const p of allDirPaths) keys.add(`${id}:${p}`);
    }
    set({ shelveCollapsedKeys: keys });
  },
  shelveCollapseAll: (_shelveIds: string[], _allDirPaths: string[]) => {
    // Collapsing = removing from the expanded set = empty set
    set({ shelveCollapsedKeys: new Set() });
  },
  setLoading: (v) => set({ loading: v }),
  setError: (err) => set({ error: err }),

  getRepoStatus: (repoId) => get().status?.repos.find(r => r.repoId === repoId),

  getSelectedRepos: () => {
    const { repoSelections, status } = get();
    return (status?.repos ?? [])
      .filter(r => repoSelections[r.repoId] !== false)
      .map(r => r.repoId);
  },

  isCollapsed: (key) => get().collapsedKeys.has(key),
  toggleCollapsed: (key) => set(s => {
    const next = new Set(s.collapsedKeys);
    if (next.has(key)) next.delete(key); else next.add(key);
    return { collapsedKeys: next };
  }),
  expandAll: () => set({ collapsedKeys: new Set() }),
  collapseAll: () => {
    const { status } = get();
    const keys = new Set<string>();
    for (const r of status?.repos ?? []) {
      keys.add(r.repoId);
      // Add all dir paths from staged + unstaged files
      const allPaths = [...r.stagedFiles, ...r.unstagedFiles].map(f => f.path);
      for (const p of allPaths) {
        const parts = p.split('/');
        for (let i = 1; i < parts.length; i++) {
          keys.add(`${r.repoId}:${parts.slice(0, i).join('/')}`);
        }
      }
    }
    set({ collapsedKeys: keys });
  },
}));
