import { useEffect, useState } from "react";
import { ImageOff, Star, X } from "lucide-react";
import { thumbnailUrl } from "../services/backend";
import type { ImageEntry } from "../types/image";
import { useI18n } from "../i18n";

export function Thumbnail({ image, size, selected, favorite, onClick, onOpen, onFavorite, onRemove }: { image: ImageEntry; size: number; selected: boolean; favorite: boolean; onClick: (e: React.MouseEvent) => void; onOpen: () => void; onFavorite: () => void; onRemove?: () => void }) {
  const t = useI18n();
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
      {failed ? <div className="broken"><ImageOff/><span>{t("thumb.noPreview")}</span></div> : url && <img src={url} alt="" loading="lazy"/>}
      <button className={`favorite ${favorite ? "active" : ""}`} aria-label={t(favorite ? "thumb.unfavorite" : "thumb.favorite")} title={t(favorite ? "thumb.unfavorite" : "thumb.favorite")} onClick={e => { e.stopPropagation(); onFavorite(); }}><Star size={15}/></button>
      {onRemove && <button className="thumb-remove" aria-label={`${image.filename} ${t("thumb.remove")}`} title={t("thumb.removeKeep")} onClick={e => { e.stopPropagation(); onRemove(); }}><X size={15}/></button>}
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
