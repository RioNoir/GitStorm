import React from 'react';
import type { LaidOutCommit } from '../utils/graphLayout';
import { LANE_WIDTH, ROW_HEIGHT, DOT_RADIUS } from '../utils/graphLayout';

// Lane 0 always gets the VSCode primary button color (theme-aware).
// Remaining lanes use a fixed palette of distinct, readable colors.
const LANE_COLORS = [
  '#569cd6', '#c586c0', '#ce9178',
  '#4fc1ff', '#4ec9b0', '#dcdcaa',
  '#b5cea8', '#9cdcfe', '#d7ba7d',
  '#6796e6', '#cd9731', '#f44747',
];

// Resolved at runtime from the VSCode CSS variable so it follows the theme.
function primaryLaneColor(): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue('--vscode-button-background').trim() || '#0078d4';
}

export function laneColor(lane: number): string {
  if (lane === 0) return primaryLaneColor();
  return LANE_COLORS[(lane - 1) % LANE_COLORS.length];
}

function laneX(lane: number): number {
  return lane * LANE_WIDTH + LANE_WIDTH / 2;
}

const STROKE = 1.5;
const H = ROW_HEIGHT;
const cy = H / 2;

interface RowSvgProps {
  commit: LaidOutCommit;
  isSelected: boolean;
  prevCommit: LaidOutCommit | null;
  nextCommit: LaidOutCommit | null;
  index: number;
  totalCommits: number;
}

export const CommitRowSvg = React.memo(function CommitRowSvg({
  commit, isSelected,
}: RowSvgProps) {
  const lines = commit.graphLines ?? [];
  const dotLane = commit.lane ?? 0;

  const activeLanes = lines.reduce(
    (m, l) => Math.max(m, l.fromLane + 1, l.toLane + 1),
    dotLane + 1
  );
  const svgWidth = activeLanes * LANE_WIDTH + 4;

  const dotX = laneX(dotLane);
  const dotColor = laneColor(dotLane);

  const segments: React.ReactNode[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    if (line.type === 'pass-through') {
      const x = laneX(line.fromLane);
      const color = laneColor(line.fromLane);
      segments.push(
        <line key={idx} x1={x} y1={0} x2={x} y2={H}
          stroke={color} strokeWidth={STROKE} />
      );

    } else if (line.type === 'straight') {
      const fromX = laneX(line.fromLane);
      const toX = laneX(line.toLane);
      const color = laneColor(line.fromLane);

      // Top: only draw incoming line if this lane existed before this commit
      if (!line.isStart) {
        segments.push(
          <line key={`${idx}u`} x1={fromX} y1={0} x2={fromX} y2={cy}
            stroke={color} strokeWidth={STROKE} />
        );
      }
      // Bottom: line leaving the dot toward the primary parent's lane
      // Only draw if this commit actually has a parent (not a root commit)
      if (commit.parents.length > 0) {
        if (fromX === toX) {
          segments.push(
            <line key={`${idx}d`} x1={fromX} y1={cy} x2={toX} y2={H}
              stroke={color} strokeWidth={STROKE} />
          );
        } else {
          segments.push(
            <path key={`${idx}d`} d={bezier(fromX, cy, toX, H)}
              stroke={color} strokeWidth={STROKE} fill="none" />
          );
        }
      }

    } else if (line.type === 'merge-in') {
      // This commit has a secondary (merge) parent on an outer lane.
      // In graphLayout: fromLane = dotLane, toLane = secondary parent's lane.
      //
      // Drawing: from the dot, a branch line fans out downward to `toLane`.
      // The outer lane then continues as pass-through until that parent commit.
      // There is NO line coming from above in the outer lane at this row —
      // the outer lane only starts here.
      const outerLane = line.toLane;
      const outerX = laneX(outerLane);
      const color = laneColor(outerLane);

      // Bottom half only: curve from dotX (cy) out to outerX (H)
      if (dotX === outerX) {
        segments.push(
          <line key={`${idx}d`} x1={dotX} y1={cy} x2={outerX} y2={H}
            stroke={color} strokeWidth={STROKE} />
        );
      } else {
        segments.push(
          <path key={`${idx}d`} d={bezier(dotX, cy, outerX, H)}
            stroke={color} strokeWidth={STROKE} fill="none" />
        );
      }
    }
  }

  const r = isSelected ? DOT_RADIUS + 1 : DOT_RADIUS;

  return (
    <svg width={svgWidth} height={H}
      style={{ display: 'block', flexShrink: 0, overflow: 'visible' }}>
      {segments}
      {/* Halo — clears lines behind the dot */}
      <circle cx={dotX} cy={cy} r={r + 2.5}
        fill="var(--vscode-editor-background)" />
      {/* Commit dot */}
      <circle cx={dotX} cy={cy} r={r}
        fill={isSelected ? '#ffffff' : dotColor}
        stroke={isSelected ? dotColor : 'var(--vscode-editor-background)'}
        strokeWidth={isSelected ? 2 : 1}
      />
    </svg>
  );
});

/**
 * Cubic Bezier S-curve with vertical tangents at both ends.
 * This gives the smooth flowing look seen in PhpStorm's git log.
 */
function bezier(x1: number, y1: number, x2: number, y2: number): string {
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
}
