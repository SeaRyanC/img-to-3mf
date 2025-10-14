/**
 * Debug utility: Image comparison and diff visualization
 * Compares input images with rasterized mesh output to verify correctness
 */

import type { RasterizedImage } from './meshRasterizer';

export interface ImageDiff {
  differencePercentage: number;
  mismatchedPixels: number;
  totalPixels: number;
  diffImage: Uint8ClampedArray;
}

/**
 * Compare two images and generate a diff
 * @param image1 First image (typically input)
 * @param image2 Second image (typically rasterized output)
 * @returns Diff metrics and visualization
 */
export function compareImages(
  image1: RasterizedImage,
  image2: RasterizedImage
): ImageDiff {
  if (image1.width !== image2.width || image1.height !== image2.height) {
    throw new Error('Images must have the same dimensions for comparison');
  }
  
  const width = image1.width;
  const height = image1.height;
  const totalPixels = width * height;
  let mismatchedPixels = 0;
  
  // Create diff image: red = only in image1, green = only in image2, white = match, black = both empty
  const diffImage = new Uint8ClampedArray(width * height * 4);
  
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    
    // Check if pixels are filled (non-white)
    const filled1 = isFilledPixel(image1.data, idx);
    const filled2 = isFilledPixel(image2.data, idx);
    
    if (filled1 && filled2) {
      // Both filled - show as white
      diffImage[idx] = 255;
      diffImage[idx + 1] = 255;
      diffImage[idx + 2] = 255;
      diffImage[idx + 3] = 255;
    } else if (filled1 && !filled2) {
      // Only in image1 - show as red
      diffImage[idx] = 255;
      diffImage[idx + 1] = 0;
      diffImage[idx + 2] = 0;
      diffImage[idx + 3] = 255;
      mismatchedPixels++;
    } else if (!filled1 && filled2) {
      // Only in image2 - show as green
      diffImage[idx] = 0;
      diffImage[idx + 1] = 255;
      diffImage[idx + 2] = 0;
      diffImage[idx + 3] = 255;
      mismatchedPixels++;
    } else {
      // Both empty - show as light gray
      diffImage[idx] = 240;
      diffImage[idx + 1] = 240;
      diffImage[idx + 2] = 240;
      diffImage[idx + 3] = 255;
    }
  }
  
  const differencePercentage = (mismatchedPixels / totalPixels) * 100;
  
  return {
    differencePercentage,
    mismatchedPixels,
    totalPixels,
    diffImage,
  };
}

/**
 * Check if a pixel is filled (not white/background)
 */
function isFilledPixel(data: Uint8ClampedArray, idx: number): boolean {
  const r = data[idx];
  const g = data[idx + 1];
  const b = data[idx + 2];
  
  // Consider non-white pixels as filled
  return r < 250 || g < 250 || b < 250;
}

/**
 * Print diff summary to console
 */
export function printDiffSummary(diff: ImageDiff): void {
  console.log('Image Comparison Results:');
  console.log(`  Total pixels: ${diff.totalPixels}`);
  console.log(`  Mismatched pixels: ${diff.mismatchedPixels}`);
  console.log(`  Difference: ${diff.differencePercentage.toFixed(2)}%`);
  
  if (diff.differencePercentage < 1) {
    console.log('  ✓ Images match very closely');
  } else if (diff.differencePercentage < 5) {
    console.log('  ⚠ Minor differences detected');
  } else {
    console.log('  ✗ Significant differences detected');
  }
}

/**
 * Create a mask from an image (convert to binary)
 */
export function imageToBinaryMask(image: RasterizedImage): Uint8Array {
  const mask = new Uint8Array(image.width * image.height);
  
  for (let i = 0; i < mask.length; i++) {
    const idx = i * 4;
    if (isFilledPixel(image.data, idx)) {
      mask[i] = 1;
    }
  }
  
  return mask;
}

/**
 * Save diff image as PNG (for debugging)
 */
export function saveDiffImage(diff: ImageDiff, width: number, height: number, filename: string): void {
  try {
    const fs = require('fs');
    const { createCanvas } = require('canvas');
    
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);
    imageData.data.set(diff.diffImage);
    ctx.putImageData(imageData, 0, 0);
    
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filename, buffer);
    console.log(`Saved diff image to ${filename}`);
  } catch (err) {
    console.warn('Could not save diff image (canvas package not available):', err);
  }
}
