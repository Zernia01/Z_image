import { useEffect, useState } from "react";
import { ImageOff, Star, X } from "lucide-react";
import { thumbnailUrl } from "../services/backend";
import type { ImageEntry } from "../types/image";

export function Thumbnail({ image, size, selected, favorite, onClick, onOpen, onFavorite, onRemove }: { image: ImageEntry; size: number; selected: boolean; favorite: boolean; onClick: (e: React.MouseEvent) => void; onOpen: () => void; onFavorite: () => void; onRemove?: () => void }) {
  const [url, setUrl] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let current = true;
    setUrl(undefined); setFailed(false);
    thumbnailUrl(image.path, Math.min(512, Math.max(128, size * 2))).then(v => current && setUrl(v)).catch(() => current && setFailed(true));
    return () => { current = false; };
  }, [image.path, size]);
  return <div className={`thumb-card ${selected ? "selected" : ""}`} role="button" tabIndex={0} onClick={onClick} onDoubleClick={onOpen} onKeyDown={e => { if (e.key === "Enter") onOpen(); }} title={image.filename}>
    <div className="thumb-image" style={{ height: size }}>
      {!url && !failed && <div className="skeleton"/>}
      {failed ? <div className="broken"><ImageOff/><span>미리보기 없음</span></div> : url && <img src={url} alt="" loading="lazy"/>}
      <button className={`favorite ${favorite ? "active" : ""}`} aria-label={favorite ? "즐겨찾기 해제" : "즐겨찾기 추가"} title={favorite ? "즐겨찾기 해제" : "즐겨찾기 추가"} onClick={e => { e.stopPropagation(); onFavorite(); }}><Star size={15}/></button>
      {onRemove && <button className="thumb-remove" aria-label={`${image.filename} 목록에서 제거`} title="목록에서 제거 (원본 유지)" onClick={e => { e.stopPropagation(); onRemove(); }}><X size={15}/></button>}
    </div>
    <div className="thumb-copy"><strong>{image.filename}</strong><span>{image.width && image.height ? `${image.width} × ${image.height}` : formatBytes(image.size)}</span></div>
  </div>;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let n = bytes / 1024, i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 10 ? 1 : 2)} ${units[i]}`;
}
