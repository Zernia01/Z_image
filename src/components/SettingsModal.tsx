import { Check, ExternalLink, Info, Monitor, Palette, Settings2, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { cacheStats, clearAppCache, openDefaultAppsSettings } from "../services/backend";
import { checkForUpdates } from "../services/updater";
import { languageOptions, useI18n } from "../i18n";
import { useAppStore } from "../stores/useAppStore";
import type { Language, Theme } from "../types/settings";
import { formatBytes } from "./Thumbnail";

export function SettingsModal() {
  const s = useAppStore();
  const t = useI18n();
  const [tab, setTab] = useState("appearance");
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<{ bytes: number; files: number } | null>(null);
  const checkUpdate = async () => { setCheckingUpdate(true); try { await checkForUpdates(true); } finally { setCheckingUpdate(false); } };
  useEffect(() => { if (tab === "performance") void cacheStats().then(setCacheInfo).catch(() => setCacheInfo(null)); }, [tab]);
  const clearCache = async () => {
    setClearingCache(true);
    try { await clearAppCache(); setCacheInfo({ bytes: 0, files: 0 }); window.alert(t("settings.cacheCleared")); }
    catch (error) { window.alert(t("settings.cacheError", { details: String(error) })); }
    finally { setClearingCache(false); }
  };
  const tabs = [
    { id: "general", label: t("settings.general"), icon: Settings2 },
    { id: "appearance", label: t("settings.appearance"), icon: Palette },
    { id: "performance", label: t("settings.performance"), icon: SlidersHorizontal },
    { id: "about", label: t("settings.about"), icon: Info }
  ];
  return <div className="modal-backdrop" onMouseDown={() => s.set({ settingsOpen: false })}><div className="settings-modal" onMouseDown={e => e.stopPropagation()}>
    <aside><h2>{t("common.settings")}</h2>{tabs.map(item => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><item.icon size={17}/>{item.label}</button>)}</aside>
    <main><button className="modal-close" aria-label={t("common.close")} onClick={() => s.set({ settingsOpen: false })}><X/></button>
      {tab === "appearance" && <><h1>{t("settings.appearance")}</h1><p className="settings-lead">{t("settings.appearanceLead")}</p><SettingGroup title={t("settings.theme")}><div className="theme-options">{(["system", "light", "dark"] as Theme[]).map(theme => <button key={theme} onClick={() => s.updateSettings({ theme })} className={s.settings.theme === theme ? "active" : ""}><Monitor/><span>{t(theme === "system" ? "settings.system" : theme === "light" ? "settings.light" : "settings.dark")}</span>{s.settings.theme === theme && <Check size={16}/>}</button>)}</div></SettingGroup><SettingGroup title={t("settings.photoList")}><label className="slider-row"><span>{t("settings.thumbnailSize")} <b>{s.settings.thumbnailSize}px</b></span><input type="range" min="96" max="300" value={s.settings.thumbnailSize} onChange={e => s.updateSettings({ thumbnailSize: +e.target.value })}/></label></SettingGroup></>}
      {tab === "general" && <><h1>{t("settings.general")}</h1><p className="settings-lead">{t("settings.generalLead")}</p><SettingGroup title={t("settings.language")}><select value={s.settings.language} onChange={e => s.updateSettings({ language: e.target.value as Language })}>{languageOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></SettingGroup><SettingGroup title={t("settings.photoOpen")}><Toggle label={t("settings.openImmersive")} checked={s.settings.openImagesImmersive} onChange={checked => s.updateSettings({ openImagesImmersive: checked })}/><Toggle label={t("settings.showInfo")} checked={s.settings.showImmersiveInfo} onChange={checked => s.updateSettings({ showImmersiveInfo: checked })}/><Toggle label={t("settings.animationControls")} checked={s.settings.showAnimationControls} onChange={checked => s.updateSettings({ showAnimationControls: checked })}/><Toggle label={t("settings.tabDetails")} checked={s.settings.tabTogglesDetails} onChange={checked => s.updateSettings({ tabTogglesDetails: checked })}/></SettingGroup><SettingGroup title={t("settings.navigation")}><Toggle label={t("settings.loop")} checked={s.settings.loopNavigation} onChange={checked => s.updateSettings({ loopNavigation: checked })}/><p className="setting-hint">{t("settings.loopHint")}</p></SettingGroup><SettingGroup title={t("settings.updates")}><div className="setting-stack"><Toggle label={t("settings.autoUpdate")} checked={s.settings.automaticUpdates} onChange={checked => s.updateSettings({ automaticUpdates: checked })}/><button className="setting-action" disabled={checkingUpdate} onClick={() => void checkUpdate()}>{t(checkingUpdate ? "settings.checking" : "settings.checkNow")}</button></div></SettingGroup><SettingGroup title={t("settings.defaultApp")}><div className="file-association-setting"><div><span>{t("settings.windowsPhoto")}</span><small>{t("settings.windowsPhotoHint")}</small></div><button onClick={() => void openDefaultAppsSettings()}><ExternalLink/>{t("settings.setDefault")}</button></div><p className="setting-hint">{t("settings.associationHint")}</p></SettingGroup><SettingGroup title={t("settings.startup")}><Toggle label={t("settings.rememberLocation")} checked={s.settings.rememberLastLocation} onChange={checked => s.updateSettings({ rememberLastLocation: checked })}/></SettingGroup><SettingGroup title={t("settings.history")}><Toggle label={t("settings.rememberRecent")} checked={s.settings.rememberRecent} onChange={checked => s.updateSettings({ rememberRecent: checked })}/></SettingGroup></>}
      {tab === "performance" && <><h1>{t("settings.performance")}</h1><p className="settings-lead">{t("settings.performanceLead")}</p><SettingGroup title={t("settings.memory")}><select value={s.settings.memoryCacheMb} onChange={e => s.updateSettings({ memoryCacheMb: +e.target.value })}><option value="256">256 MB</option><option value="512">512 MB</option><option value="1024">1 GB</option><option value="2048">2 GB</option></select></SettingGroup><SettingGroup title={t("settings.thumbnailCache")}><div className="setting-stack">{cacheInfo && <p className="setting-hint">{t("settings.cacheUsage", { files: cacheInfo.files, size: formatBytes(cacheInfo.bytes) })}</p>}<button className="danger-button" disabled={clearingCache} onClick={() => void clearCache()}>{t(clearingCache ? "settings.clearingCache" : "settings.clearCache")}</button></div></SettingGroup></>}
      {tab === "about" && <div className="about"><div className="about-logo">zi</div><h1>zernia image</h1><p>{t("settings.aboutDescription")}</p><span>{t("settings.version")}</span><button className="support-button" onClick={() => void openUrl("https://buymeacoffee.com/zernia")}><ExternalLink/>{t("settings.support")}</button><small>{t("settings.privacy")}</small></div>}
    </main>
  </div></div>;
}

function SettingGroup({ title, children }: { title: string; children: React.ReactNode }) { return <section className="setting-group"><h3>{title}</h3>{children}</section>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange?: (checked: boolean) => void }) { return <label className="toggle-row"><span>{label}</span><input type="checkbox" checked={checked} onChange={event => onChange?.(event.target.checked)} readOnly={!onChange}/></label>; }
