import { Clock3, Folder, FolderHeart, Home, Image, PanelLeftClose, Settings, X } from "lucide-react";
import { useAppStore } from "../stores/useAppStore";

export function Sidebar({ collapsed, onToggle, onOpen }: { collapsed: boolean; onToggle: () => void; onOpen: (path?: string) => void }) {
  const recent = useAppStore(s => s.recentFolders);
  const s = useAppStore();
  return <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
    <div className="brand"><div className="brand-mark"><Image size={18}/></div>{!collapsed && <span>zernia <b>image</b></span>}</div>
    <nav className="side-nav" aria-label="기본 탐색">
      <button className={`nav-item ${s.libraryView === "home" ? "active" : ""}`} onClick={() => s.showCollection("home")}><Home size={18}/>{!collapsed && "홈"}</button>
      <button className={`nav-item ${s.libraryView === "recent" ? "active" : ""}`} disabled={!s.settings.rememberRecent} title={s.settings.rememberRecent ? "최근 사진" : "설정에서 최근 기록이 꺼져 있습니다"} onClick={() => s.showCollection("recent")}><Clock3 size={18}/>{!collapsed && "최근 사진"}{!collapsed && s.recentImages.length > 0 && <span className="nav-count">{s.recentImages.length}</span>}</button>
      <button className={`nav-item ${s.libraryView === "favorites" ? "active" : ""}`} onClick={() => s.showCollection("favorites")}><FolderHeart size={18}/>{!collapsed && "즐겨찾기"}{!collapsed && s.favoriteImages.length > 0 && <span className="nav-count">{s.favoriteImages.length}</span>}</button>
      <button className="nav-item" onClick={() => onOpen()}><Folder size={18}/>{!collapsed && "폴더 열기"}</button>
    </nav>
    {!collapsed && recent.length > 0 && <div className="recent-block"><p>최근 폴더</p>{recent.slice(0,5).map(path => <div className="recent-row" key={path}><button className="recent-open" onClick={() => onOpen(path)} title={path}><Folder size={15}/><span>{path.split(/[\\/]/).pop()}</span></button><button className="recent-remove" onClick={() => s.removeRecentFolder(path)} aria-label={`${path} 최근 기록 삭제`} title="최근 목록에서 삭제"><X size={13}/></button></div>)}</div>}
    <div className="sidebar-bottom">
      <button className="nav-item" onClick={() => s.set({ settingsOpen: true })}><Settings size={18}/>{!collapsed && "설정"}</button>
      <button className="nav-item" onClick={onToggle}><PanelLeftClose size={18}/>{!collapsed && "사이드바 접기"}</button>
    </div>
  </aside>;
}
