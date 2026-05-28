import * as vscode from 'vscode';
import simpleGit from 'simple-git';

export interface GitProfile {
  id: string;
  name: string;       // display name for the profile (e.g. "Work", "Personal")
  gitName: string;    // git user.name
  gitEmail: string;   // git user.email
  isDefault?: boolean;
}

const CONFIG_KEY = 'gitstorm.gitProfiles';
const ACTIVE_KEY = 'gitstorm.activeGitProfileId';

export class GitProfileService implements vscode.Disposable {
  private _onProfileChange = new vscode.EventEmitter<void>();
  readonly onProfileChange = this._onProfileChange.event;

  private configWatcher?: vscode.Disposable;

  constructor() {
    this.configWatcher = vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration(CONFIG_KEY) || e.affectsConfiguration(ACTIVE_KEY)) {
        this._onProfileChange.fire();
      }
    });
  }

  getProfiles(): GitProfile[] {
    const cfg = vscode.workspace.getConfiguration();
    return cfg.get<GitProfile[]>(CONFIG_KEY, []);
  }

  getActiveProfileId(): string | undefined {
    const cfg = vscode.workspace.getConfiguration();
    return cfg.get<string>(ACTIVE_KEY, '');
  }

  getActiveProfile(): GitProfile | undefined {
    const id = this.getActiveProfileId();
    if (!id) return this.getDefaultProfile();
    const profiles = this.getProfiles();
    return profiles.find(p => p.id === id) ?? this.getDefaultProfile();
  }

  private getDefaultProfile(): GitProfile | undefined {
    const profiles = this.getProfiles();
    return profiles.find(p => p.isDefault) ?? profiles[0];
  }

  async setActiveProfile(id: string): Promise<void> {
    const cfg = vscode.workspace.getConfiguration();
    await cfg.update(ACTIVE_KEY, id, vscode.ConfigurationTarget.Workspace);
  }

  async saveProfile(profile: GitProfile): Promise<void> {
    const profiles = this.getProfiles();
    const idx = profiles.findIndex(p => p.id === profile.id);
    if (idx >= 0) {
      profiles[idx] = profile;
    } else {
      profiles.push(profile);
    }
    await vscode.workspace.getConfiguration().update(CONFIG_KEY, profiles, vscode.ConfigurationTarget.Global);
  }

  async deleteProfile(id: string): Promise<void> {
    const profiles = this.getProfiles().filter(p => p.id !== id);
    await vscode.workspace.getConfiguration().update(CONFIG_KEY, profiles, vscode.ConfigurationTarget.Global);
    // If the deleted profile was active, clear active
    if (this.getActiveProfileId() === id) {
      await vscode.workspace.getConfiguration().update(ACTIVE_KEY, '', vscode.ConfigurationTarget.Workspace);
    }
  }

  async setDefaultProfile(id: string): Promise<void> {
    const profiles = this.getProfiles().map(p => ({ ...p, isDefault: p.id === id }));
    await vscode.workspace.getConfiguration().update(CONFIG_KEY, profiles, vscode.ConfigurationTarget.Global);
  }

  /**
   * Tries to read user.name/user.email from a repo's local git config or from global git config.
   * Returns a profile if something is configured, undefined otherwise.
   */
  async detectFromRepo(repoPath: string): Promise<{ gitName: string; gitEmail: string } | undefined> {
    try {
      const git = simpleGit(repoPath);
      const [name, email] = await Promise.all([
        git.raw(['config', '--local', 'user.name']).catch(() => ''),
        git.raw(['config', '--local', 'user.email']).catch(() => ''),
      ]);
      if (name.trim() || email.trim()) {
        return { gitName: name.trim(), gitEmail: email.trim() };
      }
    } catch { /* ignore */ }
    return undefined;
  }

  async detectGlobal(): Promise<{ gitName: string; gitEmail: string } | undefined> {
    try {
      const git = simpleGit();
      const [name, email] = await Promise.all([
        git.raw(['config', '--global', 'user.name']).catch(() => ''),
        git.raw(['config', '--global', 'user.email']).catch(() => ''),
      ]);
      if (name.trim() || email.trim()) {
        return { gitName: name.trim(), gitEmail: email.trim() };
      }
    } catch { /* ignore */ }
    return undefined;
  }

  /**
   * On first activation: if no profiles exist, auto-create from global git config.
   */
  async autoInitIfEmpty(): Promise<void> {
    if (this.getProfiles().length > 0) return;
    const global = await this.detectGlobal();
    if (!global || (!global.gitName && !global.gitEmail)) return;
    const profile: GitProfile = {
      id: generateId(),
      name: 'Default',
      gitName: global.gitName,
      gitEmail: global.gitEmail,
      isDefault: true,
    };
    await this.saveProfile(profile);
  }

  /**
   * Applies the active profile to a repo by writing git config user.name/email locally.
   * Does nothing if no profile is active.
   */
  async applyToRepo(repoPath: string): Promise<void> {
    const profile = this.getActiveProfile();
    if (!profile) return;
    const git = simpleGit(repoPath);
    const ops: Promise<unknown>[] = [];
    if (profile.gitName) ops.push(git.raw(['config', 'user.name', profile.gitName]));
    if (profile.gitEmail) ops.push(git.raw(['config', 'user.email', profile.gitEmail]));
    if (ops.length) await Promise.all(ops);
  }

  dispose(): void {
    this.configWatcher?.dispose();
    this._onProfileChange.dispose();
  }
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
