import { Jimp } from 'jimp';
import { intToRGBA, rgbaToInt } from '@jimp/utils';
import { hexToRgb, rgbToHex, colorDistance, findNearestBambuColor } from './colors';

export interface ImageInfo {
  width: number;
  height: number;
  colors: Map<string, number>; // hex color -> pixel count
}

export interface ProcessedImage {
  width: number;
  height: number;
  pixelColors: string[][]; // 2D array of hex colors
  modalColors: string[]; // Top 16 modal colors
  backgroundMask: boolean[][]; // True for transparent/background pixels
}

const COLOR_SIMILARITY_THRESHOLD = 30; // RGB distance threshold for considering colors identical

export async function loadImage(filepath: string): Promise<any> {
  return await Jimp.read(filepath);
}

export async function analyzeImage(filepath: string): Promise<ImageInfo> {
  const image = await loadImage(filepath);
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  const colorCounts = new Map<string, number>();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = intToRGBA(image.getPixelColor(x, y));
      const hex = rgbToHex(pixel.r, pixel.g, pixel.b);
      colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
    }
  }

  return { width, height, colors: colorCounts };
}

// Cluster similar colors together
function clusterColors(colorCounts: Map<string, number>): Map<string, number> {
  const clustered = new Map<string, number>();
  const processed = new Set<string>();

  const sortedColors = Array.from(colorCounts.entries()).sort((a, b) => b[1] - a[1]);

  for (const [color, count] of sortedColors) {
    if (processed.has(color)) continue;

    const rgb = hexToRgb(color);
    let clusterColor = color;
    let clusterCount = count;

    // Find similar colors and merge them
    for (const [otherColor, otherCount] of colorCounts.entries()) {
      if (processed.has(otherColor) || otherColor === color) continue;

      const otherRgb = hexToRgb(otherColor);
      if (colorDistance(rgb, otherRgb) <= COLOR_SIMILARITY_THRESHOLD) {
        clusterCount += otherCount;
        processed.add(otherColor);
      }
    }

    clustered.set(clusterColor, clusterCount);
    processed.add(color);
  }

  return clustered;
}

// Flood fill from the edges to find background
function floodFillBackground(
  image: any,
  colorMap: Map<string, string>
): boolean[][] {
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  const visited = Array.from({ length: height }, () => Array(width).fill(false));
  const background = Array.from({ length: height }, () => Array(width).fill(false));

  const queue: [number, number][] = [];

  // Start flood fill from ALL edges of the image
  // This ensures we capture background pixels that touch any edge
  
  // Top and bottom edges
  for (let x = 0; x < width; x++) {
    queue.push([x, 0]); // Top edge
    queue.push([x, height - 1]); // Bottom edge
  }
  
  // Left and right edges (excluding corners already added)
  for (let y = 1; y < height - 1; y++) {
    queue.push([0, y]); // Left edge
    queue.push([width - 1, y]); // Right edge
  }

  while (queue.length > 0) {
    const [x, y] = queue.shift()!;

    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    if (visited[y][x]) continue;

    visited[y][x] = true;

    const pixel = intToRGBA(image.getPixelColor(x, y));
    const hex = rgbToHex(pixel.r, pixel.g, pixel.b);
    const clusterColor = colorMap.get(hex) || hex;

    // Mark as background - we'll flood fill from each edge pixel
    // If it's a background color, continue flooding
    background[y][x] = true;

    // Add neighbors to queue to continue flood fill
    // Only add if they're the same or similar color (background continuation)
    const checkAndAdd = (nx: number, ny: number) => {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) return;
      if (visited[ny][nx]) return;
      
      const neighborPixel = intToRGBA(image.getPixelColor(nx, ny));
      const neighborHex = rgbToHex(neighborPixel.r, neighborPixel.g, neighborPixel.b);
      const neighborCluster = colorMap.get(neighborHex) || neighborHex;
      
      // Only continue flooding if the neighbor is the same/similar color
      if (neighborCluster === clusterColor || 
          colorDistance(hexToRgb(neighborCluster), hexToRgb(clusterColor)) <= COLOR_SIMILARITY_THRESHOLD) {
        queue.push([nx, ny]);
      }
    };

    checkAndAdd(x + 1, y);
    checkAndAdd(x - 1, y);
    checkAndAdd(x, y + 1);
    checkAndAdd(x, y - 1);
  }

  return background;
}

export async function processImage(filepath: string): Promise<ProcessedImage> {
  const image = await loadImage(filepath);
  const width = image.bitmap.width;
  const height = image.bitmap.height;

  // Step 1: Collect all colors
  const colorCounts = new Map<string, number>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = intToRGBA(image.getPixelColor(x, y));
      const hex = rgbToHex(pixel.r, pixel.g, pixel.b);
      colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
    }
  }

  // Step 2: Cluster similar colors
  const clusteredColors = clusterColors(colorCounts);

  // Step 3: Find top 16 modal colors (excluding background)
  const sortedColors = Array.from(clusteredColors.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([color]) => color);

  // Step 4: Create a mapping from all colors to their cluster representative
  const colorMap = new Map<string, string>();
  for (const [color] of colorCounts.entries()) {
    const rgb = hexToRgb(color);
    let bestMatch = sortedColors[0];
    let minDist = colorDistance(rgb, hexToRgb(bestMatch));

    for (const clusterColor of sortedColors) {
      const dist = colorDistance(rgb, hexToRgb(clusterColor));
      if (dist < minDist) {
        minDist = dist;
        bestMatch = clusterColor;
      }
    }
    colorMap.set(color, bestMatch);
  }

  // Step 5: Detect background using flood fill
  const backgroundMask = floodFillBackground(image, colorMap);

  // Step 6: Get modal colors excluding background
  const foregroundCounts = new Map<string, number>();
  let totalForegroundPixels = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!backgroundMask[y][x]) {
        totalForegroundPixels++;
        const pixel = intToRGBA(image.getPixelColor(x, y));
        const hex = rgbToHex(pixel.r, pixel.g, pixel.b);
        const clusterColor = colorMap.get(hex) || hex;
        foregroundCounts.set(clusterColor, (foregroundCounts.get(clusterColor) || 0) + 1);
      }
    }
  }

  // Filter out colors with very few pixels (less than 0.1% of foreground)
  // This removes single-pixel artifacts and noise
  const minPixelCount = Math.max(10, totalForegroundPixels * 0.001);
  
  const modalColors = Array.from(foregroundCounts.entries())
    .filter(([_, count]) => count >= minPixelCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)
    .map(([color]) => color);

  // Step 7: Create final pixel color map
  const pixelColors: string[][] = Array.from({ length: height }, () => Array(width).fill(''));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!backgroundMask[y][x]) {
        const pixel = intToRGBA(image.getPixelColor(x, y));
        const hex = rgbToHex(pixel.r, pixel.g, pixel.b);
        const clusterColor = colorMap.get(hex) || hex;

        // Map to nearest modal color
        const rgb = hexToRgb(clusterColor);
        let nearest = modalColors[0];
        let minDist = Infinity;
        for (const modalColor of modalColors) {
          const dist = colorDistance(rgb, hexToRgb(modalColor));
          if (dist < minDist) {
            minDist = dist;
            nearest = modalColor;
          }
        }
        pixelColors[y][x] = nearest;
      }
    }
  }

  return {
    width,
    height,
    pixelColors,
    modalColors,
    backgroundMask,
  };
}

// Create monochrome PNG mask for a specific color
export async function createColorMask(
  processedImage: ProcessedImage,
  color: string
): Promise<any> {
  const { width, height, pixelColors } = processedImage;
  const mask = new Jimp({ width, height, color: 0x000000FF }); // Black background

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixelColors[y][x] === color) {
        mask.setPixelColor(0xFFFFFFFF, x, y); // White for this color
      }
    }
  }

  removeSinglePixelArtifacts(mask);

  return mask;
}

// Post-process mask to remove single-pixel artifacts
// Any pixel that differs from all 8 neighbors is replaced with neighbor color
function removeSinglePixelArtifacts(mask: any): void {
  const width = mask.bitmap.width;
  const height = mask.bitmap.height;
  const { intToRGBA } = require('@jimp/utils');
  
  // Create a copy of pixel values to avoid modifying while reading
  const pixels: boolean[][] = Array.from({ length: height }, () => Array(width).fill(false));
  
  // Read current pixel values (true = white/foreground, false = black/background)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = mask.getPixelColor(x, y);
      const rgba = intToRGBA(color);
      pixels[y][x] = rgba.r > 128; // White is foreground
    }
  }
  
  // Check each pixel and fix single-pixel artifacts
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const currentPixel = pixels[y][x];
      
      // Check all 8 neighbors
      const neighbors: boolean[] = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue; // Skip center pixel
          
          const nx = x + dx;
          const ny = y + dy;
          
          // If neighbor is out of bounds, treat it as background (false)
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
            neighbors.push(false);
          } else {
            neighbors.push(pixels[ny][nx]);
          }
        }
      }
      
      // If all neighbors have the same value and it's different from current pixel,
      // this is a single-pixel artifact
      const allSame = neighbors.every(n => n === neighbors[0]);
      if (allSame && neighbors[0] !== currentPixel) {
        // Replace with neighbor color
        const newColor = neighbors[0] ? 0xFFFFFFFF : 0x000000FF;
        mask.setPixelColor(newColor, x, y);
      }
    }
  }
}

// Create mask for any pixel (for backplane)
export async function createBackplaneMask(
  processedImage: ProcessedImage
): Promise<any> {
  const { width, height, backgroundMask } = processedImage;
  const mask = new Jimp({ width, height, color: 0x000000FF }); // Black background

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!backgroundMask[y][x]) {
        mask.setPixelColor(0xFFFFFFFF, x, y); // White for any foreground pixel
      }
    }
  }

  removeSinglePixelArtifacts(mask);

  return mask;
}
