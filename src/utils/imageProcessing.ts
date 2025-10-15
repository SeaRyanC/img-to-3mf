import type { TransparencyMode } from '../types';

export function preprocessImage(
  img: HTMLImageElement,
  mode: TransparencyMode
): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  
  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  if (mode === 'transparent') {
    imageData = applyCornerTransparency(imageData);
  } else if (mode === 'island') {
    imageData = applyIslandMode(imageData);
  }
  
  // Apply noise reduction
  imageData = removeNoise(imageData);
  
  return imageData;
}

function applyCornerTransparency(imageData: ImageData): ImageData {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  
  // Get the average color of the four corners
  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1]
  ];
  
  let sumR = 0, sumG = 0, sumB = 0;
  for (const [x, y] of corners) {
    const idx = (y * width + x) * 4;
    sumR += data[idx];
    sumG += data[idx + 1];
    sumB += data[idx + 2];
  }
  
  const keyR = Math.round(sumR / 4);
  const keyG = Math.round(sumG / 4);
  const keyB = Math.round(sumB / 4);
  
  // Make pixels similar to the key color transparent
  const threshold = 30;
  for (let i = 0; i < data.length; i += 4) {
    const dr = Math.abs(data[i] - keyR);
    const dg = Math.abs(data[i + 1] - keyG);
    const db = Math.abs(data[i + 2] - keyB);
    
    if (dr < threshold && dg < threshold && db < threshold) {
      data[i + 3] = 0;
    }
  }
  
  return imageData;
}

function applyIslandMode(imageData: ImageData): ImageData {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  
  // Flood fill from borders
  const visited = new Set<number>();
  const queue: Array<[number, number]> = [];
  
  // Get border pixel color (use top-left corner as reference)
  const keyR = data[0];
  const keyG = data[1];
  const keyB = data[2];
  
  // Add all border pixels to queue
  for (let x = 0; x < width; x++) {
    queue.push([x, 0]);
    queue.push([x, height - 1]);
  }
  for (let y = 1; y < height - 1; y++) {
    queue.push([0, y]);
    queue.push([width - 1, y]);
  }
  
  const threshold = 30;
  
  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    
    const idx = (y * width + x) * 4;
    const key = y * width + x;
    
    if (visited.has(key)) continue;
    visited.add(key);
    
    const dr = Math.abs(data[idx] - keyR);
    const dg = Math.abs(data[idx + 1] - keyG);
    const db = Math.abs(data[idx + 2] - keyB);
    
    if (dr < threshold && dg < threshold && db < threshold) {
      // Make transparent
      data[idx + 3] = 0;
      
      // Add neighbors
      queue.push([x + 1, y]);
      queue.push([x - 1, y]);
      queue.push([x, y + 1]);
      queue.push([x, y - 1]);
    }
  }
  
  return imageData;
}

function removeNoise(imageData: ImageData): ImageData {
  const data = new Uint8ClampedArray(imageData.data);
  const width = imageData.width;
  const height = imageData.height;
  
  // Simple median filter for noise reduction
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      
      // Skip transparent pixels
      if (imageData.data[idx + 3] < 128) continue;
      
      // Check if pixel is isolated (different from most neighbors)
      const neighbors: Array<[number, number, number]> = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nidx = ((y + dy) * width + (x + dx)) * 4;
          if (imageData.data[nidx + 3] >= 128) {
            neighbors.push([
              imageData.data[nidx],
              imageData.data[nidx + 1],
              imageData.data[nidx + 2]
            ]);
          }
        }
      }
      
      if (neighbors.length >= 5) {
        // Calculate average of neighbors
        const avgR = neighbors.reduce((sum, n) => sum + n[0], 0) / neighbors.length;
        const avgG = neighbors.reduce((sum, n) => sum + n[1], 0) / neighbors.length;
        const avgB = neighbors.reduce((sum, n) => sum + n[2], 0) / neighbors.length;
        
        const dr = Math.abs(imageData.data[idx] - avgR);
        const dg = Math.abs(imageData.data[idx + 1] - avgG);
        const db = Math.abs(imageData.data[idx + 2] - avgB);
        
        // If very different from neighbors, replace with average
        if (dr + dg + db > 150) {
          data[idx] = Math.round(avgR);
          data[idx + 1] = Math.round(avgG);
          data[idx + 2] = Math.round(avgB);
        }
      }
    }
  }
  
  return new ImageData(data, width, height);
}
