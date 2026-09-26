import { ChevronDown, Copy, FileImage, Info, X } from "lucide-react";
import { useEffect } from "react";
import { loadMetadata } from "../services/backend";
import { useAppStore } from "../stores/useAppStore";
import { formatBytes } from "./Thumbnail";

export function DetailsPanel() {
  const s = useAppStore();
  const selected = s.images.find(x => s.selected.has(x.id));
  useEffect(() => {
    if (!selected) return;
    let live = true;
    loadMetadata(selected.path).then(metadata => live && s.set({ metadata })).catch(() => live && s.set({ metadata: null }));
    return () => { live = false; };
  }, [selected?.path]);
  if (!s.detailsOpen) return null;
  return <aside className="details-panel">
    <div className="panel-title"><div><Info size={17}/><span>상세정보</span></div><button onClick={() => s.set({ detailsOpen: false })} aria-label="상세정보 닫기"><X size={17}/></button></div>
    {!selected ? <div className="details-empty"><FileImage/><p>사진을 선택하세요</p><span>파일과 촬영 정보를 확인할 수 있습니다.</span></div> : <DetailsContent />}
  </aside>;
}

function DetailsContent() {
  const m = useAppStore(s => s.metadata);
  const selected = useAppStore(s => s.images.find(x => s.selected.has(x.id)));
  if (!selected) return null;
  const copy = (v: string) => navigator.clipboard.writeText(v);
  const Row = ({ label, value }: { label: string; value?: string | number }) => value === undefined || value === "" ? null : <div className="detail-row"><span>{label}</span><button onClick={() => copy(String(value))} title="값 복사"><b>{value}</b><Copy size={12}/></button></div>;
  return <div className="details-content">
    <div className="detail-preview"><FileImage size={32}/><strong>{selected.filename}</strong></div>
    <section><h3>기본 정보 <ChevronDown size={14}/></h3><Row label="파일명" value={selected.filename}/><Row label="형식" value={selected.extension.toUpperCase()}/><Row label="크기" value={formatBytes(selected.size)}/><Row label="경로" value={selected.path}/></section>
    <section><h3>이미지 <ChevronDown size={14}/></h3><Row label="해상도" value={m?.width && m.height ? `${m.width} × ${m.height}` : undefined}/><Row label="색상 형식" value={m?.colorType}/><Row label="MIME" value={m?.mimeType}/></section>
    {(m?.cameraMake || m?.cameraModel || m?.lensModel) && <section><h3>카메라 <ChevronDown size={14}/></h3><Row label="제조사" value={m.cameraMake}/><Row label="모델" value={m.cameraModel}/><Row label="렌즈" value={m.lensModel}/></section>}
    {(m?.iso || m?.exposure || m?.aperture || m?.focalLength) && <section><h3>촬영 <ChevronDown size={14}/></h3><Row label="ISO" value={m.iso}/><Row label="셔터" value={m.exposure}/><Row label="조리개" value={m.aperture}/><Row label="초점 거리" value={m.focalLength}/></section>}
  </div>;
}
