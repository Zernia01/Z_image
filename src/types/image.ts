export type ThumbnailState = "idle" | "loading" | "ready" | "error";

export interface ImageEntry {
  id: string;
  path: string;
  filename: string;
  extension: string;
  size: number;
  width?: number;
  height?: number;
  createdAt?: number;
  modifiedAt?: number;
  thumbnailState: ThumbnailState;
}

export interface ImageMetadata {
  path: string;
  filename: string;
  extension: string;
  mimeType?: string;
  size: number;
  createdAt?: number;
  modifiedAt?: number;
  width?: number;
  height?: number;
  colorType?: string;
  cameraMake?: string;
  cameraModel?: string;
  lensModel?: string;
  capturedAt?: string;
  iso?: string;
  exposure?: string;
  aperture?: string;
  focalLength?: string;
}

export type SortKey = "name" | "modified" | "created" | "size" | "extension";
export type ViewMode = "grid" | "list";
export type LibraryView = "home" | "folder" | "recent" | "favorites" | "dropped";

export interface MoveResult {
  from: string;
  to: string;
}

export interface FileBatchResult<T> {
  succeeded: T[];
  failed: string[];
}

export interface DropResult {
  folder?: string;
  images: ImageEntry[];
  activePath?: string;
}

export interface AnimationFrameInfo {
  path: string;
  delayMs: number;
}

export interface AnimationInfo {
  format: string;
  loopCount: number | null;
  frames: AnimationFrameInfo[];
}
