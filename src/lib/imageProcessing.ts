import type { ImageData2D } from '../types';

/**
 * Load image from File and convert to ImageData2D
 */
export async function loadImage(file: File): Promise<ImageData2D> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        resolve({
          width: img.width,
          height: img.height,
          data: imageData.data,
        });
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Load image from clipboard paste event
 */
export async function loadImageFromClipboard(event: ClipboardEvent): Promise<ImageData2D | null> {
  const items = event.clipboardData?.items;
  if (!items) return null;

  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      const file = items[i].getAsFile();
      if (file) {
        return loadImage(file);
      }
    }
  }
  return null;
}

/**
 * Calculate color distance (Euclidean in RGB space)
 */
function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.sqrt((r2 - r1) ** 2 + (g2 - g1) ** 2 + (b2 - b1) ** 2);
}

/**
 * Quantize image to max N colors using a simple binning approach
 */
export function quantizeColors(imageData: ImageData2D, maxColors: number): {
  quantized: ImageData2D;
  palette: Array<[number, number, number]>;
} {
  const { width, height, data } = imageData;
  const pixelCount = width * height;
  
  // Build color histogram
  const colorMap = new Map<string, { r: number; g: number; b: number; count: number }>();
  
  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];
    
    // Skip fully transparent pixels
    if (a === 0) continue;
    
    const key = `${r},${g},${b}`;
    if (colorMap.has(key)) {
      colorMap.get(key)!.count++;
    } else {
      colorMap.set(key, { r, g, b, count: 1 });
    }
  }
  
  // Get most common colors
  const colors = Array.from(colorMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, maxColors);
  
  const palette: Array<[number, number, number]> = colors.map(c => [c.r, c.g, c.b]);
  
  // Create quantized image by mapping each pixel to nearest palette color
  const quantizedData = new Uint8ClampedArray(data.length);
  
  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];
    
    if (a === 0) {
      // Preserve transparency
      quantizedData[idx] = 0;
      quantizedData[idx + 1] = 0;
      quantizedData[idx + 2] = 0;
      quantizedData[idx + 3] = 0;
      continue;
    }
    
    // Find nearest color in palette
    let minDist = Infinity;
    let bestColor = palette[0];
    
    for (const color of palette) {
      const dist = colorDistance(r, g, b, color[0], color[1], color[2]);
      if (dist < minDist) {
        minDist = dist;
        bestColor = color;
      }
    }
    
    quantizedData[idx] = bestColor[0];
    quantizedData[idx + 1] = bestColor[1];
    quantizedData[idx + 2] = bestColor[2];
    quantizedData[idx + 3] = 255;
  }
  
  return {
    quantized: { width, height, data: quantizedData },
    palette,
  };
}

/**
 * Apply 3x3 median filter to remove noise
 */
export function medianFilter(imageData: ImageData2D): ImageData2D {
  const { width, height, data } = imageData;
  const filtered = new Uint8ClampedArray(data.length);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      
      // Skip transparent pixels
      if (data[idx + 3] === 0) {
        filtered[idx] = 0;
        filtered[idx + 1] = 0;
        filtered[idx + 2] = 0;
        filtered[idx + 3] = 0;
        continue;
      }
      
      // Collect 3x3 neighborhood
      const rValues: number[] = [];
      const gValues: number[] = [];
      const bValues: number[] = [];
      
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIdx = (ny * width + nx) * 4;
            if (data[nIdx + 3] > 0) {
              rValues.push(data[nIdx]);
              gValues.push(data[nIdx + 1]);
              bValues.push(data[nIdx + 2]);
            }
          }
        }
      }
      
      if (rValues.length === 0) {
        filtered[idx] = data[idx];
        filtered[idx + 1] = data[idx + 1];
        filtered[idx + 2] = data[idx + 2];
        filtered[idx + 3] = data[idx + 3];
      } else {
        rValues.sort((a, b) => a - b);
        gValues.sort((a, b) => a - b);
        bValues.sort((a, b) => a - b);
        
        const medianIdx = Math.floor(rValues.length / 2);
        filtered[idx] = rValues[medianIdx];
        filtered[idx + 1] = gValues[medianIdx];
        filtered[idx + 2] = bValues[medianIdx];
        filtered[idx + 3] = 255;
      }
    }
  }
  
  return { width, height, data: filtered };
}

/**
 * Remove isolated pixels (pixels with no neighbors of same color)
 */
export function removeIsolatedPixels(imageData: ImageData2D): ImageData2D {
  const { width, height, data } = imageData;
  const cleaned = new Uint8ClampedArray(data);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      
      if (data[idx + 3] === 0) continue;
      
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      
      // Check 8 neighbors
      let sameColorCount = 0;
      const neighborColors: Array<[number, number, number]> = [];
      
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          
          const nx = x + dx;
          const ny = y + dy;
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIdx = (ny * width + nx) * 4;
            const nr = data[nIdx];
            const ng = data[nIdx + 1];
            const nb = data[nIdx + 2];
            
            if (data[nIdx + 3] > 0) {
              if (nr === r && ng === g && nb === b) {
                sameColorCount++;
              }
              neighborColors.push([nr, ng, nb]);
            }
          }
        }
      }
      
      // If no neighbors with same color, replace with majority neighbor color
      if (sameColorCount === 0 && neighborColors.length > 0) {
        const colorCounts = new Map<string, { color: [number, number, number]; count: number }>();
        
        for (const color of neighborColors) {
          const key = color.join(',');
          if (colorCounts.has(key)) {
            colorCounts.get(key)!.count++;
          } else {
            colorCounts.set(key, { color, count: 1 });
          }
        }
        
        let maxCount = 0;
        let majorityColor = neighborColors[0];
        
        for (const { color, count } of colorCounts.values()) {
          if (count > maxCount) {
            maxCount = count;
            majorityColor = color;
          }
        }
        
        cleaned[idx] = majorityColor[0];
        cleaned[idx + 1] = majorityColor[1];
        cleaned[idx + 2] = majorityColor[2];
      }
    }
  }
  
  return { width, height, data: cleaned };
}

/**
 * Apply transparency mode to image
 */
export function applyTransparencyMode(
  imageData: ImageData2D,
  mode: 'full' | 'transparent' | 'island'
): ImageData2D {
  if (mode === 'full') {
    return imageData;
  }
  
  const { width, height, data } = imageData;
  const result = new Uint8ClampedArray(data);
  
  if (mode === 'transparent') {
    // Use corner colors as transparency key
    const corners = [
      [0, 0],
      [width - 1, 0],
      [0, height - 1],
      [width - 1, height - 1],
    ];
    
    const keyColors = corners.map(([x, y]) => {
      const idx = (y * width + x) * 4;
      return [data[idx], data[idx + 1], data[idx + 2]];
    });
    
    // Find most common corner color
    const colorMap = new Map<string, number>();
    for (const color of keyColors) {
      const key = color.join(',');
      colorMap.set(key, (colorMap.get(key) || 0) + 1);
    }
    
    let maxCount = 0;
    let keyColor = keyColors[0];
    for (const [key, count] of colorMap.entries()) {
      if (count > maxCount) {
        maxCount = count;
        keyColor = key.split(',').map(Number);
      }
    }
    
    // Make pixels matching key color transparent
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      if (
        data[idx] === keyColor[0] &&
        data[idx + 1] === keyColor[1] &&
        data[idx + 2] === keyColor[2]
      ) {
        result[idx + 3] = 0;
      }
    }
  } else if (mode === 'island') {
    // Flood fill from borders with transparency
    const visited = new Uint8Array(width * height);
    const queue: Array<[number, number]> = [];
    
    // Start from all border pixels
    for (let x = 0; x < width; x++) {
      queue.push([x, 0]);
      queue.push([x, height - 1]);
    }
    for (let y = 1; y < height - 1; y++) {
      queue.push([0, y]);
      queue.push([width - 1, y]);
    }
    
    // Get background color from first border pixel
    const bgIdx = 0;
    const bgR = data[bgIdx];
    const bgG = data[bgIdx + 1];
    const bgB = data[bgIdx + 2];
    
    // Flood fill
    while (queue.length > 0) {
      const [x, y] = queue.shift()!;
      const idx = y * width + x;
      
      if (visited[idx]) continue;
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      
      const dataIdx = idx * 4;
      const r = data[dataIdx];
      const g = data[dataIdx + 1];
      const b = data[dataIdx + 2];
      
      // Check if color is similar to background
      const dist = colorDistance(r, g, b, bgR, bgG, bgB);
      if (dist > 30) continue; // Threshold for similar colors
      
      visited[idx] = 1;
      result[dataIdx + 3] = 0; // Make transparent
      
      // Add neighbors
      queue.push([x + 1, y]);
      queue.push([x - 1, y]);
      queue.push([x, y + 1]);
      queue.push([x, y - 1]);
    }
  }
  
  return { width, height, data: result };
}

/**
 * Full preprocessing pipeline
 */
export function preprocessImage(
  imageData: ImageData2D,
  maxColors: number,
  transparencyMode: 'full' | 'transparent' | 'island'
): { quantized: ImageData2D; palette: Array<[number, number, number]> } {
  // Apply transparency mode first
  let processed = applyTransparencyMode(imageData, transparencyMode);
  
  // Apply median filter
  processed = medianFilter(processed);
  
  // Remove isolated pixels
  processed = removeIsolatedPixels(processed);
  
  // Quantize colors
  const { quantized, palette } = quantizeColors(processed, maxColors);
  
  return { quantized, palette };
}
