/**
 * Debug utility: Rasterize triangle meshes back to 2D images
 * This allows us to visually compare generated meshes with input images
 */

import type { Mesh } from '../../types';

export interface RasterizedImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Rasterize a 3D mesh to a 2D image by projecting triangles onto the XY plane
 * @param mesh The mesh to rasterize
 * @param width Output image width
 * @param height Output image height
 * @param color RGB color to use for filled pixels
 * @returns Image data that can be compared with input
 */
export function rasterizeMesh(
  mesh: Mesh,
  width: number,
  height: number,
  color: [number, number, number] = [255, 0, 0]
): RasterizedImage {
  const data = new Uint8ClampedArray(width * height * 4);
  
  // Initialize to white background
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = 255;
  }
  
  // Create a coverage map
  const covered = new Uint8Array(width * height);
  
  // Rasterize each triangle
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const i0 = mesh.indices[i] * 3;
    const i1 = mesh.indices[i + 1] * 3;
    const i2 = mesh.indices[i + 2] * 3;
    
    const v0 = { x: mesh.vertices[i0], y: mesh.vertices[i0 + 1] };
    const v1 = { x: mesh.vertices[i1], y: mesh.vertices[i1 + 1] };
    const v2 = { x: mesh.vertices[i2], y: mesh.vertices[i2 + 1] };
    
    // Rasterize this triangle
    rasterizeTriangle(covered, width, height, v0, v1, v2);
  }
  
  // Convert coverage map to image data
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (covered[idx] > 0) {
        const pixelIdx = idx * 4;
        data[pixelIdx] = color[0];
        data[pixelIdx + 1] = color[1];
        data[pixelIdx + 2] = color[2];
        data[pixelIdx + 3] = 255;
      }
    }
  }
  
  return { data, width, height };
}

/**
 * Rasterize a single triangle using scanline algorithm
 */
function rasterizeTriangle(
  covered: Uint8Array,
  width: number,
  height: number,
  v0: { x: number; y: number },
  v1: { x: number; y: number },
  v2: { x: number; y: number }
): void {
  // Find bounding box
  const minX = Math.max(0, Math.floor(Math.min(v0.x, v1.x, v2.x)));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(v0.x, v1.x, v2.x)));
  const minY = Math.max(0, Math.floor(Math.min(v0.y, v1.y, v2.y)));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(v0.y, v1.y, v2.y)));
  
  // Use barycentric coordinates to determine if pixel is inside triangle
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (pointInTriangle(x + 0.5, y + 0.5, v0, v1, v2)) {
        const idx = y * width + x;
        covered[idx] = 1;
      }
    }
  }
}

/**
 * Check if a point is inside a triangle using barycentric coordinates
 */
function pointInTriangle(
  px: number,
  py: number,
  v0: { x: number; y: number },
  v1: { x: number; y: number },
  v2: { x: number; y: number }
): boolean {
  // Calculate barycentric coordinates
  const denom = (v1.y - v2.y) * (v0.x - v2.x) + (v2.x - v1.x) * (v0.y - v2.y);
  if (Math.abs(denom) < 0.0001) return false;
  
  const a = ((v1.y - v2.y) * (px - v2.x) + (v2.x - v1.x) * (py - v2.y)) / denom;
  const b = ((v2.y - v0.y) * (px - v2.x) + (v0.x - v2.x) * (py - v2.y)) / denom;
  const c = 1 - a - b;
  
  // Point is inside if all barycentric coordinates are non-negative
  return a >= -0.001 && b >= -0.001 && c >= -0.001;
}

/**
 * Save rasterized image as PNG (for Node.js debugging)
 * Requires 'canvas' package
 */
export function saveRasterizedImage(
  image: RasterizedImage,
  filename: string
): void {
  try {
    // This is for debugging only, requires canvas package
    const fs = require('fs');
    const { createCanvas } = require('canvas');
    
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(image.width, image.height);
    imageData.data.set(image.data);
    ctx.putImageData(imageData, 0, 0);
    
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filename, buffer);
    console.log(`Saved rasterized image to ${filename}`);
  } catch (err) {
    console.warn('Could not save image (canvas package not available):', err);
  }
}
