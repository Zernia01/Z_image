import { create } from "zustand";
import type { AppSettings } from "../types/settings";
import { defaultSettings } from "../types/settings";
import type { ImageEntry, ImageMetadata, LibraryView, MoveResult, SortKey, ViewMode } from "../types/image";

interface AppState {
  folder: string | null;
  libraryView: LibraryView;
  images: ImageEntry[];
  selected: Set<string>;
  active: ImageEntry | null;
  metadata: ImageMetadata | null;
  loading: boolean;
  error: string | null;
  search: string;
  sortKey: SortKey;
  sortAscending: boolean;
  viewMode: ViewMode;
  detailsOpen: boolean;
  settingsOpen: boolean;
  settings: AppSettings;
  recentFolders: string[];
  recentImages: ImageEntry[];
  favoriteImages: ImageEntry[];
  generation: number;
  set: (patch: Partial<AppState>) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  openImage: (image: ImageEntry) => void;
  toggleFavorite: (image: ImageEntry) => void;
  showCollection: (view: "home" | "recent" | "favorites") => void;
  removeRecentFolder: (path: string) => void;
  removeFromCurrentCollection: (image: ImageEntry) => void;
  removePaths: (paths: string[]) => void;
  applyMoves: (moves: MoveResult[]) => void;
}

function loadJson<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? "") as T; } catch { return fallback; }
}

const savedSettings: AppSettings = { ...defaultSettings, ...loadJson<Partial<AppSettings>>("zernia.settings", {}) };
const recentFolders = loadJson<string[]>("zernia.recentFolders", []);
const recentImages = loadJson<ImageEntry[]>("zernia.recentImages", []);
const favoriteImages = loadJson<ImageEntry[]>("zernia.favoriteImages", []);
let recentImageTimer: ReturnType<typeof setTimeout> | undefined;

export const useAppStore = create<AppState>((set, get) => ({
  folder: null, libraryView: "home", images: [], selected: new Set(), active: null, metadata: null,
  loading: false, error: null, search: "", sortKey: "name", sortAscending: true,
  viewMode: "grid", detailsOpen: savedSettings.showDetails, settingsOpen: false,
  settings: savedSettings, recentFolders, recentImages, favoriteImages, generation: 0,
  set: (patch) => set(patch),
  updateSettings: (patch) => {
    const settings = { ...get().settings, ...patch };
    localStorage.setItem("zernia.settings", JSON.stringify(settings));
    if (patch.rememberRecent === false) {
      if (recentImageTimer) clearTimeout(recentImageTimer);
      localStorage.removeItem("zernia.recentFolders");
      localStorage.removeItem("zernia.recentImages");
      set({ settings, recentFolders: [], recentImages: [], images: get().libraryView === "recent" ? [] : get().images, selected: get().libraryView === "recent" ? new Set() : get().selected });
      return;
    }
    if (patch.rememberLastLocation === false) localStorage.removeItem("zernia.lastFolder");
    set({ settings });
  },
  openImage: (image) => {
    set({ active: image, selected: new Set([image.id]) });
    if (!get().settings.rememberRecent) {
      return;
    }
    if (recentImageTimer) clearTimeout(recentImageTimer);
    recentImageTimer = window.setTimeout(() => {
      const current = get().active;
      if (!current || !get().settings.rememberRecent) return;
      const recent = [current, ...get().recentImages.filter(item => item.path !== current.path)].slice(0, 100);
      set({ recentImages: recent });
      localStorage.setItem("zernia.recentImages", JSON.stringify(recent));
      recentImageTimer = undefined;
    }, 180);
  },
  toggleFavorite: (image) => {
    const current = get().favoriteImages;
    const favoriteImages = current.some(item => item.path === image.path)
      ? current.filter(item => item.path !== image.path)
      : [image, ...current];
    localStorage.setItem("zernia.favoriteImages", JSON.stringify(favoriteImages));
    set({ favoriteImages, images: get().libraryView === "favorites" ? favoriteImages : get().images });
  },
  showCollection: (view) => {
    const images = view === "recent" ? get().recentImages : view === "favorites" ? get().favoriteImages : [];
    set({ libraryView: view, folder: null, images, selected: new Set(), active: null, metadata: null, search: "" });
  },
  removeRecentFolder: (path) => {
    const recentFolders = get().recentFolders.filter(item => item !== path);
    localStorage.setItem("zernia.recentFolders", JSON.stringify(recentFolders));
    set({ recentFolders });
  },
  removeFromCurrentCollection: (image) => {
    const view = get().libraryView;
    if (view === "recent") {
      const recentImages = get().recentImages.filter(item => item.path !== image.path);
      localStorage.setItem("zernia.recentImages", JSON.stringify(recentImages));
      set({ recentImages, images: recentImages, selected: new Set(), metadata: null });
      return;
    }
    if (view === "favorites") {
      const favoriteImages = get().favoriteImages.filter(item => item.path !== image.path);
      localStorage.setItem("zernia.favoriteImages", JSON.stringify(favoriteImages));
      set({ favoriteImages, images: favoriteImages, selected: new Set(), metadata: null });
      return;
    }
    if (view === "dropped") {
      set({ images: get().images.filter(item => item.path !== image.path), selected: new Set(), metadata: null });
    }
  },
  removePaths: (paths) => {
    const removed = new Set(paths);
    const images = get().images.filter(item => !removed.has(item.path));
    const recent = get().recentImages.filter(item => !removed.has(item.path));
    const favorites = get().favoriteImages.filter(item => !removed.has(item.path));
    localStorage.setItem("zernia.recentImages", JSON.stringify(recent));
    localStorage.setItem("zernia.favoriteImages", JSON.stringify(favorites));
    set({ images, recentImages: recent, favoriteImages: favorites, selected: new Set(), metadata: null });
  },
  applyMoves: (moves) => {
    const moveMap = new Map(moves.map(move => [move.from, move.to]));
    const update = (items: ImageEntry[]) => items.map(item => {
      const path = moveMap.get(item.path);
      return path ? { ...item, id: path, path, filename: path.split(/[\\/]/).pop() ?? item.filename } : item;
    });
    const recent = update(get().recentImages);
    const favorites = update(get().favoriteImages);
    localStorage.setItem("zernia.recentImages", JSON.stringify(recent));
    localStorage.setItem("zernia.favoriteImages", JSON.stringify(favorites));
    set({ recentImages: recent, favoriteImages: favorites });
  }
}));
