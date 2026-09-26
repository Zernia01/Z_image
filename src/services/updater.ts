import { isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";

export type UpdateCheckResult = "installed" | "available" | "current" | "unavailable";

let updateCheck: Promise<UpdateCheckResult> | null = null;

export function checkForUpdates(interactive: boolean): Promise<UpdateCheckResult> {
  if (!isTauri()) return Promise.resolve("unavailable");
  if (updateCheck) return updateCheck;
  updateCheck = runUpdateCheck(interactive).finally(() => { updateCheck = null; });
  return updateCheck;
}

async function runUpdateCheck(interactive: boolean): Promise<UpdateCheckResult> {
  try {
    const update = await check({ timeout: 15_000 });
    if (!update) {
      if (interactive) window.alert("현재 최신 버전을 사용하고 있습니다.");
      return "current";
    }
    const notes = update.body?.trim() ? `\n\n${update.body.trim()}` : "";
    const accepted = window.confirm(`새 버전 ${update.version}을 사용할 수 있습니다.\n지금 다운로드하고 설치할까요?${notes}`);
    if (!accepted) { await update.close(); return "available"; }
    await update.downloadAndInstall(undefined, { restartAfterInstall: true });
    await relaunch();
    return "installed";
  } catch (error) {
    console.error("업데이트를 확인할 수 없습니다.", error);
    if (interactive) window.alert(`업데이트를 확인할 수 없습니다.\n${String(error)}`);
    return "unavailable";
  }
}
