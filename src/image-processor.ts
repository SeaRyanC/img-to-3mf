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

  // Start from top-left corner
  const startX = 0;
  const startY = 0;
  const startPixel = intToRGBA(image.getPixelColor(startX, startY));
  const startHex = rgbToHex(startPixel.r, startPixel.g, startPixel.b);
  const startColor = colorMap.get(startHex) || startHex;

  queue.push([startX, startY]);

  while (queue.length > 0) {
    const [x, y] = queue.shift()!;

    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    if (visited[y][x]) continue;

    visited[y][x] = true;

    const pixel = intToRGBA(image.getPixelColor(x, y));
    const hex = rgbToHex(pixel.r, pixel.g, pixel.b);
    const clusterColor = colorMap.get(hex) || hex;

    // If same color as starting point (within threshold), mark as background and continue flood fill
    if (clusterColor === startColor || 
        colorDistance(hexToRgb(clusterColor), hexToRgb(startColor)) <= COLOR_SIMILARITY_THRESHOLD) {
      background[y][x] = true;

      // Add neighbors to queue
      queue.push([x + 1, y]);
      queue.push([x - 1, y]);
      queue.push([x, y + 1]);
      queue.push([x, y - 1]);
    }
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

  return mask;
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

  return mask;
}
