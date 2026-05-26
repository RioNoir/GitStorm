import React, { useState } from 'react';
import type { UnpushedCommit } from '../../shared/msgTypes';
import type { RepoStatus, RepoMeta } from '../../shared/types';
import { Codicon } from '../../shared/Codicon';

interface Props {
  repos: RepoStatus[];
  repoMetas: RepoMeta[];
  unpushedMap: Record<string, { loading: boolean; commits: UnpushedCommit[]; error?: string }>;
  onPush: (repoId: string) => void;
  onPushAll: () => void;
  onOpenInLog: (hash: string, repoId: string) => void;
  onUndoCommit: (repoId: string) => void;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: diffD > 365 ? 'numeric' : undefined });
  } catch { return iso; }
}

// ── Single commit row ─────────────────────────────────────────────────────────

function CommitRow({ commit, repoId, isHead, onOpenInLog, onUndoCommit }: {
  commit: UnpushedCommit;
  repoId: string;
  isHead: boolean;
  onOpenInLog: (hash: string, repoId: string) => void;
  onUndoCommit: (repoId: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ ...styles.commitRow, background: hovered ? 'var(--vscode-list-hoverBackground)' : 'transparent' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={styles.commitHash}>{commit.shortHash}</span>
      <span style={styles.commitMessage}>{commit.message}</span>
      <span style={styles.commitMeta}>{commit.author} · {formatDate(commit.date)}</span>
      <div style={styles.commitActions(hovered)}>
        {isHead && (
          <button
            style={styles.actionBtn}
            title="Undo this commit (keeps changes as unstaged)"
            onClick={e => { e.stopPropagation(); onUndoCommit(repoId); }}
          >
            <Codicon name="discard" style={{ fontSize: '16px' }} />
          </button>
        )}
        <button
          style={styles.actionBtn}
          title="Open in Log"
          onClick={e => { e.stopPropagation(); onOpenInLog(commit.hash, repoId); }}
        >
          <Codicon name="go-to-file" style={{ fontSize: '16px' }} />
        </button>
      </div>
    </div>
  );
}

// ── Per-repo section ──────────────────────────────────────────────────────────

function RepoSection({ repoStatus, repoMeta, unpushed, onPush, onOpenInLog, onUndoCommit }: {
  repoStatus: RepoStatus;
  repoMeta: RepoMeta | undefined;
  unpushed: Props['unpushedMap'][string] | undefined;
  onPush: (repoId: string) => void;
  onOpenInLog: (hash: string, repoId: string) => void;
  onUndoCommit: (repoId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const repoName = repoMeta?.name ?? repoStatus.repoId.split('/').pop() ?? repoStatus.repoId;
  const repoColor = repoMeta?.color ?? '#4ec9b0';
  const ahead = repoStatus.branch.aheadBehind?.ahead ?? 0;
  const hasUpstream = !!repoStatus.branch.upstream;
  const canPush = (hasUpstream && ahead > 0) || !hasUpstream;
  const commitCount = hasUpstream ? ahead : (unpushed?.commits?.length ?? 0);

  return (
    <div style={styles.repoRoot}>
      {/* Repo header */}
      <div
        style={styles.repoHeader(repoColor)}
        onClick={() => setExpanded(e => !e)}
      >
        <Codicon name={expanded ? 'chevron-down' : 'chevron-right'} style={{ fontSize: '11px', opacity: 0.65, flexShrink: 0 }} />
        <span style={styles.dot(repoColor)} />
        <span style={styles.repoName}>{repoName}</span>
        {commitCount > 0 && (
          <span style={styles.aheadBadge}>
            <Codicon name="arrow-up" style={{ fontSize: '10px', marginRight: '2px' }} />
            {commitCount}
          </span>
        )}
        <button
          style={styles.pushBtn(canPush)}
          disabled={!canPush}
          title={canPush ? (hasUpstream ? `Push ${ahead} commit${ahead === 1 ? '' : 's'}` : `Publish branch "${repoStatus.branch.name}" to remote`) : 'Nothing to push'}
          onClick={e => { e.stopPropagation(); if (canPush) onPush(repoStatus.repoId); }}
        >
          <Codicon name="cloud-upload" style={{ marginRight: '4px' }} />
          {!hasUpstream && commitCount === 0 ? 'Publish' : 'Push'}
        </button>
      </div>

      {/* Content */}
      {expanded && (
        <div style={styles.repoBody}>
          {hasUpstream && ahead === 0 ? (
            <div style={styles.upToDate}>
              <Codicon name="check" style={{ marginRight: '6px', opacity: 0.6 }} />
              Up to date
            </div>
          ) : unpushed?.loading ? (
            <div style={styles.loadingRow}>Loading commits…</div>
          ) : unpushed?.error ? (
            <div style={styles.errorRow}>
              <Codicon name="warning" style={{ marginRight: '4px', flexShrink: 0 }} />
              {unpushed.error}
            </div>
          ) : unpushed?.commits && unpushed.commits.length > 0 ? (
            <div style={styles.commitList}>
              {unpushed.commits.map((c, i) => (
                <CommitRow key={c.hash} commit={c} repoId={repoStatus.repoId} isHead={i === 0} onOpenInLog={onOpenInLog} onUndoCommit={onUndoCommit} />
              ))}
            </div>
          ) : (
            <div style={styles.loadingRow}>No commits found</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export function PushTab({ repos, repoMetas, unpushedMap, onPush, onPushAll, onOpenInLog, onUndoCommit }: Props) {
  const metaMap = new Map(repoMetas.map(m => [m.id, m]));

  const reposWithAhead = repos.filter(r => (r.branch.aheadBehind?.ahead ?? 0) > 0);
  const totalAhead = reposWithAhead.reduce((sum, r) => sum + (r.branch.aheadBehind?.ahead ?? 0), 0);
  const multiRepo = repos.length > 1;

  return (
    <div style={css.root}>
      {/* Push All button if multiple repos have unpushed commits */}
      {multiRepo && reposWithAhead.length > 1 && (
        <div style={css.pushAllBar}>
          <span style={css.pushAllLabel}>
            {reposWithAhead.length} repos · {totalAhead} commit{totalAhead === 1 ? '' : 's'} to push
          </span>
          <button style={css.pushAllBtn} onClick={onPushAll}>
            <Codicon name="cloud-upload" style={{ marginRight: '5px' }} />
            Push All
          </button>
        </div>
      )}

      {repos.map(repoStatus => (
        <RepoSection
          key={repoStatus.repoId}
          repoStatus={repoStatus}
          repoMeta={metaMap.get(repoStatus.repoId)}
          unpushed={unpushedMap[repoStatus.repoId]}
          onPush={onPush}
          onOpenInLog={onOpenInLog}
          onUndoCommit={onUndoCommit}
        />
      ))}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const css = {
  root: { display: 'flex', flexDirection: 'column' as const, flex: 1 },
  pushAllBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '6px 10px', borderBottom: '1px solid var(--vscode-panel-border)',
    background: 'var(--vscode-editor-background)', flexShrink: 0,
  } as React.CSSProperties,
  pushAllLabel: { fontSize: '11px', opacity: 0.65 },
  pushAllBtn: {
    display: 'flex', alignItems: 'center',
    background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)',
    border: 'none', borderRadius: '3px', padding: '4px 10px',
    cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--vscode-font-family)',
  } as React.CSSProperties,
};

const styles = {
  repoRoot: { borderBottom: '1px solid var(--vscode-panel-border)' } as React.CSSProperties,
  repoHeader: (color: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '5px 8px', cursor: 'pointer',
    background: color + '14', borderBottom: '1px solid var(--vscode-panel-border)',
    minHeight: '30px',
  }),
  dot: (color: string): React.CSSProperties => ({
    width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0,
  }),
  repoName: {
    fontSize: '11px', fontWeight: 'bold' as const, opacity: 0.9,
    textTransform: 'uppercase' as const, letterSpacing: '0.04em', flex: 1, minWidth: 0,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
  },
  aheadBadge: {
    display: 'inline-flex', alignItems: 'center',
    background: 'var(--vscode-badge-background)', color: 'var(--vscode-badge-foreground)',
    borderRadius: '8px', padding: '1px 6px', fontSize: '10px', fontWeight: 'bold' as const, flexShrink: 0,
  } as React.CSSProperties,
  pushBtn: (enabled: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center',
    background: enabled ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground, rgba(100,100,100,0.2))',
    color: enabled ? 'var(--vscode-button-foreground)' : 'var(--vscode-button-secondaryForeground, var(--vscode-foreground))',
    border: 'none', borderRadius: '3px', padding: '2px 8px',
    cursor: enabled ? 'pointer' : 'default',
    fontSize: '11px', fontFamily: 'var(--vscode-font-family)', flexShrink: 0,
    opacity: enabled ? 1 : 0.4,
  }),
  repoBody: {
    background: 'var(--vscode-sideBar-background)',
  } as React.CSSProperties,
  upToDate: {
    display: 'flex', alignItems: 'center', padding: '8px 12px', fontSize: '12px', opacity: 0.5,
  } as React.CSSProperties,
  loadingRow: { padding: '8px 12px', fontSize: '12px', opacity: 0.45, fontStyle: 'italic' as const } as React.CSSProperties,
  errorRow: {
    display: 'flex', alignItems: 'flex-start', padding: '6px 10px', fontSize: '11px',
    color: 'var(--vscode-errorForeground)',
  } as React.CSSProperties,
  commitList: {
    display: 'flex', flexDirection: 'column' as const,
  } as React.CSSProperties,
  commitRow: {
    display: 'grid',
    gridTemplateColumns: '48px 1fr auto',
    gridTemplateRows: 'auto auto',
    gap: '0 8px',
    padding: '7px 12px',
    alignItems: 'center',
  } as React.CSSProperties,
  commitHash: {
    fontFamily: 'var(--vscode-editor-font-family, monospace)', fontSize: '10px',
    opacity: 0.55, gridRow: '1', gridColumn: '1',
    display: 'flex', alignItems: 'center',
  } as React.CSSProperties,
  commitMessage: {
    fontSize: '12px', fontWeight: 500, gridRow: '1', gridColumn: '2',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  commitMeta: {
    fontSize: '10px', opacity: 0.45, gridRow: '2', gridColumn: '2',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  commitActions: (visible: boolean): React.CSSProperties => ({
    gridRow: '1 / 3', gridColumn: '3',
    display: 'flex', alignItems: 'center', gap: '4px',
    alignSelf: 'center',
    opacity: visible ? 1 : 0,
    transition: 'opacity 0.1s',
  }),
  actionBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', border: 'none',
    color: 'var(--vscode-foreground)',
    cursor: 'pointer', padding: '2px', borderRadius: '3px',
    opacity: 0.65,
  } as React.CSSProperties,
};
