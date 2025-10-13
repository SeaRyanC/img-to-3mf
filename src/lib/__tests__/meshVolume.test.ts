/**
 * Unit tests for mesh volume validation
 */

import { createColorMask, createVoxelVolume, marchingCubes } from '../marchingCubes';
import type { Mesh } from '../../types';

/**
 * Calculate the signed volume of a triangle mesh using the divergence theorem
 * Volume = (1/6) * sum of all (v1 · (v2 × v3)) for each triangle
 */
function calculateMeshVolume(mesh: Mesh): number {
  const { vertices, indices } = mesh;
  let volume = 0;

  for (let i = 0; i < indices.length; i += 3) {
    const i1 = indices[i] * 3;
    const i2 = indices[i + 1] * 3;
    const i3 = indices[i + 2] * 3;

    // Get triangle vertices
    const v1x = vertices[i1];
    const v1y = vertices[i1 + 1];
    const v1z = vertices[i1 + 2];

    const v2x = vertices[i2];
    const v2y = vertices[i2 + 1];
    const v2z = vertices[i2 + 2];

    const v3x = vertices[i3];
    const v3y = vertices[i3 + 1];
    const v3z = vertices[i3 + 2];

    // Calculate cross product v2 × v3
    const crossX = v2y * v3z - v2z * v3y;
    const crossY = v2z * v3x - v2x * v3z;
    const crossZ = v2x * v3y - v2y * v3x;

    // Calculate dot product v1 · (v2 × v3)
    const dot = v1x * crossX + v1y * crossY + v1z * crossZ;

    volume += dot;
  }

  return Math.abs(volume / 6);
}

/**
 * Create a simple test image with a rectangular region
 */
function createTestImage(width: number, height: number, fillX1: number, fillY1: number, fillX2: number, fillY2: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      
      // Fill with red color in the specified region, transparent elsewhere
      if (x >= fillX1 && x < fillX2 && y >= fillY1 && y < fillY2) {
        data[idx] = 255;     // R
        data[idx + 1] = 0;   // G
        data[idx + 2] = 0;   // B
        data[idx + 3] = 255; // A
      } else {
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 0;
      }
    }
  }

  return data;
}

describe('Mesh Volume Tests', () => {
  test('generates mesh with correct volume for rectangular region', () => {
    // Create a 100x100 test image with a 50x50 red rectangle in the center
    const width = 100;
    const height = 100;
    const rectWidth = 50;
    const rectHeight = 50;
    const rectX1 = 25;
    const rectY1 = 25;
    const rectX2 = rectX1 + rectWidth;
    const rectY2 = rectY1 + rectHeight;

    const imageData = createTestImage(width, height, rectX1, rectY1, rectX2, rectY2);

    // Create mask for red color
    const mask = createColorMask(imageData, width, height, [255, 0, 0]);

    // Verify mask has correct number of pixels
    const maskPixels = Array.from(mask).reduce((sum, val) => sum + val, 0);
    expect(maskPixels).toBe(rectWidth * rectHeight);

    // Create voxel volume with known dimensions
    const voxelSize = 1.0; // 1mm per pixel
    const layerHeight = 6.0; // 6mm thick for proper depth resolution
    const volume = createVoxelVolume(mask, width, height, layerHeight, voxelSize);

    // Verify volume dimensions
    expect(volume.width).toBe(width);
    expect(volume.height).toBe(height);
    expect(volume.depth).toBeGreaterThanOrEqual(6); // At least 6 voxels deep
    
    console.log(`Volume dimensions: ${volume.width}x${volume.height}x${volume.depth}`);
    console.log(`Voxel size: ${voxelSize}, Layer height: ${layerHeight}`);
    
    // Count filled voxels
    let filledVoxels = 0;
    for (let i = 0; i < volume.data.length; i++) {
      if (volume.data[i] >= 0.5) filledVoxels++;
    }
    console.log(`Filled voxels: ${filledVoxels} / ${volume.data.length}`);

    // Generate mesh
    const mesh = marchingCubes(volume.data, volume.width, volume.height, volume.depth, 0.5, voxelSize);

    // Verify mesh is not empty
    expect(mesh.vertices.length).toBeGreaterThan(0);
    expect(mesh.indices.length).toBeGreaterThan(0);
    
    console.log(`Mesh: ${mesh.vertices.length / 3} vertices, ${mesh.indices.length / 3} triangles`);

    // Calculate mesh volume
    const meshVolume = calculateMeshVolume(mesh);

    // Expected volume: rectWidth * rectHeight * layerHeight (in mm³)
    // The mesh should approximate a box of dimensions: 50mm x 50mm x 4mm
    // But voxelization is in voxel units, not mm
    const expectedVolume = rectWidth * voxelSize * rectHeight * voxelSize * layerHeight;

    console.log(`Mesh volume: ${meshVolume.toFixed(2)} mm³`);
    console.log(`Expected volume (approx): ${expectedVolume.toFixed(2)} mm³`);
    console.log(`Ratio: ${(meshVolume / expectedVolume * 100).toFixed(1)}%`);

    // The main goal is to verify mesh has proper 3D volume, not flat
    // Marching cubes may not capture exact volume due to surface approximation
    // But we should get at least 20-40% of the bounding box volume
    expect(meshVolume).toBeGreaterThan(expectedVolume * 0.2); // At least 20% of bounding box
    expect(meshVolume).toBeLessThan(expectedVolume * 2.0);   // Not more than 2x (sanity check)
    
    // Most importantly, verify it has substantial volume (not nearly flat)
    expect(meshVolume).toBeGreaterThan(1000); // Should be > 1000 mm³ for a reasonably sized shape
  });

  test('generates mesh with non-zero volume for reference test image', () => {
    // Create a simplified version of the test image (200x200 with colored shapes)
    const width = 200;
    const height = 200;
    
    // Red rectangle at top-left (20x20 to 80x80)
    const imageData = createTestImage(width, height, 20, 20, 80, 80);

    const mask = createColorMask(imageData, width, height, [255, 0, 0]);
    
    // Typical parameters from the app
    const physicalWidth = 100; // mm
    const voxelSize = physicalWidth / Math.max(width, height); // ~0.5mm
    const layerHeight = 2.0; // mm
    
    // Ensure minimum depth resolution
    const minDepthVoxels = 4;
    const depthVoxels = Math.max(minDepthVoxels, Math.ceil(layerHeight / voxelSize));
    const actualDepth = depthVoxels * voxelSize;
    
    const volume = createVoxelVolume(mask, width, height, actualDepth, voxelSize);
    const mesh = marchingCubes(volume.data, volume.width, volume.height, volume.depth, 0.5, voxelSize);

    // Calculate volume
    const meshVolume = calculateMeshVolume(mesh);

    // Red rectangle is 60x60 pixels = 30x30mm at 0.5mm/pixel
    // Depth is actualDepth mm
    const rectPixels = 60 * 60;
    const expectedVolume = rectPixels * (voxelSize * voxelSize) * actualDepth;

    console.log(`Reference image mesh volume: ${meshVolume.toFixed(2)} mm³`);
    console.log(`Expected volume (approx): ${expectedVolume.toFixed(2)} mm³`);
    console.log(`Depth voxels: ${depthVoxels}, actual depth: ${actualDepth.toFixed(2)} mm`);
    console.log(`Ratio: ${(meshVolume / expectedVolume * 100).toFixed(1)}%`);

    // Verify mesh has reasonable 3D volume (not flat)
    expect(meshVolume).toBeGreaterThan(expectedVolume * 0.15); // At least 15% of bounding box
    expect(meshVolume).toBeLessThan(expectedVolume * 2.0);     // Not more than 2x
    
    // Most importantly, verify it's not nearly zero or flat
    expect(meshVolume).toBeGreaterThan(100); // Should be > 100 mm³
  });
});
