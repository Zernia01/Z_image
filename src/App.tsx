import { useEffect, useRef, useState } from "react";
import { FolderOpen, Image as ImageIcon, ShieldCheck, Zap } from "lucide-react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Sidebar } from "./components/Sidebar";
import { Toolbar } from "./components/Toolbar";
import { Gallery } from "./components/Gallery";
import { DetailsPanel } from "./components/DetailsPanel";
import { Viewer } from "./components/Viewer";
import { SettingsModal } from "./components/SettingsModal";
import { chooseDestinationFolder, chooseFolder, getLaunchPaths, moveFiles, resolveDroppedPaths, scanFolder } from "./services/backend";
import { useAppStore } from "./stores/useAppStore";
import { checkForUpdates } from "./services/updater";

export default function App() {
  const s = useAppStore(); const [collapsed, setCollapsed] = useState(false); const [dragging, setDragging] = useState(false); const startupHandled = useRef(false);
  const openFolder = async (requested?: string) => {
    const path = requested ?? await chooseFolder(); if (!path) return;
    const generation = useAppStore.getState().generation + 1; s.set({ folder:path, libraryView:"folder", loading:true, error:null, images:[], selected:new Set(), generation });
    try {
      const images = await scanFolder(path, generation);
      const current = useAppStore.getState();
      if (current.settings.rememberLastLocation) localStorage.setItem("zernia.lastFolder", path);
      if (current.settings.rememberRecent) {
        const recent = [path, ...current.recentFolders.filter(x => x !== path)].slice(0,10);
        localStorage.setItem("zernia.recentFolders", JSON.stringify(recent));
        if (useAppStore.getState().generation === generation) s.set({ images, loading:false, recentFolders:recent });
      } else if (useAppStore.getState().generation === generation) {
        s.set({ images, loading:false });
      }
    } catch (error) { s.set({ loading:false, error:String(error) }); }
  };
  const moveSelected = async () => {
    const state = useAppStore.getState();
    const paths = state.images.filter(image => state.selected.has(image.id)).map(image => image.path);
    if (!paths.length) return;
    const destination = await chooseDestinationFolder();
    if (!destination) return;
    try {
      const result = await moveFiles(paths, destination);
      state.applyMoves(result.succeeded);
      if (result.failed.length) window.alert(`일부 사진을 이동하지 못했습니다.\n${result.failed.join("\n")}`);
      if (result.succeeded.length) await openFolder(destination);
    } catch (error) { window.alert(`사진을 이동하지 못했습니다.\n${String(error)}`); }
  };
  const openPaths = async (paths: string[]) => {
    const dropped = await resolveDroppedPaths(paths);
    if (dropped.folder) { await openFolder(dropped.folder); return true; }
    if (!dropped.images.length) return false;
    const state = useAppStore.getState();
    state.set({ libraryView: "dropped", folder: null, images: dropped.images, selected: new Set(), active: null, metadata: null, error: null, search: "" });
    const activePath = dropped.activePath?.toLocaleLowerCase();
    const imageToOpen = activePath ? dropped.images.find(image => image.path.toLocaleLowerCase() === activePath) : dropped.images.length === 1 ? dropped.images[0] : undefined;
    if (imageToOpen) state.openImage(imageToOpen);
    return true;
  };
  useEffect(() => {
    const root = document.documentElement; root.dataset.theme = s.settings.theme;
    root.classList.toggle("no-motion", !s.settings.animations);
  }, [s.settings.theme, s.settings.animations]);
  useEffect(() => {
    if (!s.settings.automaticUpdates || !isTauri()) return;
    const timer = window.setTimeout(() => { void checkForUpdates(false); }, 1800);
    return () => window.clearTimeout(timer);
  }, [s.settings.automaticUpdates]);
  useEffect(() => {
    if (startupHandled.current) return;
    startupHandled.current = true;
    void (async () => {
      if (isTauri()) {
        try {
          const launchPaths = await getLaunchPaths();
          if (launchPaths.length && await openPaths(launchPaths)) return;
        } catch (error) { console.error("실행할 때 전달된 사진을 열 수 없습니다.", error); }
      }
      const state = useAppStore.getState();
      const lastFolder = state.settings.rememberLastLocation ? localStorage.getItem("zernia.lastFolder") : null;
      if (lastFolder) await openFolder(lastFolder);
    })();
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === "o") { e.preventDefault(); openFolder(); }
      if (e.ctrlKey && e.key === ",") { e.preventDefault(); s.set({settingsOpen:true}); }
      if (e.key === "F5" && s.folder) { e.preventDefault(); openFolder(s.folder); }
    }; window.addEventListener("keydown",key); return () => window.removeEventListener("keydown",key);
  });
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    getCurrentWebviewWindow().onDragDropEvent(event => {
      if (event.payload.type === "enter" || event.payload.type === "over") setDragging(true);
      if (event.payload.type === "leave") setDragging(false);
      if (event.payload.type === "drop") {
        setDragging(false);
        const paths = event.payload.paths;
        void (async () => {
          try {
            if (!await openPaths(paths)) window.alert("지원하는 이미지 파일을 찾지 못했습니다.");
          } catch (error) { window.alert(`가져온 항목을 열 수 없습니다.\n${String(error)}`); }
        })();
      }
    }).then(stop => { if (disposed) stop(); else unlisten = stop; });
    return () => { disposed = true; unlisten?.(); };
  }, []);
  if (s.active) return <Viewer/>;
  return <div className="app-shell">
    <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(v=>!v)} onOpen={openFolder}/>
    <div className="workspace"><Toolbar onRefresh={() => s.folder && openFolder(s.folder)} onClose={() => s.showCollection("home")} onMove={moveSelected}/><div className="content-row"><main className="main-content">{s.libraryView === "home" ? <Home onOpen={() => openFolder()}/> : s.loading && !s.images.length ? <LoadingGallery/> : s.error ? <ErrorState message={s.error} onRetry={() => s.folder && openFolder(s.folder)}/> : <Gallery/>}</main><DetailsPanel/></div><StatusBar/></div>
    {dragging && <div className="drop-overlay"><div><FolderOpen/><strong>여기에 놓아 바로 열기</strong><span>이미지 또는 폴더를 가져옵니다</span></div></div>}
    {s.settingsOpen && <SettingsModal/>}
  </div>;
}

function Home({onOpen}:{onOpen:()=>void}) {
  return <div className="home-screen"><div className="hero-glow"/><div className="home-icon"><ImageIcon/></div><h1>사진을, 더 선명하게.</h1><p>빠르고 조용한 사진 라이브러리.<br/>모든 이미지는 이 기기 안에서만 처리됩니다.</p><button className="primary-button" onClick={onOpen}><FolderOpen/>폴더 열기</button>{!isTauri() && <div className="browser-notice">브라우저 미리보기에서는 폴더 선택이 비활성화됩니다.</div>}<div className="feature-chips"><span><Zap/>대용량 폴더 최적화</span><span><ShieldCheck/>완전한 로컬 처리</span></div><div className="drop-zone">사진 또는 폴더를 여기에 놓으세요</div></div>;
}
function LoadingGallery() { return <div className="loading-grid">{Array.from({length:20},(_,i)=><div key={i}><div className="skeleton"/><span className="skeleton line"/></div>)}</div>; }
function ErrorState({message,onRetry}:{message:string;onRetry:()=>void}) { return <div className="error-state"><h2>폴더를 열 수 없습니다</h2><p>{message}</p><button onClick={onRetry}>다시 시도</button></div>; }
function StatusBar() { const s=useAppStore(); return <footer className="statusbar"><span>{s.folder ? `${s.images.length.toLocaleString()}개 사진` : "준비됨"}</span><span>{s.selected.size ? `${s.selected.size}개 선택됨` : s.folder ?? "zernia image"}</span><label>썸네일 <input type="range" min="96" max="300" value={s.settings.thumbnailSize} onChange={e=>s.updateSettings({thumbnailSize:+e.target.value})}/></label></footer>; }
