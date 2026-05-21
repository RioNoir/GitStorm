import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { GitService } from './GitService';
import { getVscodeGitApi } from './VscodeGitApi';
import type { BranchInfo, CommitNode, RepoMeta, WorkspaceStatus } from '../types/git';
import { PROJECT_COLORS } from '../types/workspace';

type StatusListener = (status: WorkspaceStatus) => void;
type BranchListener = () => void;

export class WorkspaceGitManager implements vscode.Disposable {
  private repos = new Map<string, GitService>();
  private repoMetas = new Map<string, RepoMeta>();
  /** Per-repo watchers — recreated on reinitialize(). */
  private watchers: vscode.Disposable[] = [];
  /** Global workspace listeners — created once in constructor, disposed in dispose(). */
  private globalListeners: vscode.Disposable[] = [];
  private statusListeners: StatusListener[] = [];
  private branchListeners: BranchListener[] = [];
  private refreshDebounce: NodeJS.Timeout | null = null;
  private branchDebounce: NodeJS.Timeout | null = null;
  private prevHeads = new Map<string, string>(); // repoId → branch name

  constructor(private readonly context: vscode.ExtensionContext) {
    this.globalListeners.push(
      // Workspace folder changes → rebuild everything
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.reinitialize()),

      // File saved inside a repo → refresh status
      vscode.workspace.onDidSaveTextDocument((doc) => {
        const filePath = doc.uri.fsPath;
        const inRepo = Array.from(this.repoMetas.values()).some(m => filePath.startsWith(m.rootPath));
        if (inRepo) this.scheduleRefresh();
      }),

      // File-explorer operations (create/delete/rename via VSCode UI or extensions)
      vscode.workspace.onDidCreateFiles(() => this.scheduleRefresh()),
      vscode.workspace.onDidDeleteFiles(() => this.scheduleRefresh()),
      vscode.workspace.onDidRenameFiles(() => this.scheduleRefresh()),
    );

    this.reinitialize();
  }

  private reinitialize(): void {
    this.disposeWatchers();
    this.repos.clear();
    this.repoMetas.clear();
    this.prevHeads.clear();

    const folders = vscode.workspace.workspaceFolders ?? [];
    const customColors = vscode.workspace.getConfiguration('gitstorm').get<Record<string, string>>('projectColors', {});

    folders.forEach((folder, index) => {
      const gitDir = path.join(folder.uri.fsPath, '.git');
      if (fs.existsSync(gitDir)) {
        const repoId = folder.uri.fsPath;
        const color = customColors[folder.name] ?? PROJECT_COLORS[index % PROJECT_COLORS.length];
        const meta: RepoMeta = { id: repoId, name: folder.name, rootPath: folder.uri.fsPath, color };
        this.repoMetas.set(repoId, meta);
        this.repos.set(repoId, new GitService(repoId, folder.uri.fsPath));
        this.setupWatcher(folder.uri.fsPath, repoId);
      }
    });

    const fetchOnStartup = vscode.workspace.getConfiguration('gitstorm').get<boolean>('fetchOnStartup', false);
    if (fetchOnStartup) {
      this.fetchAll().catch(console.error);
    }
  }

  private setupWatcher(repoPath: string, repoId: string): void {
    // Primary: VS Code Git API state changes — fired for all git operations
    // (built-in git, GitStorm, terminal, other extensions).
    const vsRepo = getVscodeGitApi()?.getRepository(vscode.Uri.file(repoPath));
    if (vsRepo) {
      this.prevHeads.set(repoId, vsRepo.state.HEAD?.name ?? '');
      const d = vsRepo.state.onDidChange(() => {
        const currentHead = vsRepo.state.HEAD?.name ?? '';
        const prevHead = this.prevHeads.get(repoId) ?? '';
        if (currentHead !== prevHead) {
          this.prevHeads.set(repoId, currentHead);
          this.scheduleRefresh();
          this.scheduleBranchRefresh();
        } else {
          this.scheduleRefresh();
        }
      });
      this.watchers.push(d);
      // vsRepo.state.onDidChange covers git index changes but may miss rapid
      // working-tree edits that haven't been staged. Also watch saved documents
      // inside this repo — onDidSaveTextDocument is already set up in constructor.
      return;
    }

    // Fallback: FileSystemWatcher when vscode.git is unavailable.
    // Watch .git/index (stage changes), .git/HEAD + refs (branch changes),
    // and all working-tree file creates/changes/deletes.
    const onChanged = () => this.scheduleRefresh();
    const onBranchChanged = () => { this.scheduleRefresh(); this.scheduleBranchRefresh(); };

    // .git internals
    const w1 = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(repoPath, '.git/index'));
    const w2 = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(repoPath, '.git/HEAD'));
    const w3 = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(repoPath, '.git/refs/**'));
    // Working-tree: all three events (create, change, delete) — excludes .git itself
    const w4 = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(repoPath, '**/*'));

    w1.onDidChange(onChanged); w1.onDidCreate(onChanged); w1.onDidDelete(onChanged);
    w2.onDidChange(onBranchChanged); w2.onDidCreate(onBranchChanged);
    w3.onDidChange(onBranchChanged); w3.onDidCreate(onBranchChanged); w3.onDidDelete(onBranchChanged);
    w4.onDidCreate(onChanged); w4.onDidChange(onChanged); w4.onDidDelete(onChanged);

    this.watchers.push(w1, w2, w3, w4);
  }

  private scheduleRefresh(): void {
    if (this.refreshDebounce) clearTimeout(this.refreshDebounce);
    this.refreshDebounce = setTimeout(async () => {
      const status = await this.getAllStatusesFresh();
      this.statusListeners.forEach(l => l(status));
    }, 300);
  }

  private scheduleBranchRefresh(): void {
    if (this.branchDebounce) clearTimeout(this.branchDebounce);
    this.branchDebounce = setTimeout(() => {
      this.branchListeners.forEach(l => l());
    }, 400);
  }

  onBranchChange(listener: BranchListener): vscode.Disposable {
    this.branchListeners.push(listener);
    return new vscode.Disposable(() => {
      this.branchListeners = this.branchListeners.filter(l => l !== listener);
    });
  }

  private disposeWatchers(): void {
    this.watchers.forEach(d => d.dispose());
    this.watchers = [];
    if (this.refreshDebounce) { clearTimeout(this.refreshDebounce); this.refreshDebounce = null; }
    if (this.branchDebounce) { clearTimeout(this.branchDebounce); this.branchDebounce = null; }
  }

  onStatusChange(listener: StatusListener): vscode.Disposable {
    this.statusListeners.push(listener);
    return new vscode.Disposable(() => {
      this.statusListeners = this.statusListeners.filter(l => l !== listener);
    });
  }

  getRepoMetas(): RepoMeta[] {
    return Array.from(this.repoMetas.values());
  }

  getRepo(repoId: string): GitService | undefined {
    return this.repos.get(repoId);
  }

  async getAllStatuses(): Promise<WorkspaceStatus> {
    const results = await Promise.allSettled(
      Array.from(this.repos.values()).map(r => r.getStatus())
    );
    return {
      repos: results
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<GitService['getStatus']>>> => r.status === 'fulfilled')
        .map(r => r.value),
    };
  }

  /** Like getAllStatuses but forces VSCode's git extension to re-read from disk first. */
  async getAllStatusesFresh(): Promise<WorkspaceStatus> {
    const results = await Promise.allSettled(
      Array.from(this.repos.values()).map(r => r.getStatusFresh())
    );
    return {
      repos: results
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<GitService['getStatus']>>> => r.status === 'fulfilled')
        .map(r => r.value),
    };
  }

  async getAllBranches(): Promise<BranchInfo[]> {
    const results = await Promise.allSettled(
      Array.from(this.repos.values()).map(r => r.getBranches())
    );
    return results
      .filter((r): r is PromiseFulfilledResult<BranchInfo[]> => r.status === 'fulfilled')
      .flatMap(r => r.value);
  }

  async getInterleavedLog(repoIds: string[], limit: number, skip: number, opts?: { filterText?: string; filterAuthor?: string; filterBranch?: string; filterDateFrom?: string; filterDateTo?: string }): Promise<CommitNode[]> {
    const targets = repoIds.length > 0
      ? repoIds.map(id => this.repos.get(id)).filter(Boolean) as GitService[]
      : Array.from(this.repos.values());

    const results = await Promise.allSettled(targets.map(r => r.getLog(limit, skip, opts)));
    const allCommits = results
      .filter((r): r is PromiseFulfilledResult<CommitNode[]> => r.status === 'fulfilled')
      .flatMap(r => r.value);

    allCommits.sort((a, b) => new Date(b.committerDate).getTime() - new Date(a.committerDate).getTime());
    return allCommits.slice(0, limit);
  }

  async fetchAll(): Promise<void> {
    await Promise.allSettled(Array.from(this.repos.values()).map(r => r.fetchAll()));
  }

  async pullAll(rebase = false): Promise<Array<{ repoId: string; ok: boolean; message: string }>> {
    const repos = Array.from(this.repos.values());
    const results = await Promise.allSettled(
      repos.map(async (r) => ({
        repoId: r.repoId,
        ok: true,
        message: rebase ? await r.pullRebase() : await r.pull(),
      }))
    );
    return results.map((r, i) =>
      r.status === 'fulfilled' ? r.value : {
        repoId: repos[i].repoId,
        ok: false,
        message: r.reason?.message ?? 'Unknown error',
      }
    );
  }

  dispose(): void {
    this.disposeWatchers();
    this.globalListeners.forEach(d => d.dispose());
    this.globalListeners = [];
  }
}
