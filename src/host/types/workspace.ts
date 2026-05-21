import type { RepoMeta } from './git';

export interface WorkspaceRepo {
  meta: RepoMeta;
  rootPath: string;
}

export const PROJECT_COLORS = [
  '#4ec9b0',
  '#569cd6',
  '#dcdcaa',
  '#c586c0',
  '#f44747',
  '#4fc1ff',
  '#ce9178',
  '#b5cea8',
];
