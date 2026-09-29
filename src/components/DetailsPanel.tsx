import { ChevronDown, Copy, FileImage, Info, X } from "lucide-react";
import { useEffect } from "react";
import { loadMetadata } from "../services/backend";
import { useAppStore } from "../stores/useAppStore";
import { formatBytes } from "./Thumbnail";
import { useI18n } from "../i18n";

export function DetailsPanel() {
  const s = useAppStore();
  const t = useI18n();
  const selected = s.images.find(x => s.selected.has(x.id));
  useEffect(() => {
    if (!selected) return;
    let live = true;
    loadMetadata(selected.path).then(metadata => live && s.set({ metadata })).catch(() => live && s.set({ metadata: null }));
    return () => { live = false; };
  }, [selected?.path]);
  if (!s.detailsOpen) return null;
  return <aside className="details-panel">
    <div className="panel-title"><div><Info size={17}/><span>{t("details.title")}</span></div><button onClick={() => s.set({ detailsOpen: false })} aria-label={t("details.close")}><X size={17}/></button></div>
    {!selected ? <div className="details-empty"><FileImage/><p>{t("details.select")}</p><span>{t("details.selectHint")}</span></div> : <DetailsContent />}
  </aside>;
}

function DetailsContent() {
  const t = useI18n();
  const m = useAppStore(s => s.metadata);
  const selected = useAppStore(s => s.images.find(x => s.selected.has(x.id)));
  if (!selected) return null;
  const copy = (v: string) => navigator.clipboard.writeText(v);
  const Row = ({ label, value }: { label: string; value?: string | number }) => value === undefined || value === "" ? null : <div className="detail-row"><span>{label}</span><button onClick={() => copy(String(value))} title={t("details.copy")}><b>{value}</b><Copy size={12}/></button></div>;
  return <div className="details-content">
    <div className="detail-preview"><FileImage size={32}/><strong>{selected.filename}</strong></div>
    <section><h3>{t("details.basic")} <ChevronDown size={14}/></h3><Row label={t("details.filename")} value={selected.filename}/><Row label={t("details.format")} value={selected.extension.toUpperCase()}/><Row label={t("details.size")} value={formatBytes(selected.size)}/><Row label={t("details.path")} value={selected.path}/></section>
    <section><h3>{t("details.image")} <ChevronDown size={14}/></h3><Row label={t("details.resolution")} value={m?.width && m.height ? `${m.width} × ${m.height}` : undefined}/><Row label={t("details.color")} value={m?.colorType}/><Row label="MIME" value={m?.mimeType}/></section>
    {(m?.cameraMake || m?.cameraModel || m?.lensModel) && <section><h3>{t("details.camera")} <ChevronDown size={14}/></h3><Row label={t("details.maker")} value={m.cameraMake}/><Row label={t("details.model")} value={m.cameraModel}/><Row label={t("details.lens")} value={m.lensModel}/></section>}
    {(m?.iso || m?.exposure || m?.aperture || m?.focalLength) && <section><h3>{t("details.capture")} <ChevronDown size={14}/></h3><Row label="ISO" value={m.iso}/><Row label={t("details.shutter")} value={m.exposure}/><Row label={t("details.aperture")} value={m.aperture}/><Row label={t("details.focal")} value={m.focalLength}/></section>}
  </div>;
}
