import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, FlipHorizontal2, Fullscreen, Info, Maximize, Minimize2, Minus, Pause, Play, Plus, RotateCw, SkipBack, SkipForward, Square, X } from "lucide-react";
import { cachedThumbnailUrl, displayImageUrl, loadAnimation, loadMetadata, originalUrl } from "../services/backend";
import { useAppStore } from "../stores/useAppStore";
import type { AnimationInfo, ImageMetadata } from "../types/image";
import { IconButton } from "./IconButton";
import { formatBytes } from "./Thumbnail";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { languageLocale, useI18n } from "../i18n";

const ZOOM_STEPS = [.1, .125, .25, .33, .5, .67, .75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 8, 10];
const isEditableTarget = (target: EventTarget | null) => target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));

export function Viewer() {
  const s = useAppStore();
  const t = useI18n();
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [displayUrl, setDisplayUrl] = useState(() => originalUrl(active.path));
  const [readyImagePath, setReadyImagePath] = useState<string | null>(null);
  const [animation, setAnimation] = useState<AnimationInfo | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [completedLoops, setCompletedLoops] = useState(0);
  const [pendingFrame, setPendingFrame] = useState<number | null>(null);
  const [frameInput, setFrameInput] = useState("1");
  const hideControlTimer = useRef<ReturnType<typeof setTimeout>>();
  const hideTopBarTimer = useRef<ReturnType<typeof setTimeout>>();
  const navigationWheelDelta = useRef(0);
  const navigationWheelFrame = useRef<number>();
  const wheelDirection = useRef(0);
  const zoomWheelDelta = useRef(0);
  const zoomWheelFrame = useRef<number>();
  const imageRef = useRef<HTMLImageElement>(null);
  const preloadCache = useRef(new Map<string, HTMLImageElement>());
  const panDrag = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const index = s.images.findIndex(x => x.id === active.id);
  const activeId = useRef(active.id);
  const images = useRef(s.images);
  activeId.current = active.id;
  images.current = s.images;
  const move = (delta: number) => {
    const currentImages = images.current;
    const currentIndex = currentImages.findIndex(image => image.id === activeId.current);
    if (currentIndex < 0 || currentImages.length < 2) return;
    const requestedIndex = currentIndex + delta;
    const nextIndex = useAppStore.getState().settings.loopNavigation
      ? (requestedIndex + currentImages.length) % currentImages.length
      : Math.max(0, Math.min(currentImages.length - 1, requestedIndex));
    const next = currentImages[nextIndex];
    if (!next || next.id === activeId.current) return;
    activeId.current = next.id;
    useAppStore.getState().openImage(next);
    setZoom(1); setPan({ x: 0, y: 0 }); setRotation(0); setFlip(false);
  };
  const stepZoom = (direction: 1 | -1) => setZoom(current => {
    if (direction > 0) return ZOOM_STEPS.find(value => value > current + .001) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1];
    return [...ZOOM_STEPS].reverse().find(value => value < current - .001) ?? ZOOM_STEPS[0];
  });
  const seekFrame = (requested: number) => {
    if (!animation) return;
    const next = Math.max(0, Math.min(animation.frames.length - 1, requested));
    setPlaying(false); setCompletedLoops(0); setPendingFrame(null); setFrameIndex(next); setFrameInput(String(next + 1));
  };
  const togglePlayback = () => {
    if (!animation) return;
    setCompletedLoops(0);
    setPlaying(value => !value);
  };
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
      if (isEditableTarget(e.target)) return;
      if (e.key === "Escape") { if (immersive) void leaveImmersive(); else s.set({ active: null }); }
      if (e.key === "F11") { e.preventDefault(); if (immersive) void leaveImmersive(); else void enterImmersive(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); animation ? seekFrame(frameIndex - 1) : move(-1); }
      if (e.key === "ArrowRight") { e.preventDefault(); animation ? seekFrame(frameIndex + 1) : move(1); }
      if (e.key === "Home" && animation) { e.preventDefault(); seekFrame(0); }
      if (e.key === "End" && animation) { e.preventDefault(); seekFrame(animation.frames.length - 1); }
      if (e.code === "Space" && animation) { e.preventDefault(); togglePlayback(); }
      if (e.key === "PageUp") { e.preventDefault(); stepZoom(1); }
      if (e.key === "PageDown") { e.preventDefault(); stepZoom(-1); }
      if (e.key === "+" || e.key === "=") stepZoom(1);
      if (e.key === "-") stepZoom(-1);
      if (e.key === "0") setZoom(1);
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  });
  useEffect(() => {
    void getCurrentWindow().center().catch(error => console.error("뷰어 창을 화면 중앙으로 이동할 수 없습니다.", error));
    if (s.settings.openImagesImmersive) void getCurrentWindow().setDecorations(false).catch(() => undefined);
    return () => {
      if (hideControlTimer.current) clearTimeout(hideControlTimer.current);
      if (hideTopBarTimer.current) clearTimeout(hideTopBarTimer.current);
      if (navigationWheelFrame.current !== undefined) cancelAnimationFrame(navigationWheelFrame.current);
      if (zoomWheelFrame.current !== undefined) cancelAnimationFrame(zoomWheelFrame.current);
      void getCurrentWindow().setDecorations(true).catch(() => undefined);
    };
  }, []);
  useEffect(() => {
    let live = true;
    setAnimation(null); setFrameIndex(0); setFrameInput("1"); setPlaying(false); setCompletedLoops(0); setPendingFrame(null);
    loadAnimation(active.path).then(value => {
      if (!live || !value || value.frames.length < 2) return;
      setAnimation(value); setFrameIndex(0); setFrameInput("1"); setPlaying(true);
    }).catch(error => console.error("애니메이션을 불러올 수 없습니다.", error));
    return () => { live = false; };
  }, [active.path]);
  useEffect(() => {
    if (!animation || !playing) return;
    const delay = animation.frames[frameIndex]?.delayMs ?? 100;
    const timer = window.setTimeout(() => {
      setFrameIndex(current => {
        if (current < animation.frames.length - 1) return current + 1;
        const nextLoops = completedLoops + 1;
        if (animation.loopCount !== null && nextLoops >= animation.loopCount) { setPlaying(false); return current; }
        setCompletedLoops(nextLoops);
        return 0;
      });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [animation, completedLoops, frameIndex, playing]);
  useEffect(() => { setFrameInput(String(frameIndex + 1)); }, [frameIndex]);
  useEffect(() => {
    if (!infoVisible) { setMetadata(null); return; }
    let live = true;
    setMetadata(null);
    const timer = window.setTimeout(() => {
      loadMetadata(active.path).then(value => live && setMetadata(value)).catch(() => live && setMetadata(null));
    }, 140);
    return () => { live = false; window.clearTimeout(timer); };
  }, [active.path, infoVisible]);
  useEffect(() => {
    let live = true;
    setPreviewUrl(null);
    setDisplayUrl(originalUrl(active.path));
    setReadyImagePath(null);
    const previewSize = Math.min(512, Math.max(128, s.settings.thumbnailSize * 2));
    cachedThumbnailUrl(active.path, previewSize).then(url => { if (live) setPreviewUrl(url); }).catch(() => undefined);
    displayImageUrl(active.path).then(url => { if (live) setDisplayUrl(url); }).catch(error => console.error("표시용 이미지를 준비할 수 없습니다.", error));
    return () => { live = false; };
  }, [active.path, s.settings.thumbnailSize]);
  useEffect(() => {
    const configuredRadius = Math.max(1, Math.min(5, s.settings.preload));
    const aheadRadius = configuredRadius;
    const behindRadius = Math.min(2, configuredRadius);
    const firstOffset = wheelDirection.current > 0 ? -behindRadius : -aheadRadius;
    const lastOffset = wheelDirection.current < 0 ? behindRadius : aheadRadius;
    const wanted = new Set<string>();
    for (let offset = firstOffset; offset <= lastOffset; offset++) {
      const requestedIndex = index + offset;
      const preloadIndex = s.settings.loopNavigation && s.images.length > 1
        ? ((requestedIndex % s.images.length) + s.images.length) % s.images.length
        : requestedIndex;
      const image = s.images[preloadIndex];
      if (!image || image.id === active.id) continue;
      wanted.add(image.path);
      if (preloadCache.current.has(image.path)) continue;
      const loader = new Image();
      loader.decoding = "async";
      loader.fetchPriority = Math.abs(offset) <= 2 ? "high" : "low";
      loader.src = originalUrl(image.path);
      preloadCache.current.set(image.path, loader);
      if (Math.abs(offset) === 1) void loader.decode?.().catch(() => undefined);
    }
    for (const path of preloadCache.current.keys()) if (!wanted.has(path)) preloadCache.current.delete(path);
  }, [active.id, index, s.images, s.settings.loopNavigation, s.settings.preload]);
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
  const displayedImageUrl = animation?.frames[frameIndex]?.path ?? displayUrl;
  const imageTransform = `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom}) rotate(${rotation}deg) scaleX(${flip ? -1 : 1})`;
  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    const pixelDelta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
    if (event.ctrlKey) {
      zoomWheelDelta.current += pixelDelta;
      if (zoomWheelFrame.current === undefined) {
        zoomWheelFrame.current = requestAnimationFrame(() => {
          const delta = zoomWheelDelta.current;
          zoomWheelDelta.current = 0;
          zoomWheelFrame.current = undefined;
          setZoom(value => Math.max(.05, Math.min(32, value * Math.exp(-delta * .0022))));
        });
      }
      return;
    }
    if (Math.abs(pixelDelta) >= 50) {
      navigationWheelDelta.current = 0;
      if (navigationWheelFrame.current !== undefined) {
        cancelAnimationFrame(navigationWheelFrame.current);
        navigationWheelFrame.current = undefined;
      }
      wheelDirection.current = pixelDelta > 0 ? 1 : -1;
      move(pixelDelta > 0 ? 1 : -1);
      return;
    }
    navigationWheelDelta.current += pixelDelta;
    wheelDirection.current = pixelDelta > 0 ? 1 : -1;
    if (navigationWheelFrame.current !== undefined) return;
    const flushNavigation = () => {
      const delta = navigationWheelDelta.current;
      navigationWheelFrame.current = undefined;
      if (Math.abs(delta) < 24) return;
      navigationWheelDelta.current = 0;
      move(delta > 0 ? 1 : -1);
    };
    navigationWheelFrame.current = requestAnimationFrame(flushNavigation);
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
      <div className="immersive-title-actions"><button title={t("viewer.restore")} onClick={event => { event.stopPropagation(); void leaveImmersive(); }}><Minimize2/><span>{t("viewer.restore")}</span></button><button title={t("viewer.minimize")} aria-label={t("viewer.minimize")} onClick={event => { event.stopPropagation(); void getCurrentWindow().minimize(); }}><Minus/></button><button title={t("viewer.maximize")} aria-label={t("viewer.maximize")} onClick={event => { event.stopPropagation(); void getCurrentWindow().toggleMaximize(); }}><Square/></button><button className="close" title={t("viewer.exit")} aria-label={t("viewer.exit")} onClick={event => { event.stopPropagation(); void getCurrentWindow().close(); }}><X/></button></div>
    </div>}
    {!immersive && <div className="viewer-top"><div><strong>{active.filename}</strong><span>{index + 1} / {s.images.length}</span></div><IconButton label={t("viewer.close")} onClick={() => s.set({ active: null })}><X/></IconButton></div>}
    <div className={`viewer-canvas ${zoom > 1 ? "pannable" : ""}`} onWheel={handleWheel} onPointerDown={startPan} onPointerMove={updatePan} onPointerUp={stopPan} onPointerCancel={stopPan}>
      <div className="viewer-image-center">
        {previewUrl && readyImagePath !== active.path && <img className="viewer-preview-image" src={previewUrl} alt="" draggable={false} style={{ transform: imageTransform }}/>} 
        <img key={active.id} ref={imageRef} className={`viewer-original-image ${readyImagePath === active.path ? "ready" : ""}`} data-image-path={active.path} src={displayedImageUrl} alt={active.filename} draggable={false} decoding="async" loading="eager" onLoad={event => {
          const element = event.currentTarget;
          void element.decode().catch(() => undefined).then(() => {
            if (element.dataset.imagePath === useAppStore.getState().active?.path) setReadyImagePath(element.dataset.imagePath ?? null);
          });
        }} style={{ transform: imageTransform }}/>
      </div>
      {!immersive && <><button className="viewer-nav left" onClick={() => move(-1)} disabled={s.images.length < 2 || (!s.settings.loopNavigation && index <= 0)}><ArrowLeft/></button><button className="viewer-nav right" onClick={() => move(1)} disabled={s.images.length < 2 || (!s.settings.loopNavigation && index >= s.images.length - 1)}><ArrowRight/></button></>}
      {immersive && s.images.length > 1 && (s.settings.loopNavigation || index > 0) && <button className="immersive-edge previous" aria-label={t("viewer.previous")} onClick={() => move(-1)}><ArrowLeft/></button>}
      {immersive && s.images.length > 1 && (s.settings.loopNavigation || index < s.images.length - 1) && <button className="immersive-edge next" aria-label={t("viewer.next")} onClick={() => move(1)}><ArrowRight/></button>}
    </div>
    {animation && <div className={`animation-controls ${immersive ? "immersive" : ""}`}><span className="animation-format">{animation.format}</span><button title={t("viewer.firstFrame")} onClick={() => seekFrame(0)}><SkipBack/></button><button title={t("viewer.previousFrame")} onClick={() => seekFrame(frameIndex - 1)}><ChevronLeft/></button><button className="animation-play" title={t(playing ? "viewer.pause" : "viewer.play")} onClick={togglePlayback}>{playing ? <Pause/> : <Play/>}</button><button title={t("viewer.nextFrame")} onClick={() => seekFrame(frameIndex + 1)}><ChevronRight/></button><button title={t("viewer.lastFrame")} onClick={() => seekFrame(animation.frames.length - 1)}><SkipForward/></button><input className="frame-slider" aria-label={t("viewer.frameSeek")} type="range" min="0" max={animation.frames.length - 1} value={pendingFrame ?? frameIndex} onPointerDown={() => setPlaying(false)} onChange={event => { setPlaying(false); setPendingFrame(Number(event.target.value)); }} onPointerUp={() => pendingFrame !== null && seekFrame(pendingFrame)} onKeyUp={() => pendingFrame !== null && seekFrame(pendingFrame)}/><label className="frame-number"><input aria-label={t("viewer.frameNumber")} type="number" min="1" max={animation.frames.length} value={frameInput} onChange={event => setFrameInput(event.target.value)} onBlur={() => seekFrame(Number(frameInput || 1) - 1)} onKeyDown={event => { if (event.key === "Enter") { seekFrame(Number(frameInput || 1) - 1); event.currentTarget.blur(); } }}/><span>/ {animation.frames.length} {t("viewer.frames")}</span></label></div>}
    {!immersive && <div className="viewer-controls"><button className="viewer-mode-button" title={`${t("viewer.immersive")} (F11)`} onClick={() => void enterImmersive()}><Fullscreen/><span>{t("viewer.immersive")}</span></button><IconButton label={t("viewer.fit")} onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}><Maximize/></IconButton><IconButton label={t("viewer.zoomOut")} onClick={() => stepZoom(-1)}><Minus/></IconButton><button className="zoom-label" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>{Math.round(zoom * 100)}%</button><IconButton label={t("viewer.zoomIn")} onClick={() => stepZoom(1)}><Plus/></IconButton><span/><IconButton label={t("viewer.rotate")} onClick={() => setRotation(v => v + 90)}><RotateCw/></IconButton><IconButton label={t("viewer.flip")} onClick={() => setFlip(v => !v)}><FlipHorizontal2/></IconButton></div>}
    {immersive && (immersiveControlVisible || infoVisible) && <button className={`immersive-info-toggle ${infoVisible ? "active" : ""} ${topBarVisible ? "below-titlebar" : ""}`} aria-label={t("viewer.info")} title={t("viewer.info")} onClick={() => { const next = !infoVisible; setInfoVisible(next); s.updateSettings({ showImmersiveInfo: next }); }}><Info/></button>}
    {immersive && infoVisible && <div className={`immersive-info-panel ${topBarVisible ? "below-titlebar" : ""}`}><strong>{active.filename}</strong><span>{index + 1} / {s.images.length}</span><span>{t("viewer.fileSize")}: {formatBytes(metadata?.size ?? active.size)}</span>{modifiedAt && <span>{t("viewer.modified")}: {new Date(modifiedAt).toLocaleString(languageLocale(s.settings.language))}</span>}{metadata?.width && metadata.height && <span>{t("viewer.imageInfo")}: {metadata.width} × {metadata.height}{metadata.colorType ? ` · ${metadata.colorType}` : ""}</span>}</div>}
  </div>;
}
