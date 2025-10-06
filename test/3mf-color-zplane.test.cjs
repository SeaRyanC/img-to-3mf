const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const JSZip = require('jszip');

test('3MF file has colors attached to triangles', async () => {
  const testFile = '/tmp/playwright-logs/model.3mf';
  
  if (!fs.existsSync(testFile)) {
    console.log('⚠️  No test 3MF file found');
    return;
  }
  
  const data = fs.readFileSync(testFile);
  const zip = await JSZip.loadAsync(data);
  const modelXml = await zip.file('3D/3dmodel.model').async('string');
  
  // Check materials exist
  const materialMatches = modelXml.match(/<base name="([^"]+)" displaycolor="([^"]+)"/g);
  assert.ok(materialMatches, 'Should have materials defined');
  assert.ok(materialMatches.length >= 4, 'Should have at least 4 colors');
  
  console.log(`✓ Found ${materialMatches.length} color materials`);
  
  // Check triangles have color indices
  const triangleMatches = modelXml.match(/<triangle[^>]+p1="(\d+)"/g);
  assert.ok(triangleMatches, 'Should have triangles with color indices');
  
  // Extract all p1 values (color indices)
  const colorIndices = new Set();
  triangleMatches.forEach(t => {
    const match = t.match(/p1="(\d+)"/);
    if (match) {
      colorIndices.add(parseInt(match[1]));
    }
  });
  
  console.log(`✓ Found ${triangleMatches.length} triangles`);
  console.log(`✓ Using ${colorIndices.size} different color indices: ${Array.from(colorIndices).sort().join(', ')}`);
  
  assert.ok(colorIndices.size >= 4, 'Should use at least 4 different color indices');
  
  // Verify each color index is used
  const colorCounts = {};
  triangleMatches.forEach(t => {
    const match = t.match(/p1="(\d+)"/);
    if (match) {
      const idx = match[1];
      colorCounts[idx] = (colorCounts[idx] || 0) + 1;
    }
  });
  
  console.log('Color usage:');
  Object.keys(colorCounts).sort().forEach(idx => {
    console.log(`  Color ${idx}: ${colorCounts[idx]} triangles`);
  });
  
  // Each color should be used
  assert.ok(colorCounts['0'] > 0, 'Color 0 should be used');
  assert.ok(colorCounts['1'] > 0, 'Color 1 should be used');
  assert.ok(colorCounts['2'] > 0, 'Color 2 should be used');
  assert.ok(colorCounts['3'] > 0, 'Color 3 should be used');
  
  console.log('\n✅ All colors are properly attached to triangles!');
});

test('All layers start at Z=0 (not stacked)', async () => {
  const testFile = '/tmp/playwright-logs/model.3mf';
  
  if (!fs.existsSync(testFile)) {
    console.log('⚠️  No test 3MF file found');
    return;
  }
  
  const data = fs.readFileSync(testFile);
  const zip = await JSZip.loadAsync(data);
  const modelXml = await zip.file('3D/3dmodel.model').async('string');
  
  // Extract all Z coordinates
  const zMatches = modelXml.match(/z="([^"]+)"/g);
  const zValues = new Set();
  zMatches.forEach(z => {
    const match = z.match(/z="([^"]+)"/);
    if (match) {
      zValues.add(parseFloat(match[1]));
    }
  });
  
  const sortedZ = Array.from(zValues).sort((a, b) => a - b);
  console.log(`Found Z values: ${sortedZ.join(', ')}`);
  
  // Should only have 2 Z values: 0 and the layer height
  assert.ok(sortedZ.length <= 2, 'Should have at most 2 Z values (base and top)');
  assert.strictEqual(sortedZ[0], 0, 'Minimum Z should be 0');
  
  // Max Z should be around 0.5 (the layer height), not 2.0 (which would indicate stacking)
  assert.ok(sortedZ[sortedZ.length - 1] <= 1.0, 'Max Z should be <= 1.0 (not stacked)');
  
  console.log('✓ All layers start at Z=0');
  console.log(`✓ Layer height is ${sortedZ[sortedZ.length - 1]}mm`);
  console.log('\n✅ Layers are NOT stacked - all start at Z=0 as required!');
});

console.log('Running color and Z-plane validation tests...\n');
