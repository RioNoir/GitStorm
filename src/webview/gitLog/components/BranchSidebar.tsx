import React, { useState, forwardRef } from 'react';
import type { BranchInfo, RepoMeta } from '../../shared/types';
import { isPrimaryBranch } from '../../shared/branchUtils';
import { Codicon } from '../../shared/Codicon';

interface Props {
  repos: RepoMeta[];
  branches: BranchInfo[];
  filter: string;
  selectedBranchFilter: string;
  onFilterChange: (v: string) => void;
  onBranchFilterSelect: (branchName: string) => void;
  onCheckout: (repoId: string, branchName: string) => void;
  onMerge: (repoId: string, from: string) => void;
  onRebase: (repoId: string, onto: string) => void;
  onDelete: (repoId: string, branchName: string, force: boolean) => void;
  onFetchRepo: (repoId: string) => void;
  onPull: (repoId: string) => void;
  onPush: (repoId: string, remote: string) => void;
  onGetRemotes: (repoId: string) => Promise<string[]>;
}

type SectionKey = 'local' | 'remote';

function stripRemotePrefix(name: string): string {
  return name.includes('/') ? name.slice(name.indexOf('/') + 1) : name;
}

interface MergedBranch {
  baseName: string;
  isPrimary: boolean;
  isHead: boolean;
  instances: BranchInfo[];
  repoIds: string[];
}

function buildMergedBranches(branches: BranchInfo[]): MergedBranch[] {
  const map = new Map<string, MergedBranch>();
  for (const b of branches) {
    const baseName = stripRemotePrefix(b.name);
    const existing = map.get(baseName);
    if (existing) {
      existing.instances.push(b);
      if (!existing.repoIds.includes(b.repoId)) existing.repoIds.push(b.repoId);
      if (b.isHead) existing.isHead = true;
    } else {
      map.set(baseName, {
        baseName,
        isPrimary: isPrimaryBranch(baseName),
        isHead: b.isHead,
        instances: [b],
        repoIds: [b.repoId],
      });
    }
  }
  return Array.from(map.values());
}

function sortMerged(list: MergedBranch[]): MergedBranch[] {
  return [...list].sort((a, b) => {
    if (a.isHead !== b.isHead) return a.isHead ? -1 : 1;
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return a.baseName.localeCompare(b.baseName);
  });
}

export const BranchSidebar = forwardRef<HTMLDivElement, Props>(function BranchSidebar({
  repos, branches, filter, selectedBranchFilter, onFilterChange, onBranchFilterSelect,
  onCheckout, onMerge, onRebase, onDelete, onFetchRepo, onPull, onPush, onGetRemotes,
}, ref) {
  const [collapsed, setCollapsed] = useState<Set<SectionKey>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ merged: MergedBranch; x: number; y: number } | null>(null);
  const [pushMenu, setPushMenu] = useState<{ x: number; y: number; repoId: string; remotes: string[] } | null>(null);

  function toggle(key: SectionKey) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const filtered = filter
    ? branches.filter(b => b.name.toLowerCase().includes(filter.toLowerCase()))
    : branches;

  const localMerged = sortMerged(buildMergedBranches(filtered.filter(b => !b.isRemote)));
  const remoteMerged = sortMerged(buildMergedBranches(filtered.filter(b => b.isRemote)));

  function closePushMenu() { setPushMenu(null); }

  const repoColorMap = Object.fromEntries(repos.map(r => [r.id, r.color]));
  const multiRepo = repos.length > 1;

  function primaryInstance(merged: MergedBranch): BranchInfo {
    return merged.instances.find(i => i.isHead) ?? merged.instances[0];
  }

  return (
    <div ref={ref} style={styles.container} onClick={() => { setContextMenu(null); closePushMenu(); }}>
      {/* Sticky header: search + repo list */}
      <div style={styles.stickyHeader}>
        <div style={styles.searchBox}>
          <input
            style={styles.searchInput}
            value={filter}
            onChange={e => onFilterChange(e.target.value)}
            placeholder="Filter branches..."
          />
        </div>

        {repos.length > 0 && (
          <div style={styles.repoList}>
            {repos.map(repo => (
              <div key={repo.id} style={styles.repoRow}>
                <span style={styles.repoDot(repo.color)} />
                <span style={styles.repoName}>{repo.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* LOCAL section */}
      <div style={styles.sectionHeader} onClick={() => toggle('local')}>
        <span style={styles.chevron}>{collapsed.has('local') ? '▶' : '▼'}</span>
        <Codicon name="git-branch" style={styles.sectionIcon} />
        <span style={styles.sectionLabel}>Local</span>
        <span style={styles.count}>{localMerged.length}</span>
      </div>
      {!collapsed.has('local') && localMerged.map(m => (
        <BranchRow
          key={m.baseName}
          merged={m}
          repoColorMap={repoColorMap}
          multiRepo={multiRepo}
          isFilterSelected={selectedBranchFilter === m.baseName}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setContextMenu({ merged: m, x: e.clientX, y: e.clientY });
          }}
          onDoubleClick={() => onBranchFilterSelect(m.baseName)}
        />
      ))}

      {/* ORIGIN / REMOTE section */}
      {remoteMerged.length > 0 && (
        <>
          <div style={styles.sectionHeader} onClick={() => toggle('remote')}>
            <span style={styles.chevron}>{collapsed.has('remote') ? '▶' : '▼'}</span>
            <Codicon name="cloud" style={styles.sectionIcon} />
            <span style={styles.sectionLabel}>Origin</span>
            <span style={styles.count}>{remoteMerged.length}</span>
          </div>
          {!collapsed.has('remote') && remoteMerged.map(m => (
            <BranchRow
              key={m.baseName}
              merged={m}
              repoColorMap={repoColorMap}
              multiRepo={multiRepo}
              isFilterSelected={selectedBranchFilter === m.baseName}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({ merged: m, x: e.clientX, y: e.clientY });
              }}
              onDoubleClick={() => onBranchFilterSelect(m.baseName)}
            />
          ))}
        </>
      )}

      {/* Context menu */}
      {contextMenu && (() => {
        const inst = primaryInstance(contextMenu.merged);
        return (
          <ContextMenu
            merged={contextMenu.merged}
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            onCheckout={() => { onCheckout(inst.repoId, inst.name); setContextMenu(null); }}
            onMerge={() => { onMerge(inst.repoId, inst.name); setContextMenu(null); }}
            onRebase={() => { onRebase(inst.repoId, inst.name); setContextMenu(null); }}
            onDelete={() => { onDelete(inst.repoId, inst.name, false); setContextMenu(null); }}
            onPull={() => { onPull(inst.repoId); setContextMenu(null); }}
            onPushMenu={async (x, y) => {
              setContextMenu(null);
              const remotes = await onGetRemotes(inst.repoId);
              setPushMenu({ x, y, repoId: inst.repoId, remotes });
            }}
          />
        );
      })()}

      {/* Push remote picker */}
      {pushMenu && (
        <PushRemoteMenu
          x={pushMenu.x}
          y={pushMenu.y}
          remotes={pushMenu.remotes}
          onClose={closePushMenu}
          onSelect={(remote) => { onPush(pushMenu.repoId, remote); closePushMenu(); }}
        />
      )}
    </div>
  );
});

function BranchRow({ merged, repoColorMap, multiRepo, isFilterSelected, onContextMenu, onDoubleClick }: {
  merged: MergedBranch;
  repoColorMap: Record<string, string>;
  multiRepo: boolean;
  isFilterSelected: boolean;
  onContextMenu: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
}) {
  const { baseName, isPrimary, isHead, repoIds } = merged;
  const isRemote = merged.instances[0].isRemote;

  return (
    <div
      style={styles.branchRow(isHead, isFilterSelected)}
      onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
      title={`${baseName}\nDouble-click to filter by this branch · Right-click for git actions`}
    >
      <Codicon
        name={isPrimary ? 'git-branch' : isRemote ? 'cloud' : 'git-branch'}
        style={styles.branchIcon(isPrimary, isHead)}
      />

      <span style={styles.branchName(isHead, isPrimary)}>{baseName}</span>

      {multiRepo && (
        <span style={styles.dotGroup}>
          {repoIds.map(id => (
            <span key={id} style={styles.repoDot(repoColorMap[id] ?? '#888')} />
          ))}
        </span>
      )}

      {merged.instances[0].aheadBehind && (
        <span style={styles.aheadBehind}>
          {merged.instances[0].aheadBehind.ahead > 0 && <span>↑{merged.instances[0].aheadBehind.ahead}</span>}
          {merged.instances[0].aheadBehind.behind > 0 && <span>↓{merged.instances[0].aheadBehind.behind}</span>}
        </span>
      )}
    </div>
  );
}

function ContextMenu({ merged, x, y, onClose, onCheckout, onMerge, onRebase, onDelete, onPull, onPushMenu }: {
  merged: MergedBranch;
  x: number; y: number;
  onClose: () => void;
  onCheckout: () => void;
  onMerge: () => void;
  onRebase: () => void;
  onDelete: () => void;
  onPull: () => void;
  onPushMenu: (x: number, y: number) => void;
}) {
  const items: Array<{ label: string; action: (() => void) | null; danger?: boolean }> = [
    { label: `Checkout "${merged.baseName}"`, action: onCheckout },
    { label: '─', action: null },
    { label: 'Merge into current', action: onMerge },
    { label: `Rebase onto "${merged.baseName}"`, action: onRebase },
    { label: '─', action: null },
    { label: 'Pull', action: onPull },
    { label: 'Push...', action: null },
    { label: '─', action: null },
    { label: 'Delete branch', action: onDelete, danger: true },
  ];

  return (
    <>
      <div style={styles.backdrop} onClick={onClose} />
      <div style={styles.contextMenu(x, y)}>
        {items.map((item, i) =>
          item.label === '─' ? (
            <div key={i} style={styles.separator} />
          ) : item.label === 'Push...' ? (
            <div
              key={i}
              style={styles.menuItemWithArrow}
              onClick={(e) => { e.stopPropagation(); onPushMenu(e.clientX, e.clientY); }}
            >
              <span>Push...</span>
              <span style={styles.menuArrow}>▶</span>
            </div>
          ) : (
            <div
              key={i}
              style={styles.menuItem(item.danger)}
              onClick={item.action ?? undefined}
            >
              {item.label}
            </div>
          )
        )}
      </div>
    </>
  );
}

function PushRemoteMenu({ x, y, remotes, onClose, onSelect }: {
  x: number; y: number;
  remotes: string[];
  onClose: () => void;
  onSelect: (remote: string) => void;
}) {
  return (
    <>
      <div style={styles.backdrop} onClick={onClose} />
      <div style={styles.contextMenu(x, y)}>
        {remotes.length === 0 ? (
          <div style={styles.menuItemDisabled}>No remotes configured</div>
        ) : (
          remotes.map(remote => (
            <div key={remote} style={styles.menuItem(false)} onClick={() => onSelect(remote)}>
              {remote}
            </div>
          ))
        )}
      </div>
    </>
  );
}

const styles = {
  container: {
    width: '220px',
    flexShrink: 0,
    borderRight: '1px solid var(--vscode-panel-border)',
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
    background: 'var(--vscode-sideBar-background)',
    display: 'flex',
    flexDirection: 'column' as const,
    fontSize: '12px',
    color: 'var(--vscode-foreground)',
    position: 'relative' as const,
    userSelect: 'none' as const,
  },
  stickyHeader: {
    position: 'sticky' as const,
    top: 0,
    zIndex: 10,
    background: 'var(--vscode-sideBar-background)',
  },
  searchBox: {
    padding: '6px',
    borderBottom: '1px solid var(--vscode-panel-border)',
  },
  searchInput: {
    width: '100%',
    padding: '4px 6px',
    background: 'var(--vscode-input-background)',
    color: 'var(--vscode-input-foreground)',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: '3px',
    fontSize: '11px',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  repoList: {
    borderBottom: '1px solid var(--vscode-panel-border)',
    padding: '3px 0',
  },
  repoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '2px 8px',
    fontSize: '11px',
    color: 'var(--vscode-sideBarSectionHeader-foreground)',
  },
  repoName: {
    flex: 1,
    fontWeight: 'bold' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    fontSize: '10px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  repoDot: (color: string): React.CSSProperties => ({
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: color,
    flexShrink: 0,
  }),
  iconBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--vscode-foreground)',
    cursor: 'pointer',
    padding: '1px 2px',
    opacity: 0.6,
    display: 'flex',
    alignItems: 'center',
  } as React.CSSProperties,
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    cursor: 'pointer',
    userSelect: 'none' as const,
    background: 'var(--vscode-sideBarSectionHeader-background)',
    borderBottom: '1px solid var(--vscode-panel-border)',
  },
  chevron: {
    fontSize: '9px',
    opacity: 0.5,
    width: '10px',
    flexShrink: 0,
  },
  sectionIcon: {
    fontSize: '13px',
    opacity: 0.7,
    flexShrink: 0,
  } as React.CSSProperties,
  sectionLabel: {
    flex: 1,
    fontSize: '11px',
    fontWeight: 'bold' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    color: 'var(--vscode-sideBarSectionHeader-foreground)',
  },
  count: {
    background: 'var(--vscode-badge-background)',
    color: 'var(--vscode-badge-foreground)',
    borderRadius: '8px',
    padding: '0 5px',
    fontSize: '10px',
    flexShrink: 0,
  },
  branchRow: (isHead: boolean, isFilterSelected: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '2px 8px 2px 14px',
    cursor: 'pointer',
    background: isFilterSelected
      ? 'var(--vscode-list-hoverBackground)'
      : isHead
        ? 'var(--vscode-list-activeSelectionBackground)'
        : 'transparent',
    color: isHead ? 'var(--vscode-list-activeSelectionForeground)' : 'var(--vscode-foreground)',
    fontSize: '12px',
    minHeight: '22px',
    outline: isFilterSelected ? '1px solid var(--vscode-focusBorder)' : 'none',
    outlineOffset: '-1px',
  }),
  branchIcon: (isPrimary: boolean, isHead: boolean): React.CSSProperties => ({
    fontSize: '13px',
    flexShrink: 0,
    color: isPrimary
      ? 'var(--vscode-gitDecoration-untrackedResourceForeground)'
      : isHead
        ? 'var(--vscode-gitDecoration-addedResourceForeground)'
        : 'var(--vscode-foreground)',
    opacity: isPrimary ? 1 : isHead ? 1 : 0.55,
  }),
  branchName: (isHead: boolean, isPrimary: boolean): React.CSSProperties => ({
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    fontWeight: (isHead || isPrimary) ? 'bold' : 'normal',
    color: isPrimary && !isHead
      ? 'var(--vscode-gitDecoration-untrackedResourceForeground)'
      : undefined,
  }),
  dotGroup: {
    display: 'flex',
    gap: '2px',
    alignItems: 'center',
    flexShrink: 0,
  } as React.CSSProperties,
  aheadBehind: {
    display: 'flex',
    gap: '2px',
    fontSize: '10px',
    opacity: 0.65,
    flexShrink: 0,
  },
  backdrop: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 100,
  },
  contextMenu: (x: number, y: number) => ({
    position: 'fixed' as const,
    left: x,
    top: y,
    zIndex: 101,
    background: 'var(--vscode-menu-background)',
    border: '1px solid var(--vscode-menu-border)',
    borderRadius: '4px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    minWidth: '180px',
    padding: '4px 0',
    fontSize: '12px',
  }),
  menuItem: (danger?: boolean): React.CSSProperties => ({
    padding: '4px 12px',
    cursor: 'pointer',
    color: danger ? 'var(--vscode-errorForeground)' : 'var(--vscode-menu-foreground)',
    whiteSpace: 'nowrap' as const,
  }),
  menuItemWithArrow: {
    padding: '4px 12px',
    cursor: 'pointer',
    color: 'var(--vscode-menu-foreground)',
    whiteSpace: 'nowrap' as const,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
  } as React.CSSProperties,
  menuArrow: { fontSize: '9px', opacity: 0.6 } as React.CSSProperties,
  menuItemDisabled: {
    padding: '4px 12px',
    color: 'var(--vscode-disabledForeground)',
    whiteSpace: 'nowrap' as const,
    fontStyle: 'italic',
    fontSize: '11px',
  } as React.CSSProperties,
  separator: {
    height: '1px',
    background: 'var(--vscode-menu-separatorBackground)',
    margin: '4px 0',
  } as React.CSSProperties,
};
