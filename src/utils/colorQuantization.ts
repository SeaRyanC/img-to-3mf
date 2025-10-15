// Simple k-means color quantization
export function quantizeColors(imageData: ImageData, maxColors: number): Array<[number, number, number]> {
  const pixels: Array<[number, number, number]> = [];
  
  // Sample pixels (use every 4th pixel for performance)
  for (let i = 0; i < imageData.data.length; i += 16) {
    const r = imageData.data[i];
    const g = imageData.data[i + 1];
    const b = imageData.data[i + 2];
    const a = imageData.data[i + 3];
    
    // Skip fully transparent pixels
    if (a < 128) continue;
    
    pixels.push([r, g, b]);
  }
  
  if (pixels.length === 0) return [];
  
  // Simple k-means clustering
  let centroids: Array<[number, number, number]> = [];
  
  // Initialize centroids with random pixels
  const step = Math.floor(pixels.length / Math.min(maxColors, pixels.length));
  for (let i = 0; i < Math.min(maxColors, pixels.length); i++) {
    centroids.push([...pixels[i * step]]);
  }
  
  // Iterate k-means
  for (let iter = 0; iter < 10; iter++) {
    const clusters: Array<Array<[number, number, number]>> = Array(centroids.length).fill(null).map(() => []);
    
    // Assign pixels to nearest centroid
    for (const pixel of pixels) {
      let minDist = Infinity;
      let closestIdx = 0;
      
      for (let i = 0; i < centroids.length; i++) {
        const dist = colorDistance(pixel, centroids[i]);
        if (dist < minDist) {
          minDist = dist;
          closestIdx = i;
        }
      }
      
      clusters[closestIdx].push(pixel);
    }
    
    // Update centroids
    for (let i = 0; i < centroids.length; i++) {
      if (clusters[i].length > 0) {
        const sumR = clusters[i].reduce((sum, p) => sum + p[0], 0);
        const sumG = clusters[i].reduce((sum, p) => sum + p[1], 0);
        const sumB = clusters[i].reduce((sum, p) => sum + p[2], 0);
        centroids[i] = [
          Math.round(sumR / clusters[i].length),
          Math.round(sumG / clusters[i].length),
          Math.round(sumB / clusters[i].length)
        ];
      }
    }
  }
  
  // Filter out empty clusters and sort by frequency
  const nonEmptyCentroids: Array<[number, number, number, number]> = [];
  for (let i = 0; i < centroids.length; i++) {
    const count = pixels.filter(p => {
      let minDist = Infinity;
      let closestIdx = 0;
      for (let j = 0; j < centroids.length; j++) {
        const dist = colorDistance(p, centroids[j]);
        if (dist < minDist) {
          minDist = dist;
          closestIdx = j;
        }
      }
      return closestIdx === i;
    }).length;
    
    if (count > 0) {
      nonEmptyCentroids.push([centroids[i][0], centroids[i][1], centroids[i][2], count]);
    }
  }
  
  // Sort by frequency (most common first) and return only RGB
  nonEmptyCentroids.sort((a, b) => b[3] - a[3]);
  return nonEmptyCentroids.map(c => [c[0], c[1], c[2]]);
}

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

export function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [0, 0, 0];
}
