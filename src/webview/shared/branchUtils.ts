const PRIMARY_BRANCHES = new Set(['main', 'master', 'trunk', 'develop', 'dev', 'release']);

export function isPrimaryBranch(name: string): boolean {
  const base = name.replace(/^[^/]+\//, ''); // strip remote prefix (origin/main → main)
  return PRIMARY_BRANCHES.has(base.toLowerCase());
}
