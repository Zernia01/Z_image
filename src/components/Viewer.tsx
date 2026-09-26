import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, FlipHorizontal2, Fullscreen, Info, Maximize, Minimize2, Minus, Plus, RotateCw, Square, X } from "lucide-react";
import { loadMetadata, originalUrl } from "../services/backend";
import { useAppStore } from "../stores/useAppStore";
import type { ImageMetadata } from "../types/image";
import { IconButton } from "./IconButton";
import { formatBytes } from "./Thumbnail";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function Viewer() {
  const s = useAppStore();
  const active = s.active!;
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [flip, setFlip] = useState(false);
  const [immersive, setImmersive] = useState(() => s.settings.openImagesImmersive);
  const [immersiveControlVisible, setImmersiveControlVisible] = useState(false);
  const [infoVisible, setInfoVisible] = useState(() => s.settings.showImmersiveInfo);
  const [topBarVisible, setTopBarVisible] = useState(false);
  const [topBarClosing, setTopBarClosing] = useState(false);
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null);
  const hideControlTimer = useRef<ReturnType<typeof setTimeout>>();
  const hideTopBarTimer = useRef<ReturnType<typeof setTimeout>>();
  const lastWheelMove = useRef(0);
  const imageRef = useRef<HTMLImageElement>(null);
  const preloadCache = useRef(new Map<string, HTMLImageElement>());
  const panDrag = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const index = s.images.findIndex(x => x.id === active.id);
  const move = (delta: number) => { const next = s.images[index + delta]; if (next) { s.openImage(next); setZoom(1); setPan({ x: 0, y: 0 }); setRotation(0); setFlip(false); } };
  const enterImmersive = async () => {
    setZoom(1); setPan({ x: 0, y: 0 }); setImmersive(true); setImmersiveControlVisible(false); setInfoVisible(s.settings.showImmersiveInfo); setTopBarVisible(false); setTopBarClosing(false);
    try { await getCurrentWindow().setDecorations(false); } catch (error) { console.error("창 제목 표시줄을 숨길 수 없습니다.", error); }
  };
  const leaveImmersive = async () => {
    if (hideControlTimer.current) clearTimeout(hideControlTimer.current);
    if (hideTopBarTimer.current) clearTimeout(hideTopBarTimer.current);
    setImmersive(false); setImmersiveControlVisible(false); setInfoVisible(false); setTopBarVisible(false); setTopBarClosing(false);
    try { await getCurrentWindow().setDecorations(true); } catch (error) { console.error("창 제목 표시줄을 복원할 수 없습니다.", error); }
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (immersive) void leaveImmersive(); else s.set({ active: null }); }
      if (e.key === "F11") { e.preventDefault(); if (immersive) void leaveImmersive(); else void enterImmersive(); }
      if (e.key === "ArrowLeft") move(-1);
      if (e.key === "ArrowRight") move(1);
      if (e.key === "+" || e.key === "=") setZoom(z => Math.min(32, z * 1.2));
      if (e.key === "-") setZoom(z => Math.max(.05, z / 1.2));
      if (e.key === "0") setZoom(1);
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  });
  useEffect(() => {
    void getCurrentWindow().center().catch(error => console.error("뷰어 창을 화면 중앙으로 이동할 수 없습니다.", error));
    if (s.settings.openImagesImmersive) void getCurrentWindow().setDecorations(false).catch(() => undefined);
    return () => { if (hideControlTimer.current) clearTimeout(hideControlTimer.current); if (hideTopBarTimer.current) clearTimeout(hideTopBarTimer.current); void getCurrentWindow().setDecorations(true).catch(() => undefined); };
  }, []);
  useEffect(() => {
    if (!infoVisible) { setMetadata(null); return; }
    let live = true;
    setMetadata(null);
    loadMetadata(active.path).then(value => live && setMetadata(value)).catch(() => live && setMetadata(null));
    return () => { live = false; };
  }, [active.path, infoVisible]);
  useEffect(() => {
    const radius = Math.max(1, Math.min(5, s.settings.preload));
    const wanted = new Set<string>();
    for (let offset = -radius; offset <= radius; offset++) {
      const image = s.images[index + offset];
      if (!image || image.id === active.id) continue;
      wanted.add(image.path);
      if (preloadCache.current.has(image.path)) continue;
      const loader = new Image();
      loader.decoding = "async";
      loader.src = originalUrl(image.path);
      preloadCache.current.set(image.path, loader);
      void loader.decode?.().catch(() => undefined);
    }
    for (const path of preloadCache.current.keys()) if (!wanted.has(path)) preloadCache.current.delete(path);
  }, [active.id, index, s.images, s.settings.preload]);
  useEffect(() => {
    if (zoom <= 1 && (pan.x !== 0 || pan.y !== 0)) setPan({ x: 0, y: 0 });
  }, [zoom, pan.x, pan.y]);
  const revealImmersiveControl = () => {
    if (!immersive) return;
    setImmersiveControlVisible(true);
    if (hideControlTimer.current) clearTimeout(hideControlTimer.current);
    hideControlTimer.current = setTimeout(() => setImmersiveControlVisible(false), 1400);
  };
  const modifiedAt = metadata?.modifiedAt ?? active.modifiedAt;
  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    if (event.ctrlKey) {
      setZoom(value => Math.max(.05, Math.min(32, value * (event.deltaY < 0 ? 1.12 : .89))));
      return;
    }
    const now = performance.now();
    if (now - lastWheelMove.current < 220 || Math.abs(event.deltaY) < 2) return;
    lastWheelMove.current = now;
    move(event.deltaY > 0 ? 1 : -1);
  };
  const startPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (zoom <= 1 || event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    panDrag.current = { startX: event.clientX, startY: event.clientY, originX: pan.x, originY: pan.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.classList.add("panning");
  };
  const updatePan = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = panDrag.current;
    if (!drag) return;
    setPan({ x: drag.originX + event.clientX - drag.startX, y: drag.originY + event.clientY - drag.startY });
  };
  const stopPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!panDrag.current) return;
    panDrag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    event.currentTarget.classList.remove("panning");
  };
  const showTopBar = () => {
    if (hideTopBarTimer.current) clearTimeout(hideTopBarTimer.current);
    setTopBarClosing(false);
    setTopBarVisible(true);
  };
  const hideTopBar = () => {
    if (hideTopBarTimer.current) clearTimeout(hideTopBarTimer.current);
    setTopBarClosing(true);
    hideTopBarTimer.current = setTimeout(() => { setTopBarVisible(false); setTopBarClosing(false); }, 120);
  };
  const handleViewerMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    revealImmersiveControl();
    if (!immersive) return;
    const imageTop = imageRef.current?.getBoundingClientRect().top ?? 0;
    const blackAreaBottom = Math.max(imageTop, 72);
    if (event.clientY <= blackAreaBottom) showTopBar();
    else if (topBarVisible && !topBarClosing) hideTopBar();
  };
  return <div className={`viewer ${immersive ? "immersive" : ""} ${immersiveControlVisible || infoVisible || topBarVisible ? "controls-visible" : ""}`} onMouseMove={handleViewerMouseMove} onMouseLeave={() => { if (immersive) setImmersiveControlVisible(false); if (topBarVisible && !topBarClosing) hideTopBar(); }}>
    {immersive && topBarVisible && <div className={`immersive-titlebar ${topBarClosing ? "closing" : ""}`} data-tauri-drag-region onMouseEnter={showTopBar} onDoubleClick={() => void getCurrentWindow().toggleMaximize()}>
      <div className="immersive-title" data-tauri-drag-region><span className="immersive-title-icon">ZI</span><span data-tauri-drag-region>{active.filename} · {index + 1}/{s.images.length}</span></div>
      <div className="immersive-title-actions"><button title="원래 화면으로" onClick={event => { event.stopPropagation(); void leaveImmersive(); }}><Minimize2/><span>원래 화면으로</span></button><button title="최소화" aria-label="최소화" onClick={event => { event.stopPropagation(); void getCurrentWindow().minimize(); }}><Minus/></button><button title="최대화 또는 복원" aria-label="최대화 또는 복원" onClick={event => { event.stopPropagation(); void getCurrentWindow().toggleMaximize(); }}><Square/></button><button className="close" title="앱 종료" aria-label="앱 종료" onClick={event => { event.stopPropagation(); void getCurrentWindow().close(); }}><X/></button></div>
    </div>}
    {!immersive && <div className="viewer-top"><div><strong>{active.filename}</strong><span>{index + 1} / {s.images.length}</span></div><IconButton label="뷰어 닫기" onClick={() => s.set({ active: null })}><X/></IconButton></div>}
    <div className={`viewer-canvas ${zoom > 1 ? "pannable" : ""}`} onWheel={handleWheel} onPointerDown={startPan} onPointerMove={updatePan} onPointerUp={stopPan} onPointerCancel={stopPan}>
      <div className="viewer-image-center"><img ref={imageRef} src={originalUrl(active.path)} alt={active.filename} draggable={false} style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom}) rotate(${rotation}deg) scaleX(${flip ? -1 : 1})` }}/></div>
      {!immersive && <><button className="viewer-nav left" onClick={() => move(-1)} disabled={index <= 0}><ArrowLeft/></button><button className="viewer-nav right" onClick={() => move(1)} disabled={index >= s.images.length - 1}><ArrowRight/></button></>}
      {immersive && index > 0 && <button className="immersive-edge previous" aria-label="이전 사진" onClick={() => move(-1)}><ArrowLeft/></button>}
      {immersive && index < s.images.length - 1 && <button className="immersive-edge next" aria-label="다음 사진" onClick={() => move(1)}><ArrowRight/></button>}
    </div>
    {!immersive && <div className="viewer-controls"><button className="viewer-mode-button" title="사진만 보기 (F11)" onClick={() => void enterImmersive()}><Fullscreen/><span>사진만 보기</span></button><IconButton label="화면 맞춤" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}><Maximize/></IconButton><IconButton label="축소" onClick={() => setZoom(z => Math.max(.05, z / 1.2))}><Minus/></IconButton><button className="zoom-label" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>{Math.round(zoom * 100)}%</button><IconButton label="확대" onClick={() => setZoom(z => Math.min(32, z * 1.2))}><Plus/></IconButton><span/><IconButton label="회전" onClick={() => setRotation(v => v + 90)}><RotateCw/></IconButton><IconButton label="좌우 반전" onClick={() => setFlip(v => !v)}><FlipHorizontal2/></IconButton></div>}
    {immersive && (immersiveControlVisible || infoVisible) && <button className={`immersive-info-toggle ${infoVisible ? "active" : ""} ${topBarVisible ? "below-titlebar" : ""}`} aria-label="사진 정보" title="사진 정보" onClick={() => { const next = !infoVisible; setInfoVisible(next); s.updateSettings({ showImmersiveInfo: next }); }}><Info/></button>}
    {immersive && infoVisible && <div className={`immersive-info-panel ${topBarVisible ? "below-titlebar" : ""}`}><strong>{active.filename}</strong><span>{index + 1} / {s.images.length}</span><span>파일 크기: {formatBytes(metadata?.size ?? active.size)}</span>{modifiedAt && <span>수정한 날짜: {new Date(modifiedAt).toLocaleString()}</span>}{metadata?.width && metadata.height && <span>이미지 정보: {metadata.width} × {metadata.height}{metadata.colorType ? ` · ${metadata.colorType}` : ""}</span>}</div>}
  </div>;
}
