import { Clock3, Folder, FolderHeart, Home, Image, PanelLeftClose, Settings, X } from "lucide-react";
import { useAppStore } from "../stores/useAppStore";
import { useI18n } from "../i18n";

export function Sidebar({ collapsed, onToggle, onOpen }: { collapsed: boolean; onToggle: () => void; onOpen: (path?: string) => void }) {
  const recent = useAppStore(s => s.recentFolders);
  const s = useAppStore();
  const t = useI18n();
  return <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
    <div className="brand"><div className="brand-mark"><Image size={18}/></div>{!collapsed && <span>zernia <b>image</b></span>}</div>
    <nav className="side-nav" aria-label={t("sidebar.navigation")}>
      <button className={`nav-item ${s.libraryView === "home" ? "active" : ""}`} onClick={() => s.showCollection("home")}><Home size={18}/>{!collapsed && t("sidebar.home")}</button>
      <button className={`nav-item ${s.libraryView === "recent" ? "active" : ""}`} disabled={!s.settings.rememberRecent} title={t(s.settings.rememberRecent ? "sidebar.recent" : "sidebar.recentDisabled")} onClick={() => s.showCollection("recent")}><Clock3 size={18}/>{!collapsed && t("sidebar.recent")}{!collapsed && s.recentImages.length > 0 && <span className="nav-count">{s.recentImages.length}</span>}</button>
      <button className={`nav-item ${s.libraryView === "favorites" ? "active" : ""}`} onClick={() => s.showCollection("favorites")}><FolderHeart size={18}/>{!collapsed && t("sidebar.favorites")}{!collapsed && s.favoriteImages.length > 0 && <span className="nav-count">{s.favoriteImages.length}</span>}</button>
      <button className="nav-item" onClick={() => onOpen()}><Folder size={18}/>{!collapsed && t("sidebar.openFolder")}</button>
    </nav>
    {!collapsed && recent.length > 0 && <div className="recent-block"><p>{t("sidebar.recentFolders")}</p>{recent.slice(0,5).map(path => <div className="recent-row" key={path}><button className="recent-open" onClick={() => onOpen(path)} title={path}><Folder size={15}/><span>{path.split(/[\\/]/).pop()}</span></button><button className="recent-remove" onClick={() => s.removeRecentFolder(path)} aria-label={t("sidebar.removeRecentAria", { path })} title={t("sidebar.removeRecent")}><X size={13}/></button></div>)}</div>}
    <div className="sidebar-bottom">
      <button className="nav-item" onClick={() => s.set({ settingsOpen: true })}><Settings size={18}/>{!collapsed && t("common.settings")}</button>
      <button className="nav-item" onClick={onToggle}><PanelLeftClose size={18}/>{!collapsed && t("sidebar.collapse")}</button>
    </div>
  </aside>;
}
