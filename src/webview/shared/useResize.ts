import { useRef, useCallback, useEffect } from 'react';

/**
 * Drag-to-resize hook for a panel adjacent to a resize handle.
 * Returns a ref to attach to the panel and a mousedown handler for the handle.
 *
 * @param direction  'right' = dragging handle resizes the panel on its left
 *                   'left'  = dragging handle resizes the panel on its right
 * @param initial    Initial pixel width
 * @param min        Minimum pixel width
 * @param max        Maximum pixel width
 */
export function useResize(
  direction: 'right' | 'left',
  initial: number,
  min: number,
  max: number,
) {
  const panelRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(initial);

  // Restore persisted width on mount
  useEffect(() => {
    if (panelRef.current) {
      panelRef.current.style.width = `${widthRef.current}px`;
      panelRef.current.style.flex = 'none';
    }
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = panelRef.current?.offsetWidth ?? widthRef.current;

    const onMove = (ev: MouseEvent) => {
      const delta = direction === 'right' ? ev.clientX - startX : startX - ev.clientX;
      const next = Math.min(max, Math.max(min, startWidth + delta));
      widthRef.current = next;
      if (panelRef.current) {
        panelRef.current.style.width = `${next}px`;
        panelRef.current.style.flex = 'none';
      }
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [direction, min, max]);

  return { panelRef, onMouseDown };
}
