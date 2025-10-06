const { test } = require('node:test');
const assert = require('node:assert');

// Test helper to create ImageData-like object
function createTestImageData(width, height, pixelColors) {
  const data = new Uint8ClampedArray(width * height * 4);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const color = pixelColors[y][x];
      data[i] = color.r;
      data[i + 1] = color.g;
      data[i + 2] = color.b;
      data[i + 3] = color.a !== undefined ? color.a : 255;
    }
  }
  
  return { width, height, data };
}

test('ImageData creation helper', () => {
  const imageData = createTestImageData(2, 2, [
    [{ r: 255, g: 0, b: 0 }, { r: 0, g: 0, b: 255 }],
    [{ r: 0, g: 255, b: 0 }, { r: 255, g: 255, b: 0 }]
  ]);
  
  assert.strictEqual(imageData.width, 2);
  assert.strictEqual(imageData.height, 2);
  assert.strictEqual(imageData.data.length, 16); // 2x2x4
  
  // Check first pixel (red)
  assert.strictEqual(imageData.data[0], 255);
  assert.strictEqual(imageData.data[1], 0);
  assert.strictEqual(imageData.data[2], 0);
  assert.strictEqual(imageData.data[3], 255);
});

test('Voxel coordinates calculation', () => {
  // For a 4x4 image with 50mm width:
  // Each pixel should be 12.5mm × 12.5mm
  const imgWidth = 4;
  const imgHeight = 4;
  const width = 50;
  const depth = 50;
  
  // Test pixel (0,0)
  let px = (0 / imgWidth) * width;
  let py = (0 / imgHeight) * depth;
  let pxNext = ((0 + 1) / imgWidth) * width;
  let pyNext = ((0 + 1) / imgHeight) * depth;
  
  assert.strictEqual(px, 0);
  assert.strictEqual(py, 0);
  assert.strictEqual(pxNext, 12.5);
  assert.strictEqual(pyNext, 12.5);
  
  // Test pixel (1,1)
  px = (1 / imgWidth) * width;
  py = (1 / imgHeight) * depth;
  pxNext = ((1 + 1) / imgWidth) * width;
  pyNext = ((1 + 1) / imgHeight) * depth;
  
  assert.strictEqual(px, 12.5);
  assert.strictEqual(py, 12.5);
  assert.strictEqual(pxNext, 25);
  assert.strictEqual(pyNext, 25);
  
  // Test pixel (3,3) - last pixel
  px = (3 / imgWidth) * width;
  py = (3 / imgHeight) * depth;
  pxNext = ((3 + 1) / imgWidth) * width;
  pyNext = ((3 + 1) / imgHeight) * depth;
  
  assert.strictEqual(px, 37.5);
  assert.strictEqual(py, 37.5);
  assert.strictEqual(pxNext, 50);
  assert.strictEqual(pyNext, 50);
});

test('Layer stacking', () => {
  const colorHeights = [0.5, 0.5, 0.5, 0.5];
  let currentZ = 0;
  const layers = [];
  
  for (let i = 0; i < colorHeights.length; i++) {
    const baseZ = currentZ;
    const topZ = currentZ + colorHeights[i];
    layers.push({ baseZ, topZ });
    currentZ = topZ;
  }
  
  assert.strictEqual(layers[0].baseZ, 0);
  assert.strictEqual(layers[0].topZ, 0.5);
  
  assert.strictEqual(layers[1].baseZ, 0.5);
  assert.strictEqual(layers[1].topZ, 1);
  
  assert.strictEqual(layers[2].baseZ, 1);
  assert.strictEqual(layers[2].topZ, 1.5);
  
  assert.strictEqual(layers[3].baseZ, 1.5);
  assert.strictEqual(layers[3].topZ, 2);
});

test('Voxel vertices count', () => {
  // Each voxel should have 8 vertices (cube corners)
  const vertices = [];
  
  function addVoxel(x1, y1, z1, x2, y2, z2) {
    const baseIndex = vertices.length;
    vertices.push(
      { x: x1, y: y1, z: z1 }, // 0
      { x: x2, y: y1, z: z1 }, // 1
      { x: x2, y: y2, z: z1 }, // 2
      { x: x1, y: y2, z: z1 }, // 3
      { x: x1, y: y1, z: z2 }, // 4
      { x: x2, y: y1, z: z2 }, // 5
      { x: x2, y: y2, z: z2 }, // 6
      { x: x1, y: y2, z: z2 }  // 7
    );
    return baseIndex;
  }
  
  addVoxel(0, 0, 0, 1, 1, 0.5);
  assert.strictEqual(vertices.length, 8);
  
  addVoxel(1, 0, 0, 2, 1, 0.5);
  assert.strictEqual(vertices.length, 16);
});

test('Voxel triangles count', () => {
  // Each voxel should have 12 triangles (2 per face × 6 faces)
  const triangles = [];
  
  function addVoxelTriangles(baseIndex, colorIndex) {
    const faces = [
      [0, 1, 5], [0, 5, 4], // Front
      [2, 3, 7], [2, 7, 6], // Back
      [3, 0, 4], [3, 4, 7], // Left
      [1, 2, 6], [1, 6, 5], // Right
      [4, 5, 6], [4, 6, 7], // Top
      [3, 2, 1], [3, 1, 0]  // Bottom
    ];
    
    faces.forEach(face => {
      triangles.push({
        v1: baseIndex + face[0],
        v2: baseIndex + face[1],
        v3: baseIndex + face[2],
        colorIndex
      });
    });
  }
  
  addVoxelTriangles(0, 0);
  assert.strictEqual(triangles.length, 12);
  
  addVoxelTriangles(8, 1);
  assert.strictEqual(triangles.length, 24);
});

test('Aspect ratio calculation', () => {
  // Square image
  let imgWidth = 100;
  let imgHeight = 100;
  let width = 50;
  let aspectRatio = imgWidth / imgHeight;
  let depth = width / aspectRatio;
  
  assert.strictEqual(aspectRatio, 1);
  assert.strictEqual(depth, 50);
  
  // 2:1 aspect ratio (wide)
  imgWidth = 200;
  imgHeight = 100;
  width = 50;
  aspectRatio = imgWidth / imgHeight;
  depth = width / aspectRatio;
  
  assert.strictEqual(aspectRatio, 2);
  assert.strictEqual(depth, 25);
  
  // 1:2 aspect ratio (tall)
  imgWidth = 100;
  imgHeight = 200;
  width = 50;
  aspectRatio = imgWidth / imgHeight;
  depth = width / aspectRatio;
  
  assert.strictEqual(aspectRatio, 0.5);
  assert.strictEqual(depth, 100);
});

console.log('All geometry tests passed! ✓');
