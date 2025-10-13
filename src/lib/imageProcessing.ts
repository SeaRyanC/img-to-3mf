/**
 * Image processing utilities for converting images to 3MF files
 */

export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface ImageData2D {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/**
 * Load image from file or URL
 */
export async function loadImage(source: File | string): Promise<ImageData2D> {
  return new Promise((resolve, reject) => {
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
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      resolve({
        width: imageData.width,
        height: imageData.height,
        data: imageData.data,
      });
    };
    img.onerror = reject;
    
    if (source instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(source);
    } else {
      img.src = source;
    }
  });
}

/**
 * Apply median filter to reduce JPEG noise
 */
export function medianFilter(imageData: ImageData2D): ImageData2D {
  const { width, height, data } = imageData;
  const result = new Uint8ClampedArray(data.length);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      
      // Collect neighbor values for each channel
      const rValues: number[] = [];
      const gValues: number[] = [];
      const bValues: number[] = [];
      const aValues: number[] = [];
      
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = Math.max(0, Math.min(width - 1, x + dx));
          const ny = Math.max(0, Math.min(height - 1, y + dy));
          const nIdx = (ny * width + nx) * 4;
          
          rValues.push(data[nIdx]);
          gValues.push(data[nIdx + 1]);
          bValues.push(data[nIdx + 2]);
          aValues.push(data[nIdx + 3]);
        }
      }
      
      // Get median of each channel
      result[idx] = median(rValues);
      result[idx + 1] = median(gValues);
      result[idx + 2] = median(bValues);
      result[idx + 3] = median(aValues);
    }
  }
  
  return { width, height, data: result };
}

function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted[mid];
}

/**
 * Remove isolated pixels (noise)
 */
export function removeIsolatedPixels(imageData: ImageData2D, colorMap: number[][]): number[][] {
  const { width, height } = imageData;
  const result: number[][] = colorMap.map(row => [...row]);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = colorMap[y][x];
      
      // Check if any of the 8 neighbors share this color
      let hasNeighbor = false;
      const neighborColors: number[] = [];
      
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          
          const nx = x + dx;
          const ny = y + dy;
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const neighborColor = colorMap[ny][nx];
            neighborColors.push(neighborColor);
            if (neighborColor === color) {
              hasNeighbor = true;
            }
          }
        }
      }
      
      // If isolated, replace with majority neighbor color
      if (!hasNeighbor && neighborColors.length > 0) {
        result[y][x] = majorityColor(neighborColors);
      }
    }
  }
  
  return result;
}

function majorityColor(colors: number[]): number {
  const counts = new Map<number, number>();
  for (const color of colors) {
    counts.set(color, (counts.get(color) || 0) + 1);
  }
  
  let maxCount = 0;
  let majorityColor = colors[0];
  for (const [color, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      majorityColor = color;
    }
  }
  
  return majorityColor;
}

/**
 * Quantize image to a maximum number of colors
 */
export function quantizeColors(
  imageData: ImageData2D,
  maxColors: number
): { colorMap: number[][]; palette: Color[] } {
  const { width, height, data } = imageData;
  
  // Collect all unique colors
  const colorSet = new Set<string>();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    colorSet.add(`${r},${g},${b},${a}`);
  }
  
  // Convert to palette
  let palette: Color[] = Array.from(colorSet).map(colorStr => {
    const [r, g, b, a] = colorStr.split(',').map(Number);
    return { r, g, b, a };
  });
  
  // If we have more colors than maxColors, perform k-means clustering
  if (palette.length > maxColors) {
    palette = kMeansClustering(palette, maxColors);
  }
  
  // Create color map
  const colorMap: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const color = {
        r: data[idx],
        g: data[idx + 1],
        b: data[idx + 2],
        a: data[idx + 3],
      };
      
      // Find nearest palette color
      const colorIndex = findNearestColor(color, palette);
      row.push(colorIndex);
    }
    colorMap.push(row);
  }
  
  return { colorMap, palette };
}

function kMeansClustering(colors: Color[], k: number): Color[] {
  // Initialize centroids randomly
  const centroids: Color[] = [];
  const step = Math.floor(colors.length / k);
  for (let i = 0; i < k && i * step < colors.length; i++) {
    centroids.push({ ...colors[i * step] });
  }
  
  // Iterate k-means
  for (let iter = 0; iter < 10; iter++) {
    const clusters: Color[][] = Array.from({ length: k }, () => []);
    
    // Assign colors to nearest centroid
    for (const color of colors) {
      const nearest = findNearestColor(color, centroids);
      clusters[nearest].push(color);
    }
    
    // Update centroids
    for (let i = 0; i < k; i++) {
      if (clusters[i].length > 0) {
        const sum = clusters[i].reduce(
          (acc, c) => ({
            r: acc.r + c.r,
            g: acc.g + c.g,
            b: acc.b + c.b,
            a: acc.a + c.a,
          }),
          { r: 0, g: 0, b: 0, a: 0 }
        );
        const count = clusters[i].length;
        centroids[i] = {
          r: Math.round(sum.r / count),
          g: Math.round(sum.g / count),
          b: Math.round(sum.b / count),
          a: Math.round(sum.a / count),
        };
      }
    }
  }
  
  return centroids;
}

function findNearestColor(color: Color, palette: Color[]): number {
  let minDistance = Infinity;
  let nearestIndex = 0;
  
  for (let i = 0; i < palette.length; i++) {
    const distance = colorDistance(color, palette[i]);
    if (distance < minDistance) {
      minDistance = distance;
      nearestIndex = i;
    }
  }
  
  return nearestIndex;
}

function colorDistance(c1: Color, c2: Color): number {
  const dr = c1.r - c2.r;
  const dg = c1.g - c2.g;
  const db = c1.b - c2.b;
  const da = c1.a - c2.a;
  return Math.sqrt(dr * dr + dg * dg + db * db + da * da);
}

/**
 * Handle transparency based on mode
 */
export function handleTransparency(
  imageData: ImageData2D,
  mode: 'full' | 'transparent' | 'island'
): ImageData2D {
  const { width, height, data } = imageData;
  const result = new Uint8ClampedArray(data);
  
  if (mode === 'transparent') {
    // Use corner colors as transparency key
    const cornerColors = [
      getPixelColor(data, 0, 0, width),
      getPixelColor(data, width - 1, 0, width),
      getPixelColor(data, 0, height - 1, width),
      getPixelColor(data, width - 1, height - 1, width),
    ];
    const keyColor = averageColor(cornerColors);
    
    // Make similar colors transparent
    for (let i = 0; i < data.length; i += 4) {
      const color = { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
      if (colorDistance(color, keyColor) < 30) {
        result[i + 3] = 0; // Set alpha to 0
      }
    }
  } else if (mode === 'island') {
    // Flood fill from borders with transparency
    const visited = new Set<string>();
    const queue: [number, number][] = [];
    
    // Add border pixels to queue
    for (let x = 0; x < width; x++) {
      queue.push([x, 0]);
      queue.push([x, height - 1]);
    }
    for (let y = 1; y < height - 1; y++) {
      queue.push([0, y]);
      queue.push([width - 1, y]);
    }
    
    // Flood fill
    while (queue.length > 0) {
      const [x, y] = queue.shift()!;
      const key = `${x},${y}`;
      
      if (visited.has(key)) continue;
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      
      visited.add(key);
      const idx = (y * width + x) * 4;
      
      // Get the reference color from the first border pixel
      const refColor = getPixelColor(data, 0, 0, width);
      const currentColor = getPixelColor(data, x, y, width);
      
      // If this pixel is similar to border color, make it transparent and continue flood fill
      if (colorDistance(currentColor, refColor) < 30) {
        result[idx + 3] = 0;
        
        // Add neighbors
        queue.push([x + 1, y]);
        queue.push([x - 1, y]);
        queue.push([x, y + 1]);
        queue.push([x, y - 1]);
      }
    }
  }
  
  return { width, height, data: result };
}

function getPixelColor(data: Uint8ClampedArray, x: number, y: number, width: number): Color {
  const idx = (y * width + x) * 4;
  return {
    r: data[idx],
    g: data[idx + 1],
    b: data[idx + 2],
    a: data[idx + 3],
  };
}

function averageColor(colors: Color[]): Color {
  const sum = colors.reduce(
    (acc, c) => ({
      r: acc.r + c.r,
      g: acc.g + c.g,
      b: acc.b + c.b,
      a: acc.a + c.a,
    }),
    { r: 0, g: 0, b: 0, a: 0 }
  );
  const count = colors.length;
  return {
    r: Math.round(sum.r / count),
    g: Math.round(sum.g / count),
    b: Math.round(sum.b / count),
    a: Math.round(sum.a / count),
  };
}
