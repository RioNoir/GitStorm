import type { CommitNode, GraphLine } from '../../shared/types';

export const LANE_WIDTH = 20;
export const ROW_HEIGHT = 28;
export const DOT_RADIUS = 4;

export interface LaidOutCommit extends CommitNode {
  lane: number;
  totalLanes: number;
  graphLines: GraphLine[];
}

export function assignLanes(commits: CommitNode[]): LaidOutCommit[] {
  // laneOf: parent-hash → lane index reserved by one of its children
  const laneOf = new Map<string, number>();
  // occupied: lane indices that have an active "thread" going downward
  const occupied = new Set<number>();
  const laidOut: LaidOutCommit[] = [];

  function nextFreeLane(): number {
    let i = 0;
    while (occupied.has(i)) i++;
    return i;
  }

  for (const commit of commits) {
    // ── Step 1: find this commit's lane ──────────────────────────────────────
    let lane: number;
    let isStart: boolean;

    if (laneOf.has(commit.hash)) {
      lane = laneOf.get(commit.hash)!;
      isStart = false;
    } else {
      lane = nextFreeLane();
      isStart = true;
      occupied.add(lane);
    }
    laneOf.delete(commit.hash);

    // ── Step 2: snapshot lanes active *entering* this row (for pass-through) ─
    // At this point `occupied` contains all lanes with active threads,
    // including the current commit's lane.
    const enteringLanes = new Set(occupied);

    // ── Step 3: assign lanes to parents ──────────────────────────────────────
    const parentLanes: number[] = [];

    for (let i = 0; i < commit.parents.length; i++) {
      const parentHash = commit.parents[i];

      if (i === 0) {
        if (laneOf.has(parentHash)) {
          // Parent already has a lane reserved by another child (diamond merge).
          // Our lane becomes free after this row.
          parentLanes.push(laneOf.get(parentHash)!);
          occupied.delete(lane);
        } else {
          // First parent inherits this commit's lane — thread continues.
          laneOf.set(parentHash, lane);
          parentLanes.push(lane);
          // lane stays in occupied
        }
      } else {
        // Merge parent: find existing reservation or open a new lane.
        if (laneOf.has(parentHash)) {
          parentLanes.push(laneOf.get(parentHash)!);
        } else {
          const newLane = nextFreeLane();
          occupied.add(newLane);
          laneOf.set(parentHash, newLane);
          parentLanes.push(newLane);
        }
      }
    }

    // Root commit (no parents): free the lane.
    if (commit.parents.length === 0) {
      occupied.delete(lane);
    }

    // ── Step 4: build graph lines ─────────────────────────────────────────────
    const graphLines: GraphLine[] = [];

    // Straight line for this commit's own lane
    graphLines.push({
      fromLane: lane,
      toLane: parentLanes.length > 0 ? parentLanes[0] : lane,
      type: 'straight',
      repoId: commit.repoId,
      isStart,
    });

    // Fan-out lines to merge parents
    for (let p = 1; p < parentLanes.length; p++) {
      graphLines.push({
        fromLane: lane,
        toLane: parentLanes[p],
        type: 'merge-in',
        repoId: commit.repoId,
      });
    }

    // Pass-through for every lane that was active entering this row,
    // except this commit's own lane.
    for (const l of enteringLanes) {
      if (l === lane) continue;
      graphLines.push({
        fromLane: l,
        toLane: l,
        type: 'pass-through',
        repoId: commit.repoId,
      });
    }

    const activeLaneCount = occupied.size > 0 ? Math.max(...occupied) + 1 : lane + 1;

    laidOut.push({
      ...commit,
      lane,
      totalLanes: activeLaneCount,
      graphLines,
    });
  }

  return laidOut;
}
