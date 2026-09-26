import { useMemo, useRef } from "react";
import { Thumbnail } from "./Thumbnail";
import { useAppStore } from "../stores/useAppStore";
import { useVirtualGrid } from "../hooks/useVirtualGrid";
import type { ImageEntry } from "../types/image";

export function Gallery() {
  const s = useAppStore();
  const ref = useRef<HTMLDivElement>(null);
  const size = s.viewMode === "list" ? 56 : s.settings.thumbnailSize;
  const itemWidth = s.viewMode === "list" ? 1_000_000 : size + 28;
  const itemHeight = s.viewMode === "list" ? 66 : size + 64;
  const images = useMemo(() => filterSort(s.images, s.search, s.sortKey, s.sortAscending), [s.images, s.search, s.sortKey, s.sortAscending]);
  const virtual = useVirtualGrid(images.length, itemWidth, itemHeight, ref);
  const select = (image: ImageEntry, e: React.MouseEvent) => {
    const next = new Set(e.ctrlKey ? s.selected : []);
    if (next.has(image.id)) next.delete(image.id); else next.add(image.id);
    s.set({ selected: next, metadata: null });
  };
  if (!images.length) return <div className="empty-results"><span>검색 결과가 없습니다</span><small>다른 검색어를 입력해 보세요.</small></div>;
  return <div className={`gallery-scroll ${s.viewMode}`} ref={ref} onWheel={e => {
    if (e.ctrlKey) { e.preventDefault(); s.updateSettings({ thumbnailSize: Math.max(96, Math.min(300, size - Math.sign(e.deltaY) * 16)) }); }
  }}>
    <div className="virtual-stage" style={{ height: virtual.totalHeight }}>
      {images.slice(virtual.start, virtual.end).map((image, offset) => {
        const index = virtual.start + offset;
        const column = index % virtual.columns;
        const row = Math.floor(index / virtual.columns);
        return <div className="virtual-item" key={image.id} style={{ left: column * (s.viewMode === "list" ? 0 : itemWidth), top: row * itemHeight, width: s.viewMode === "list" ? "100%" : itemWidth }}>
          <Thumbnail image={image} size={size} selected={s.selected.has(image.id)} favorite={s.favoriteImages.some(item => item.path === image.path)} onClick={e => select(image, e)} onOpen={() => s.openImage(image)} onFavorite={() => s.toggleFavorite(image)} onRemove={s.libraryView === "folder" ? undefined : () => s.removeFromCurrentCollection(image)}/>
        </div>;
      })}
    </div>
  </div>;
}

function filterSort(images: ImageEntry[], query: string, key: string, asc: boolean) {
  const q = query.trim().toLocaleLowerCase();
  const filtered = q ? images.filter(x => x.filename.toLocaleLowerCase().includes(q)) : [...images];
  const value = (x: ImageEntry): string | number => key === "name" ? x.filename : key === "modified" ? x.modifiedAt ?? 0 : key === "created" ? x.createdAt ?? 0 : key === "size" ? x.size : x.extension;
  return filtered.sort((a,b) => { const av=value(a), bv=value(b); const result=typeof av === "string" ? av.localeCompare(String(bv), undefined, { numeric: true }) : av-Number(bv); return asc ? result : -result; });
}
