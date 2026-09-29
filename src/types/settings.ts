export type Theme = "system" | "light" | "dark";
export type Language = "ko" | "en" | "ja" | "zh-CN" | "zh-TW" | "ko-Hani";

export interface AppSettings {
  theme: Theme;
  language: Language;
  thumbnailSize: number;
  showDetails: boolean;
  showGps: boolean;
  animations: boolean;
  preload: number;
  memoryCacheMb: number;
  rememberRecent: boolean;
  rememberLastLocation: boolean;
  openImagesImmersive: boolean;
  showImmersiveInfo: boolean;
  loopNavigation: boolean;
  automaticUpdates: boolean;
}

export const defaultSettings: AppSettings = {
  theme: "system",
  language: "ko",
  thumbnailSize: 180,
  showDetails: true,
  showGps: false,
  animations: true,
  preload: 2,
  memoryCacheMb: 512,
  rememberRecent: true,
  rememberLastLocation: true,
  openImagesImmersive: false,
  showImmersiveInfo: false,
  loopNavigation: false,
  automaticUpdates: true
};
