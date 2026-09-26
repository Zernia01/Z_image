import { ArrowLeft, ArrowRight, ChevronsUp, FolderInput, Grid2X2, List, PanelRight, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { IconButton } from "./IconButton";
import { useAppStore } from "../stores/useAppStore";
import type { SortKey } from "../types/image";

export function Toolbar({ onRefresh, onClose, onMove }: { onRefresh: () => void; onClose: () => void; onMove: () => void }) {
  const s = useAppStore();
  const folderName = s.libraryView === "recent" ? "최근 사진" : s.libraryView === "favorites" ? "즐겨찾기" : s.libraryView === "dropped" ? "가져온 사진" : s.folder?.split(/[\\/]/).pop() ?? "사진 라이브러리";
  return <header className="toolbar">
    <div className="toolbar-group nav-controls"><IconButton label="뒤로" disabled><ArrowLeft/></IconButton><IconButton label="앞으로" disabled><ArrowRight/></IconButton><IconButton label="상위 폴더" disabled={!s.folder}><ChevronsUp/></IconButton></div>
    <div className="path-pill"><FolderIcon/><span>{folderName}</span></div>
    <div className="toolbar-group file-actions">
      <IconButton label="선택한 사진 이동" disabled={!s.selected.size} onClick={onMove}><FolderInput/></IconButton>
      <IconButton label="현재 폴더 닫기" className="close-folder-button" disabled={s.libraryView === "home"} onClick={onClose}><X/></IconButton>
    </div>
    <div className="search-box"><Search size={17}/><input aria-label="파일명 검색" placeholder="사진 검색" value={s.search} onChange={e => s.set({ search: e.target.value })}/></div>
    <select className="select-control" aria-label="정렬" value={s.sortKey} onChange={e => s.set({ sortKey: e.target.value as SortKey })}>
      <option value="name">이름순</option><option value="modified">수정 날짜순</option><option value="created">생성 날짜순</option><option value="size">크기순</option><option value="extension">형식순</option>
    </select>
    <IconButton label={s.sortAscending ? "내림차순으로" : "오름차순으로"} onClick={() => s.set({ sortAscending: !s.sortAscending })}><SlidersHorizontal/></IconButton>
    <IconButton label="새로고침" disabled={!s.folder || s.loading} onClick={onRefresh}><RefreshCw className={s.loading ? "spin" : ""}/></IconButton>
    <IconButton label={s.viewMode === "grid" ? "목록 보기" : "그리드 보기"} onClick={() => s.set({ viewMode: s.viewMode === "grid" ? "list" : "grid" })}>{s.viewMode === "grid" ? <List/> : <Grid2X2/>}</IconButton>
    <IconButton label="상세정보 패널" className={s.detailsOpen ? "selected" : ""} onClick={() => s.set({ detailsOpen: !s.detailsOpen })}><PanelRight/></IconButton>
  </header>;
}

function FolderIcon() { return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h6l2 2h10v10H3z"/></svg>; }
