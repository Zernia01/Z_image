import { ArrowLeft, ArrowRight, ChevronsUp, FolderInput, Grid2X2, List, PanelRight, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { IconButton } from "./IconButton";
import { useAppStore } from "../stores/useAppStore";
import type { SortKey } from "../types/image";
import { useI18n } from "../i18n";

export function Toolbar({ onRefresh, onClose, onMove }: { onRefresh: () => void; onClose: () => void; onMove: () => void }) {
  const s = useAppStore();
  const t = useI18n();
  const folderName = s.libraryView === "recent" ? t("toolbar.recent") : s.libraryView === "favorites" ? t("toolbar.favorites") : s.libraryView === "dropped" ? t("toolbar.dropped") : s.folder?.split(/[\\/]/).pop() ?? t("toolbar.library");
  return <header className="toolbar">
    <div className="toolbar-group nav-controls"><IconButton label={t("toolbar.back")} disabled><ArrowLeft/></IconButton><IconButton label={t("toolbar.forward")} disabled><ArrowRight/></IconButton><IconButton label={t("toolbar.parent")} disabled={!s.folder}><ChevronsUp/></IconButton></div>
    <div className="path-pill"><FolderIcon/><span>{folderName}</span></div>
    <div className="toolbar-group file-actions">
      <IconButton label={t("toolbar.move")} disabled={!s.selected.size} onClick={onMove}><FolderInput/></IconButton>
      <IconButton label={t("toolbar.closeFolder")} className="close-folder-button" disabled={s.libraryView === "home"} onClick={onClose}><X/></IconButton>
    </div>
    <div className="search-box"><Search size={17}/><input aria-label={t("toolbar.searchLabel")} placeholder={t("toolbar.search")} value={s.search} onChange={e => s.set({ search: e.target.value })}/></div>
    <select className="select-control" aria-label={t("toolbar.sort")} value={s.sortKey} onChange={e => s.set({ sortKey: e.target.value as SortKey })}>
      <option value="name">{t("toolbar.sortName")}</option><option value="modified">{t("toolbar.sortModified")}</option><option value="created">{t("toolbar.sortCreated")}</option><option value="size">{t("toolbar.sortSize")}</option><option value="extension">{t("toolbar.sortExtension")}</option>
    </select>
    <IconButton label={t(s.sortAscending ? "toolbar.descending" : "toolbar.ascending")} onClick={() => s.set({ sortAscending: !s.sortAscending })}><SlidersHorizontal/></IconButton>
    <IconButton label={t("toolbar.refresh")} disabled={!s.folder || s.loading} onClick={onRefresh}><RefreshCw className={s.loading ? "spin" : ""}/></IconButton>
    <IconButton label={t(s.viewMode === "grid" ? "toolbar.list" : "toolbar.grid")} onClick={() => s.set({ viewMode: s.viewMode === "grid" ? "list" : "grid" })}>{s.viewMode === "grid" ? <List/> : <Grid2X2/>}</IconButton>
    <IconButton label={t("toolbar.details")} className={s.detailsOpen ? "selected" : ""} onClick={() => s.set({ detailsOpen: !s.detailsOpen })}><PanelRight/></IconButton>
  </header>;
}

function FolderIcon() { return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h6l2 2h10v10H3z"/></svg>; }
