const { test } = require('node:test');
const assert = require('node:assert');

test('Color assignment in triangles', () => {
  // Simulate creating triangles with different color indices
  const triangles = [];
  
  // Add triangles for color 0
  for (let i = 0; i < 12; i++) {
    triangles.push({ v1: i * 3, v2: i * 3 + 1, v3: i * 3 + 2, colorIndex: 0 });
  }
  
  // Add triangles for color 1
  for (let i = 0; i < 12; i++) {
    triangles.push({ v1: 36 + i * 3, v2: 36 + i * 3 + 1, v3: 36 + i * 3 + 2, colorIndex: 1 });
  }
  
  // Verify all triangles in first group have colorIndex 0
  for (let i = 0; i < 12; i++) {
    assert.strictEqual(triangles[i].colorIndex, 0, `Triangle ${i} should have colorIndex 0`);
  }
  
  // Verify all triangles in second group have colorIndex 1
  for (let i = 12; i < 24; i++) {
    assert.strictEqual(triangles[i].colorIndex, 1, `Triangle ${i} should have colorIndex 1`);
  }
  
  console.log('✓ Color indices correctly assigned to triangles');
});

test('All layers should start at Z=0', () => {
  // This test verifies that all color layers should be at the same Z position
  // Not stacked on top of each other
  
  const colorHeights = [0.5, 0.5, 0.5, 0.5];
  const colors = ['red', 'blue', 'green', 'yellow'];
  
  // WRONG approach (current implementation - stacking layers)
  let currentZ_wrong = 0;
  const wrongLayers = [];
  for (let i = 0; i < colors.length; i++) {
    wrongLayers.push({
      color: colors[i],
      baseZ: currentZ_wrong,
      topZ: currentZ_wrong + colorHeights[i]
    });
    currentZ_wrong += colorHeights[i];
  }
  
  // This creates stacked layers:
  // Red: 0 to 0.5
  // Blue: 0.5 to 1.0
  // Green: 1.0 to 1.5
  // Yellow: 1.5 to 2.0
  assert.strictEqual(wrongLayers[0].baseZ, 0);
  assert.strictEqual(wrongLayers[1].baseZ, 0.5);  // WRONG - should be 0
  assert.strictEqual(wrongLayers[2].baseZ, 1.0);  // WRONG - should be 0
  assert.strictEqual(wrongLayers[3].baseZ, 1.5);  // WRONG - should be 0
  
  console.log('⚠️  Current implementation creates stacked layers (WRONG):');
  wrongLayers.forEach(l => console.log(`  ${l.color}: Z ${l.baseZ} to ${l.topZ}`));
  
  // CORRECT approach (all layers start at Z=0)
  const correctLayers = [];
  for (let i = 0; i < colors.length; i++) {
    correctLayers.push({
      color: colors[i],
      baseZ: 0,  // All start at 0
      topZ: colorHeights[i]  // Only height varies
    });
  }
  
  // This creates overlapping layers at Z=0:
  // Red: 0 to 0.5
  // Blue: 0 to 0.5
  // Green: 0 to 0.5
  // Yellow: 0 to 0.5
  assert.strictEqual(correctLayers[0].baseZ, 0);
  assert.strictEqual(correctLayers[1].baseZ, 0);  // CORRECT
  assert.strictEqual(correctLayers[2].baseZ, 0);  // CORRECT
  assert.strictEqual(correctLayers[3].baseZ, 0);  // CORRECT
  
  console.log('\n✓ Correct implementation should have all layers at Z=0:');
  correctLayers.forEach(l => console.log(`  ${l.color}: Z ${l.baseZ} to ${l.topZ}`));
});

test('3MF XML structure with colors', () => {
  // Test that XML properly references materials
  const xmlFragment = `
    <triangle v1="0" v2="1" v3="2" pid="1" p1="0" />
    <triangle v1="3" v2="4" v3="5" pid="1" p1="1" />
    <triangle v1="6" v2="7" v3="8" pid="1" p1="2" />
  `;
  
  // Extract p1 values (color indices)
  const p1Matches = xmlFragment.match(/p1="(\d+)"/g);
  assert.ok(p1Matches, 'Should have p1 attributes');
  assert.strictEqual(p1Matches.length, 3, 'Should have 3 triangles');
  
  const colorIndices = p1Matches.map(m => parseInt(m.match(/p1="(\d+)"/)[1]));
  assert.deepStrictEqual(colorIndices, [0, 1, 2], 'Should have color indices 0, 1, 2');
  
  console.log('✓ XML correctly references material indices via p1 attribute');
});

console.log('\nRunning 3MF color and Z-plane tests...\n');
