import * as vscode from 'vscode';
import type { API, GitExtension, Repository } from './git.d';

let _api: API | undefined;

function getApi(): API | undefined {
  if (_api) return _api;
  const ext = vscode.extensions.getExtension<GitExtension>('vscode.git');
  if (!ext) return undefined;
  const gitExt = ext.isActive ? ext.exports : undefined;
  if (!gitExt) return undefined;
  _api = gitExt.getAPI(1);
  return _api;
}

export function getVscodeGitApi(): API | undefined {
  return getApi();
}

export function getVscodeRepository(rootPath: string): Repository | undefined {
  const api = getApi();
  if (!api) return undefined;
  return api.getRepository(vscode.Uri.file(rootPath)) ?? undefined;
}
