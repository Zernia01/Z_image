import { isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import { storedLanguage, translate } from "../i18n";

export type UpdateCheckResult = "installed" | "available" | "current" | "unavailable";

let updateCheck: Promise<UpdateCheckResult> | null = null;

export function checkForUpdates(interactive: boolean): Promise<UpdateCheckResult> {
  if (!isTauri()) return Promise.resolve("unavailable");
  if (updateCheck) return updateCheck;
  updateCheck = runUpdateCheck(interactive).finally(() => { updateCheck = null; });
  return updateCheck;
}

async function runUpdateCheck(interactive: boolean): Promise<UpdateCheckResult> {
  const language = storedLanguage();
  try {
    const update = await check({ timeout: 15_000 });
    if (!update) {
      if (interactive) window.alert(translate(language, "update.current"));
      return "current";
    }
    const notes = update.body?.trim() ? `\n\n${update.body.trim()}` : "";
    const accepted = window.confirm(`${translate(language, "update.available", { version: update.version })}${notes}`);
    if (!accepted) { await update.close(); return "available"; }
    await update.downloadAndInstall(undefined, { restartAfterInstall: true });
    await relaunch();
    return "installed";
  } catch (error) {
    console.error("업데이트를 확인할 수 없습니다.", error);
    if (interactive) window.alert(translate(language, "update.error", { details: String(error) }));
    return "unavailable";
  }
}
