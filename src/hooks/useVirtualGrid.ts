import { useEffect, useMemo, useState, type RefObject } from "react";

export function useVirtualGrid(count: number, itemWidth: number, itemHeight: number, ref: RefObject<HTMLDivElement | null>) {
  const [viewport, setViewport] = useState({ width: 800, height: 600, top: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setViewport({ width: el.clientWidth, height: el.clientHeight, top: el.scrollTop });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    return () => { observer.disconnect(); el.removeEventListener("scroll", update); };
  }, [ref]);

  return useMemo(() => {
    const columns = Math.max(1, Math.floor(viewport.width / itemWidth));
    const rows = Math.ceil(count / columns);
    const firstRow = Math.max(0, Math.floor(viewport.top / itemHeight) - 2);
    const lastRow = Math.min(rows, Math.ceil((viewport.top + viewport.height) / itemHeight) + 2);
    return { columns, totalHeight: rows * itemHeight, start: firstRow * columns, end: Math.min(count, lastRow * columns) };
  }, [count, itemHeight, itemWidth, viewport]);
}
