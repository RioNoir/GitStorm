import * as vscode from 'vscode';
import { CommitPanelProvider } from '../panels/CommitPanelProvider';
import { GitLogPanelProvider } from '../panels/GitLogPanelProvider';
import { MergeEditorProvider } from '../panels/MergeEditorProvider';
import { BranchStatusBar } from '../ui/BranchStatusBar';

export function registerCommands(
  context: vscode.ExtensionContext,
  commitPanel: CommitPanelProvider,
  logPanel: GitLogPanelProvider,
  mergeEditor: MergeEditorProvider,
  branchStatusBar: BranchStatusBar
): void {
  context.subscriptions.push(
    // Focus the Git Log panel in the bottom bar
    vscode.commands.registerCommand('gitstorm.openLog', () => {
      logPanel.focus();
    }),

    vscode.commands.registerCommand('gitstorm.refreshCommitPanel', () => {
      commitPanel.refresh();
    }),

    vscode.commands.registerCommand('gitstorm.openMergeEditor', () => {
      mergeEditor.openCurrentEditorFile();
    }),

    vscode.commands.registerCommand('gitstorm.fetchAll', async () => {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'GitStorm: Fetching all remotes', cancellable: false },
        async () => { /* delegated to panel message handler */ }
      );
    }),

    vscode.commands.registerCommand('gitstorm.showBranchMenu', (repoId?: string) => {
      branchStatusBar.showMenu(repoId);
    }),

    vscode.commands.registerCommand('gitstorm.updateProject', () => {
      branchStatusBar.updateProject();
    }),

    vscode.commands.registerCommand('gitstorm.openSettings', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', '@ext:rionoir.gitstorm');
    })
  );

  // Track files with conflict markers so we know when they've been resolved
  const conflictedFiles = new Set<string>();

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(doc => {
      if (doc.uri.scheme !== 'file') return;
      if (doc.getText().includes('<<<<<<<')) {
        conflictedFiles.add(doc.uri.fsPath);
      }
    }),

    vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.scheme !== 'file') return;
      if (e.document.getText().includes('<<<<<<<')) {
        conflictedFiles.add(e.document.uri.fsPath);
      }
    }),

    vscode.workspace.onDidSaveTextDocument(doc => {
      if (doc.uri.scheme !== 'file') return;
      if (!conflictedFiles.has(doc.uri.fsPath)) return;
      if (!doc.getText().includes('<<<<<<<')) {
        conflictedFiles.delete(doc.uri.fsPath);
        // Delay to run after VS Code's built-in SCM view focus
        setTimeout(() => {
          vscode.commands.executeCommand('gitstorm.commitPanel.focus');
        }, 300);
      }
    }),
  );
}
