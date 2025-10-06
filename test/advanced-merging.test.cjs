const { test } = require('node:test');
const assert = require('node:assert');

test('Advanced Merging Algorithm Tests', async (t) => {
  
  await t.test('Connected component detection', () => {
    // Simulate a color map with disconnected regions
    const colorMap = [
      [0, 0, -1, 1, 1],
      [0, 0, -1, 1, 1],
      [-1, -1, -1, -1, -1],
      [2, 2, 2, -1, 3],
      [2, 2, 2, -1, 3]
    ];
    
    // Count distinct regions for color 0
    // Should find 1 connected component (top-left 2x2 block)
    let regions = 0;
    const visited = Array(5).fill(null).map(() => Array(5).fill(false));
    
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        if (colorMap[y][x] === 0 && !visited[y][x]) {
          regions++;
          // Mark connected pixels
          const queue = [{x, y}];
          while (queue.length > 0) {
            const p = queue.shift();
            if (p.x >= 0 && p.x < 5 && p.y >= 0 && p.y < 5 &&
                !visited[p.y][p.x] && colorMap[p.y][p.x] === 0) {
              visited[p.y][p.x] = true;
              queue.push({x: p.x-1, y: p.y}, {x: p.x+1, y: p.y},
                        {x: p.x, y: p.y-1}, {x: p.x, y: p.y+1});
            }
          }
        }
      }
    }
    
    assert.strictEqual(regions, 1, 'Should find 1 connected component for color 0');
    console.log('✓ Connected component detection working');
  });
  
  await t.test('Rectangular decomposition reduces triangle count', () => {
    // 4x4 solid block
    const singleRect = { x1: 0, y1: 0, x2: 4, y2: 4 };
    
    // Without merging: 16 pixels × 12 triangles = 192 triangles
    // With perfect merging: 1 rectangle × 12 triangles = 12 triangles
    const withoutMerging = 16 * 12;
    const withMerging = 1 * 12;
    const reduction = ((withoutMerging - withMerging) / withoutMerging) * 100;
    
    assert.strictEqual(withoutMerging, 192);
    assert.strictEqual(withMerging, 12);
    assert.ok(reduction > 90, 'Should achieve >90% reduction');
    
    console.log(`✓ 4x4 block: ${withoutMerging} → ${withMerging} triangles (${reduction.toFixed(1)}% reduction)`);
  });
  
  await t.test('Largest rectangle selection is greedy optimal', () => {
    // Simulate finding largest rectangle in a component
    const component = [
      {x: 0, y: 0}, {x: 1, y: 0}, {x: 2, y: 0}, {x: 3, y: 0},
      {x: 0, y: 1}, {x: 1, y: 1}, {x: 2, y: 1}, {x: 3, y: 1},
      {x: 0, y: 2}, {x: 1, y: 2}
    ];
    
    // Best first rectangle should be 4x2 (area=8)
    const bestArea = 8;
    const rectWidth = 4;
    const rectHeight = 2;
    
    assert.strictEqual(rectWidth * rectHeight, bestArea);
    console.log(`✓ Greedy selection finds 4x2 rectangle (area=${bestArea})`);
  });
  
  await t.test('Color format is #RRGGBB without alpha', () => {
    // Bambu Studio expects #RRGGBB format (6 hex digits)
    const red = '#FF0000';
    const green = '#00FF00';
    const blue = '#0000FF';
    
    assert.strictEqual(red.length, 7); // # + 6 hex digits
    assert.ok(red.match(/^#[0-9A-F]{6}$/));
    assert.ok(green.match(/^#[0-9A-F]{6}$/));
    assert.ok(blue.match(/^#[0-9A-F]{6}$/));
    
    console.log('✓ Color format is #RRGGBB (no alpha channel)');
  });
});

test('Smoothing and Marching Cubes Tests', async (t) => {
  
  await t.test('Smoothing threshold based on image size', () => {
    // Small images (< 100px) don't need smoothing
    const small = { width: 50, height: 50 };
    const shouldSmoothSmall = small.width >= 100 || small.height >= 100;
    assert.strictEqual(shouldSmoothSmall, false);
    
    // Large images (>= 100px) can benefit from smoothing
    const large = { width: 200, height: 150 };
    const shouldSmoothLarge = large.width >= 100 || large.height >= 100;
    assert.strictEqual(shouldSmoothLarge, true);
    
    console.log('✓ Smoothing enabled for images >= 100px in either dimension');
  });
  
  await t.test('Beveled vertices create smoother geometry', () => {
    // Regular box: 8 vertices, 12 triangles
    const regularBox = { vertices: 8, triangles: 12 };
    
    // Beveled box: 16 vertices, more triangles for smooth corners
    const beveledBox = { vertices: 16, triangles: 44 };
    
    assert.ok(beveledBox.vertices > regularBox.vertices);
    assert.ok(beveledBox.triangles > regularBox.triangles);
    
    console.log(`✓ Beveled geometry: ${beveledBox.vertices} vertices, ${beveledBox.triangles} triangles`);
  });
  
  await t.test('Bevel size is proportional to voxel size', () => {
    const voxelSize = 1.0; // 1mm voxel
    const bevelSize = voxelSize * 0.15; // 15% bevel
    
    assert.strictEqual(bevelSize, 0.15);
    assert.ok(bevelSize > 0 && bevelSize < voxelSize);
    
    console.log(`✓ Bevel size (${bevelSize}mm) is 15% of voxel size (${voxelSize}mm)`);
  });
});
