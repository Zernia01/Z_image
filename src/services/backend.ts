import { convertFileSrc, isTauri } from "@tauri-apps/api/core";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { AnimationInfo, DropResult, FileBatchResult, ImageEntry, ImageMetadata, MoveResult } from "../types/image";
import { storedLanguage, translate } from "../i18n";

export async function chooseFolder(): Promise<string | null> {
  if (!isTauri()) return null;
  const selected = await open({ directory: true, multiple: false, title: translate(storedLanguage(), "dialog.chooseFolder") });
  return typeof selected === "string" ? selected : null;
}

export async function chooseDestinationFolder(): Promise<string | null> {
  if (!isTauri()) return null;
  const selected = await open({ directory: true, multiple: false, title: translate(storedLanguage(), "dialog.chooseDestination") });
  return typeof selected === "string" ? selected : null;
}

export async function scanFolder(path: string, generation: number): Promise<ImageEntry[]> {
  return invoke<ImageEntry[]>("scan_folder", { path, generation });
}

export async function loadMetadata(path: string): Promise<ImageMetadata> {
  return invoke<ImageMetadata>("read_metadata", { path });
}

export async function thumbnailUrl(path: string, size: number): Promise<string> {
  const cached = await invoke<string>("get_thumbnail", { path, size });
  return convertFileSrc(cached);
}

export async function cachedThumbnailUrl(path: string, size: number): Promise<string | null> {
  const cached = await invoke<string | null>("get_cached_thumbnail", { path, size });
  return cached ? convertFileSrc(cached) : null;
}

export function originalUrl(path: string): string {
  return convertFileSrc(path);
}

export async function displayImageUrl(path: string): Promise<string> {
  const prepared = await invoke<string>("get_display_image", { path });
  return convertFileSrc(prepared);
}

export async function loadAnimation(path: string): Promise<AnimationInfo | null> {
  const animation = await invoke<AnimationInfo | null>("decode_animation", { path });
  return animation ? { ...animation, frames: animation.frames.map(frame => ({ ...frame, path: convertFileSrc(frame.path) })) } : null;
}

export async function cacheStats(): Promise<{ bytes: number; files: number }> {
  return invoke("cache_stats");
}

export async function clearAppCache(): Promise<void> {
  await invoke("clear_thumbnail_cache");
}

export async function openDefaultAppsSettings(): Promise<void> {
  await invoke("open_default_apps_settings");
}

export async function getLaunchPaths(): Promise<string[]> {
  return invoke<string[]>("get_launch_paths");
}

export async function setNativeFullscreen(enabled: boolean): Promise<void> {
  await invoke("set_native_fullscreen", { enabled });
}

export async function moveFiles(paths: string[], destination: string): Promise<FileBatchResult<MoveResult>> {
  return invoke("move_files", { paths, destination });
}

export async function moveFilesToTrash(paths: string[]): Promise<FileBatchResult<string>> {
  return invoke("move_files_to_trash", { paths });
}

export async function resolveDroppedPaths(paths: string[]): Promise<DropResult> {
  return invoke("resolve_dropped_paths", { paths });
}
