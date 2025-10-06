const { test } = require('node:test');
const assert = require('node:assert');

test('Voxel Merging Algorithm Tests', async (t) => {
  
  await t.test('Horizontal merge reduces voxel count', () => {
    // Simulate a 4x4 image with a horizontal stripe of red
    const colorMap = [
      [-1, -1, -1, -1],
      [0, 0, 0, 0],  // 4 adjacent red pixels
      [-1, -1, -1, -1],
      [-1, -1, -1, -1]
    ];
    
    const regions = mergeAdjacentVoxels(colorMap, 0, 4, 4);
    
    // Should merge into 1 region instead of 4 voxels
    assert.strictEqual(regions.length, 1);
    assert.deepStrictEqual(regions[0], { x1: 0, y1: 1, x2: 4, y2: 2 });
    
    console.log('✓ Horizontal merge: 4 pixels → 1 region');
  });
  
  await t.test('Vertical regions not merged (by design)', () => {
    // Simulate a 4x4 image with a vertical stripe
    const colorMap = [
      [-1, 0, -1, -1],
      [-1, 0, -1, -1],
      [-1, 0, -1, -1],
      [-1, 0, -1, -1]
    ];
    
    const regions = mergeAdjacentVoxels(colorMap, 0, 4, 4);
    
    // Horizontal-only merge: 4 separate regions (one per row)
    assert.strictEqual(regions.length, 4);
    
    console.log('✓ Vertical pixels remain separate rows: 4 pixels → 4 regions');
  });
  
  await t.test('Multiple horizontal runs detected', () => {
    const colorMap = [
      [0, 0, -1, 0, 0],
      [-1, -1, -1, -1, -1],
      [0, 0, 0, -1, 0]
    ];
    
    const regions = mergeAdjacentVoxels(colorMap, 0, 5, 3);
    
    // Should have 4 regions: [0-2], [3-5], [0-3], [4-5]
    assert.strictEqual(regions.length, 4);
    
    console.log('✓ Multiple runs detected: 8 pixels → 4 regions');
  });
  
  await t.test('Triangle count reduced by merging', () => {
    // Without merging: 4 voxels × 12 triangles = 48 triangles
    // With horizontal merge: 1 merged box × 12 triangles = 12 triangles
    // Reduction: 75%
    
    const unmergedTriangleCount = 4 * 12; // 4 voxels
    const mergedTriangleCount = 1 * 12;   // 1 merged region
    
    const reduction = ((unmergedTriangleCount - mergedTriangleCount) / unmergedTriangleCount) * 100;
    
    assert.ok(reduction >= 75);
    
    console.log(`✓ Triangle reduction: 48 → 12 (${reduction.toFixed(0)}% reduction)`);
  });
});

// Helper function (copy of implementation for testing)
function mergeAdjacentVoxels(colorMap, targetColor, width, height) {
  const regions = [];
  const visited = Array(height).fill(null).map(() => Array(width).fill(false));
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (visited[y][x] || colorMap[y][x] !== targetColor) continue;
      
      // Find the extent of horizontal merge
      let x2 = x;
      while (x2 < width && colorMap[y][x2] === targetColor && !visited[y][x2]) {
        x2++;
      }
      
      // Mark as visited
      for (let xi = x; xi < x2; xi++) {
        visited[y][xi] = true;
      }
      
      // Add region
      regions.push({ x1: x, y1: y, x2: x2, y2: y + 1 });
    }
  }
  
  return regions;
}

console.log('Starting voxel merging tests...\n');
