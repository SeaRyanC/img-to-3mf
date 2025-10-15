import type { ColorLayer } from '../types';

export function generateColorLayers(
  imageData: ImageData,
  colors: ColorLayer[]
): Map<string, ImageData> {
  const layers = new Map<string, ImageData>();
  
  for (const colorLayer of colors) {
    const layerData = new ImageData(imageData.width, imageData.height);
    
    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      const a = imageData.data[i + 3];
      
      if (a < 128) {
        // Transparent pixel
        layerData.data[i] = 0;
        layerData.data[i + 1] = 0;
        layerData.data[i + 2] = 0;
        layerData.data[i + 3] = 0;
        continue;
      }
      
      // Find closest color
      let minDist = Infinity;
      let closestColor: ColorLayer | null = null;
      
      for (const cl of colors) {
        const dr = r - cl.rgb[0];
        const dg = g - cl.rgb[1];
        const db = b - cl.rgb[2];
        const dist = dr * dr + dg * dg + db * db;
        
        if (dist < minDist) {
          minDist = dist;
          closestColor = cl;
        }
      }
      
      if (closestColor === colorLayer) {
        // This pixel belongs to this layer - make it white
        layerData.data[i] = 255;
        layerData.data[i + 1] = 255;
        layerData.data[i + 2] = 255;
        layerData.data[i + 3] = 255;
      } else {
        // This pixel belongs to another layer - make it black
        layerData.data[i] = 0;
        layerData.data[i + 1] = 0;
        layerData.data[i + 2] = 0;
        layerData.data[i + 3] = 255;
      }
    }
    
    layers.set(colorLayer.color, layerData);
  }
  
  return layers;
}

export function imageDataToPNG(imageData: ImageData): Promise<Blob> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(imageData, 0, 0);
    canvas.toBlob((blob) => resolve(blob!), 'image/png');
  });
}
