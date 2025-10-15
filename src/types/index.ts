export type TransparencyMode = 'full' | 'transparent' | 'island';
export type BackgroundMode = 'through' | 'backplate';

export interface AppState {
  image: HTMLImageElement | null;
  colorCount: number;
  colors: ColorLayer[];
  transparencyMode: TransparencyMode;
  backgroundMode: BackgroundMode;
  backplateColor: string;
  backplateThickness: number;
  outputWidth: number;
  outputHeight: number;
  outputDepth: number;
  displayFace: 'front' | 'back';
}

export interface ColorLayer {
  color: string;
  rgb: [number, number, number];
  height: number;
}

export interface ProcessedImage {
  width: number;
  height: number;
  layers: Map<string, ImageData>;
}
