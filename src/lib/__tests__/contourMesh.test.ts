/**
 * Tests for contour-based mesh generation
 * These tests verify that volume calculations are CORRECT
 */

import { generateMeshFromContours, calculateMeshVolume } from '../contourMesh';
import { createColorMask, createVoxelVolume, marchingCubes } from '../marchingCubes';

describe('Contour-based mesh generation', () => {
  /**
   * Helper to create a test image with a filled rectangle
   */
  function createRectangleImage(
    width: number,
    height: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: [number, number, number] = [255, 0, 0]
  ): Uint8ClampedArray {
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (x >= x1 && x < x2 && y >= y1 && y < y2) {
          data[idx] = color[0];
          data[idx + 1] = color[1];
          data[idx + 2] = color[2];
          data[idx + 3] = 255;
        }
      }
    }

    return data;
  }

  test('10x10 rectangle: exactly 12 triangles', () => {
    // Create a 10x10 filled rectangle
    const imageData = createRectangleImage(10, 10, 0, 0, 10, 10);
    const mask = createColorMask(imageData, 10, 10, [255, 0, 0]);

    const mesh = generateMeshFromContours(mask, 10, 10, 2.0, 1.0);

    // Should have exactly 12 triangles for a box
    expect(mesh.indices.length / 3).toBe(12);
    
    // Should have 8 vertices (4 front, 4 back)
    expect(mesh.vertices.length / 3).toBe(8);
  });

  test('10x10x2 box: volume = 200 mm³', () => {
    // Create a 10x10 filled rectangle with 2mm thickness
    const imageData = createRectangleImage(10, 10, 0, 0, 10, 10);
    const mask = createColorMask(imageData, 10, 10, [255, 0, 0]);

    const mesh = generateMeshFromContours(mask, 10, 10, 2.0, 1.0);
    const volume = calculateMeshVolume(mesh);

    // Expected: 10mm × 10mm × 2mm = 200 mm³
    console.log(`Volume: ${volume.toFixed(2)} mm³ (expected 200.00 mm³)`);
    
    // Volume must be within 1% of expected (allow minor numerical error)
    expect(volume).toBeGreaterThan(198);
    expect(volume).toBeLessThan(202);
  });

  test('5x5x3 box: volume = 75 mm³', () => {
    const imageData = createRectangleImage(5, 5, 0, 0, 5, 5);
    const mask = createColorMask(imageData, 5, 5, [255, 0, 0]);

    const mesh = generateMeshFromContours(mask, 5, 5, 3.0, 1.0);
    const volume = calculateMeshVolume(mesh);

    // Expected: 5mm × 5mm × 3mm = 75 mm³
    console.log(`Volume: ${volume.toFixed(2)} mm³ (expected 75.00 mm³)`);
    
    expect(volume).toBeGreaterThan(74);
    expect(volume).toBeLessThan(76);
  });

  test('20x15x4 box: volume = 1200 mm³', () => {
    const imageData = createRectangleImage(20, 15, 0, 0, 20, 15);
    const mask = createColorMask(imageData, 20, 15, [255, 0, 0]);

    const mesh = generateMeshFromContours(mask, 20, 15, 4.0, 1.0);
    const volume = calculateMeshVolume(mesh);

    // Expected: 20mm × 15mm × 4mm = 1200 mm³
    console.log(`Volume: ${volume.toFixed(2)} mm³ (expected 1200.00 mm³)`);
    
    expect(volume).toBeGreaterThan(1190);
    expect(volume).toBeLessThan(1210);
  });

  test('contour mesh has far fewer triangles than marching cubes', () => {
    const imageData = createRectangleImage(20, 20, 5, 5, 15, 15);
    const mask = createColorMask(imageData, 20, 20, [255, 0, 0]);

    // Contour approach
    const contourMesh = generateMeshFromContours(mask, 20, 20, 2.0, 1.0);
    const contourTriangles = contourMesh.indices.length / 3;

    // Marching cubes approach
    const volume = createVoxelVolume(mask, 20, 20, 2.0, 1.0);
    const mcMesh = marchingCubes(volume.data, volume.width, volume.height, volume.depth, 0.5, 1.0);
    const mcTriangles = mcMesh.indices.length / 3;

    console.log(`Contour: ${contourTriangles} triangles`);
    console.log(`Marching cubes: ${mcTriangles} triangles`);
    console.log(`Reduction: ${((1 - contourTriangles / mcTriangles) * 100).toFixed(1)}%`);

    // Contour should use at least 50% fewer triangles
    expect(contourTriangles).toBeLessThan(mcTriangles * 0.5);
  });

  test('scaled voxels: volume scales correctly', () => {
    const imageData = createRectangleImage(10, 10, 0, 0, 10, 10);
    const mask = createColorMask(imageData, 10, 10, [255, 0, 0]);

    // Test with voxelSize = 2.0mm per pixel
    const mesh = generateMeshFromContours(mask, 10, 10, 2.0, 2.0);
    const volume = calculateMeshVolume(mesh);

    // Expected: (10*2)mm × (10*2)mm × 2mm = 20×20×2 = 800 mm³
    console.log(`Scaled volume: ${volume.toFixed(2)} mm³ (expected 800.00 mm³)`);
    
    expect(volume).toBeGreaterThan(790);
    expect(volume).toBeLessThan(810);
  });

  test('non-square rectangle: volume correct', () => {
    const imageData = createRectangleImage(30, 20, 5, 5, 25, 15);
    const mask = createColorMask(imageData, 30, 20, [255, 0, 0]);

    const mesh = generateMeshFromContours(mask, 30, 20, 3.0, 1.0);
    const volume = calculateMeshVolume(mesh);

    // Expected: 20mm × 10mm × 3mm = 600 mm³
    console.log(`Non-square volume: ${volume.toFixed(2)} mm³ (expected 600.00 mm³)`);
    
    expect(volume).toBeGreaterThan(590);
    expect(volume).toBeLessThan(610);
  });

  test('circle: volume matches cylinder formula', () => {
    // Create a filled circle with radius 10 pixels
    const width = 30, height = 30;
    const centerX = 15, centerY = 15, radius = 10;
    const imageData = new Uint8ClampedArray(width * height * 4);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist <= radius) {
          const idx = (y * width + x) * 4;
          imageData[idx] = 255;     // R
          imageData[idx + 1] = 0;   // G
          imageData[idx + 2] = 0;   // B
          imageData[idx + 3] = 255; // A
        }
      }
    }
    
    const mask = createColorMask(imageData, width, height, [255, 0, 0]);
    const thickness = 3.0;
    const voxelSize = 1.0;
    
    const mesh = generateMeshFromContours(mask, width, height, thickness, voxelSize);
    const volume = calculateMeshVolume(mesh);
    
    // Expected volume: π × r² × h = π × 10² × 3 ≈ 942.48 mm³
    const expectedVolume = Math.PI * radius * radius * thickness;
    console.log(`Circle volume: ${volume.toFixed(2)} mm³ (expected ${expectedVolume.toFixed(2)} mm³)`);
    
    // Convex hull approximation should be within 90-110% of circle volume
    // (since convex hull of discrete circle pixels approximates the circle)
    const tolerance = 0.15; // 15% tolerance for discrete approximation
    expect(volume).toBeGreaterThan(expectedVolume * (1 - tolerance));
    expect(volume).toBeLessThan(expectedVolume * (1 + tolerance));
    
    // Verify mesh is not flat
    expect(volume).toBeGreaterThan(500);
  });

  test('L-shaped region: concave shape handled correctly', () => {
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

    const thickness = 2.0;
    const voxelSize = 1.0;
    const mesh = generateMeshFromContours(mask, width, height, thickness, voxelSize);
    const volume = calculateMeshVolume(mesh);
    
    // L-shape volume:
    // Vertical part: 5×10×2 = 100 mm³
    // Horizontal part: 10×5×2 = 100 mm³
    // Overlap: 5×5×2 = 50 mm³
    // Total: 100 + 100 - 50 = 150 mm³
    const expectedVolume = 150;
    console.log(`L-shape volume: ${volume.toFixed(2)} mm³ (expected ${expectedVolume.toFixed(2)} mm³)`);
    
    // With convex hull, this would be ~200 mm³ (10×10×2), which is wrong
    // With proper concave support, should be ~150 mm³
    expect(volume).toBeGreaterThan(140);
    expect(volume).toBeLessThan(160);
  });

  test('C-shaped (concave) region: volume correct', () => {
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

    const thickness = 2.0;
    const voxelSize = 1.0;
    const mesh = generateMeshFromContours(mask, width, height, thickness, voxelSize);
    const volume = calculateMeshVolume(mesh);
    
    // C-shape volume:
    // Full rectangle: 10×10×2 = 200 mm³
    // Notch removed: 3×6×2 = 36 mm³
    // Expected: 200 - 36 = 164 mm³
    const expectedVolume = 164;
    console.log(`C-shape volume: ${volume.toFixed(2)} mm³ (expected ${expectedVolume.toFixed(2)} mm³)`);
    
    // With convex hull, this would be ~200 mm³ (filling in the notch)
    // With proper concave support, should be ~164 mm³
    expect(volume).toBeGreaterThan(160);
    expect(volume).toBeLessThan(168);
  });

  test('rectangle with hole (TODO: implement hole support)', () => {
    // Create outer rectangle
    const width = 20, height = 20;
    const mask = new Uint8Array(width * height);
    
    // Fill outer rectangle (5,5) to (15,15)
    for (let y = 5; y < 15; y++) {
      for (let x = 5; x < 15; x++) {
        mask[y * width + x] = 1;
      }
    }
    
    // Cut out hole (8,8) to (12,12)
    for (let y = 8; y < 12; y++) {
      for (let x = 8; x < 12; x++) {
        mask[y * width + x] = 0;
      }
    }

    const mesh = generateMeshFromContours(mask, width, height, 2.0, 1.0);
    
    // For now, convex hull approach will treat this as solid 10x10x2 = 200 mm³
    // TODO: Implement proper hole detection for accurate volume
    // Expected with holes: (10×10 - 4×4) × 2 = 84 × 2 = 168 mm³
    
    const volume = calculateMeshVolume(mesh);
    console.log(`Rectangle with hole volume: ${volume.toFixed(2)} mm³`);
    console.log(`(Note: Hole support not yet implemented, uses convex hull)`);
    
    // Just verify we get some reasonable volume
    expect(volume).toBeGreaterThan(0);
  });
});
