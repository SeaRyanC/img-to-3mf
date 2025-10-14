/**
 * Debug tests: Use rasterizer and image diff to validate mesh correctness
 */

import { generateMeshFromContours, calculateMeshVolume } from '../contourMesh';
import { createColorMask } from '../marchingCubes';
import { rasterizeMesh } from '../debug/meshRasterizer';
import { compareImages, printDiffSummary, imageToBinaryMask } from '../debug/imageDiff';

describe('Debug: Mesh rasterization and comparison', () => {
  test('C-shape: rasterized mesh should match input', () => {
    // Create a C-shaped region (rectangle with a rectangular bite out of one side)
    const width = 20, height = 20;
    const mask = new Uint8Array(width * height);
    
    // Fill outer rectangle (5,5) to (15,15)
    for (let y = 5; y < 15; y++) {
      for (let x = 5; x < 15; x++) {
        mask[y * width + x] = 1;
      }
    }
    
    // Cut out notch on right side (12,7) to (15,13) to make C-shape
    for (let y = 7; y < 13; y++) {
      for (let x = 12; x < 15; x++) {
        mask[y * width + x] = 0;
      }
    }

    console.log('\n=== C-Shape Test ===');
    console.log('Input mask (X=filled, .=empty):');
    for (let y = 0; y < height; y++) {
      let row = '';
      for (let x = 0; x < width; x++) {
        row += mask[y * width + x] === 1 ? 'X' : '.';
      }
      console.log(row);
    }

    // Generate mesh
    const thickness = 2.0;
    const voxelSize = 1.0;
    const mesh = generateMeshFromContours(mask, width, height, thickness, voxelSize);
    
    // Log mesh details
    console.log(`\nMesh vertices: ${mesh.vertices.length / 3}`);
    console.log(`Mesh triangles: ${mesh.indices.length / 3}`);
    
    // Rasterize the mesh back to 2D
    const rasterized = rasterizeMesh(mesh, width, height, [255, 0, 0]);
    
    console.log('\nRasterized output (X=filled, .=empty):');
    for (let y = 0; y < height; y++) {
      let row = '';
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const isFilled = rasterized.data[idx] < 250 || rasterized.data[idx + 1] < 250 || rasterized.data[idx + 2] < 250;
        row += isFilled ? 'X' : '.';
      }
      console.log(row);
    }
    
    // Convert original mask to image for comparison
    const originalImage = {
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    };
    
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      if (mask[i] === 1) {
        originalImage.data[idx] = 255;
        originalImage.data[idx + 1] = 0;
        originalImage.data[idx + 2] = 0;
        originalImage.data[idx + 3] = 255;
      } else {
        originalImage.data[idx] = 255;
        originalImage.data[idx + 1] = 255;
        originalImage.data[idx + 2] = 255;
        originalImage.data[idx + 3] = 255;
      }
    }
    
    // Compare images
    const diff = compareImages(originalImage, rasterized);
    printDiffSummary(diff);
    
    // The rasterized mesh should match the input C-shape
    // If it looks like a filled rectangle, the concave feature was lost
    console.log(`C-shape volume: ${calculateMeshVolume(mesh).toFixed(2)} mm³ (expected 164.00 mm³)`);
    
    // Allow up to 5% pixel difference due to edge anti-aliasing
    expect(diff.differencePercentage).toBeLessThan(5);
    
    // Volume should be ~164 mm³, not ~200 mm³ (which would indicate filled rectangle)
    const volume = calculateMeshVolume(mesh);
    expect(volume).toBeGreaterThan(160);
    expect(volume).toBeLessThan(170);
  });

  test('Circular C-shape (pac-man): concave arc handled correctly', () => {
    // Create a pac-man shaped region (circle with wedge removed)
    const width = 30, height = 30;
    const mask = new Uint8Array(width * height);
    const centerX = 15, centerY = 15, radius = 10;
    
    // Fill circle
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist <= radius) {
          // Remove wedge on right side (mouth of pac-man)
          const angle = Math.atan2(dy, dx) * 180 / Math.PI;
          // Remove wedge from -30° to +30° (right side)
          if (angle < -30 || angle > 30) {
            mask[y * width + x] = 1;
          }
        }
      }
    }

    console.log('\n=== Circular C-Shape (Pac-Man) Test ===');
    console.log('Input mask (X=filled, .=empty):');
    for (let y = 0; y < height; y++) {
      let row = '';
      for (let x = 0; x < width; x++) {
        row += mask[y * width + x] === 1 ? 'X' : '.';
      }
      console.log(row);
    }

    // Generate mesh
    const thickness = 3.0;
    const voxelSize = 1.0;
    const mesh = generateMeshFromContours(mask, width, height, thickness, voxelSize);
    
    console.log(`\nMesh vertices: ${mesh.vertices.length / 3}`);
    console.log(`Mesh triangles: ${mesh.indices.length / 3}`);
    
    // Rasterize the mesh back to 2D
    const rasterized = rasterizeMesh(mesh, width, height, [255, 0, 0]);
    
    console.log('\nRasterized output (X=filled, .=empty):');
    for (let y = 0; y < height; y++) {
      let row = '';
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const isFilled = rasterized.data[idx] < 250 || rasterized.data[idx + 1] < 250 || rasterized.data[idx + 2] < 250;
        row += isFilled ? 'X' : '.';
      }
      console.log(row);
    }
    
    // Convert mask to image
    const originalImage = {
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    };
    
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      if (mask[i] === 1) {
        originalImage.data[idx] = 255;
        originalImage.data[idx + 1] = 0;
        originalImage.data[idx + 2] = 0;
        originalImage.data[idx + 3] = 255;
      } else {
        originalImage.data[idx] = 255;
        originalImage.data[idx + 1] = 255;
        originalImage.data[idx + 2] = 255;
        originalImage.data[idx + 3] = 255;
      }
    }
    
    const diff = compareImages(originalImage, rasterized);
    printDiffSummary(diff);
    
    // Expected volume for pac-man: ~80% of full circle
    // Full circle: π × 10² × 3 ≈ 942.48 mm³
    // Pac-man (with ~60° wedge removed): ~833% of circle
    const fullCircleVolume = Math.PI * radius * radius * thickness;
    const expectedVolume = fullCircleVolume * (300 / 360); // 300° out of 360°
    const volume = calculateMeshVolume(mesh);
    
    console.log(`Pac-man volume: ${volume.toFixed(2)} mm³`);
    console.log(`Expected: ${expectedVolume.toFixed(2)} mm³ (${(expectedVolume / fullCircleVolume * 100).toFixed(1)}% of full circle)`);
    console.log(`Full circle would be: ${fullCircleVolume.toFixed(2)} mm³`);
    
    // Volume should be less than full circle
    expect(volume).toBeLessThan(fullCircleVolume * 1.15);
    
    // Should be at least 70% of full circle (accounting for discrete sampling)
    expect(volume).toBeGreaterThan(fullCircleVolume * 0.70);
    
    // Image difference should be reasonable (< 10% due to discrete sampling)
    expect(diff.differencePercentage).toBeLessThan(10);
  });

  test('L-shape: rasterized mesh should match input', () => {
    // Create an L-shaped region
    const width = 20, height = 20;
    const mask = new Uint8Array(width * height);
    
    // Vertical bar: (5,5) to (10,15)
    for (let y = 5; y < 15; y++) {
      for (let x = 5; x < 10; x++) {
        mask[y * width + x] = 1;
      }
    }
    
    // Horizontal bar: (5,10) to (15,15)
    for (let y = 10; y < 15; y++) {
      for (let x = 5; x < 15; x++) {
        mask[y * width + x] = 1;
      }
    }

    // Generate mesh
    const mesh = generateMeshFromContours(mask, width, height, 2.0, 1.0);
    
    // Rasterize the mesh back to 2D
    const rasterized = rasterizeMesh(mesh, width, height, [255, 0, 0]);
    
    // Convert original mask to image
    const originalImage = {
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    };
    
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      if (mask[i] === 1) {
        originalImage.data[idx] = 255;
        originalImage.data[idx + 1] = 0;
        originalImage.data[idx + 2] = 0;
        originalImage.data[idx + 3] = 255;
      } else {
        originalImage.data[idx] = 255;
        originalImage.data[idx + 1] = 255;
        originalImage.data[idx + 2] = 255;
        originalImage.data[idx + 3] = 255;
      }
    }
    
    // Compare images
    const diff = compareImages(originalImage, rasterized);
    printDiffSummary(diff);
    
    console.log(`L-shape mesh: ${mesh.indices.length / 3} triangles`);
    console.log(`L-shape volume: ${calculateMeshVolume(mesh).toFixed(2)} mm³ (expected 150.00 mm³)`);
    
    // Allow up to 5% pixel difference
    expect(diff.differencePercentage).toBeLessThan(5);
    
    // Volume should be ~150 mm³, not ~200 mm³
    const volume = calculateMeshVolume(mesh);
    expect(volume).toBeGreaterThan(145);
    expect(volume).toBeLessThan(155);
  });

  test('Rectangle: sanity check that rasterization works', () => {
    const width = 20, height = 20;
    const mask = new Uint8Array(width * height);
    
    // Fill rectangle (5,5) to (15,15)
    for (let y = 5; y < 15; y++) {
      for (let x = 5; x < 15; x++) {
        mask[y * width + x] = 1;
      }
    }

    const mesh = generateMeshFromContours(mask, width, height, 2.0, 1.0);
    const rasterized = rasterizeMesh(mesh, width, height, [255, 0, 0]);
    
    // Convert mask to image
    const originalImage = {
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    };
    
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      if (mask[i] === 1) {
        originalImage.data[idx] = 255;
        originalImage.data[idx + 1] = 0;
        originalImage.data[idx + 2] = 0;
        originalImage.data[idx + 3] = 255;
      } else {
        originalImage.data[idx] = 255;
        originalImage.data[idx + 1] = 255;
        originalImage.data[idx + 2] = 255;
        originalImage.data[idx + 3] = 255;
      }
    }
    
    const diff = compareImages(originalImage, rasterized);
    printDiffSummary(diff);
    
    // Rectangles should match perfectly
    expect(diff.differencePercentage).toBeLessThan(1);
  });
});
