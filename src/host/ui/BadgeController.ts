import * as vscode from 'vscode';
import type { WorkspaceStatus } from '../types/git';

/**
 * Controls the numeric badge on the GitStorm activity-bar icon.
 *
 * VSCode propagates TreeView.badge to the activity-bar container icon reliably,
 * whereas WebviewView.badge has timing issues. We register a hidden TreeView
 * (when: "false") in the same container and set its badge instead.
 */
export class BadgeController implements vscode.Disposable {
  private readonly treeView: vscode.TreeView<never>;

  constructor() {
    const emptyProvider: vscode.TreeDataProvider<never> = {
      getTreeItem: () => { throw new Error('unreachable'); },
      getChildren: () => [],
    };
    this.treeView = vscode.window.createTreeView('gitstorm.commitBadge', {
      treeDataProvider: emptyProvider,
    });
  }

  update(status: WorkspaceStatus): void {
    const total = status.repos.reduce(
      (sum, r) => sum + r.stagedFiles.length + r.unstagedFiles.length, 0
    );
    this.treeView.badge = total > 0
      ? { value: total, tooltip: `${total} changed file${total === 1 ? '' : 's'}` }
      : undefined;
  }

  dispose(): void {
    this.treeView.dispose();
  }
}
