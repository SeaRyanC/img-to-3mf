export interface ColorLayer {
  color: [number, number, number]; // RGB
  height: number; // in mm
  mesh?: Mesh;
}

export interface Mesh {
  vertices: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

export interface ProcessingOptions {
  maxColors: number;
  width: number; // mm
  height: number; // mm
  scale: number;
  displayFace: 'front' | 'back';
  transparencyMode: 'full' | 'transparent' | 'island';
  colorLayers: ColorLayer[];
}

export interface ImageData2D {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}
