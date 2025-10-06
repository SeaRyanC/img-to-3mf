const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const JSZip = require('jszip');

test('3MF has separate objects for each color (Bambu Studio compatible)', async () => {
  const testFile = '/tmp/playwright-logs/model.3mf';
  
  if (!fs.existsSync(testFile)) {
    console.log('⚠️  No test 3MF file found');
    return;
  }
  
  const data = fs.readFileSync(testFile);
  const zip = await JSZip.loadAsync(data);
  const modelXml = await zip.file('3D/3dmodel.model').async('string');
  
  // Check that we have multiple objects
  const objectMatches = modelXml.match(/<object id="(\d+)" type="model" pid="1" p1="(\d+)">/g);
  assert.ok(objectMatches, 'Should have objects defined');
  assert.ok(objectMatches.length >= 4, 'Should have at least 4 separate objects (one per color)');
  
  console.log(`✓ Found ${objectMatches.length} separate objects`);
  
  // Extract object IDs and their color assignments
  const objects = [];
  objectMatches.forEach(match => {
    const idMatch = match.match(/id="(\d+)"/);
    const colorMatch = match.match(/p1="(\d+)"/);
    if (idMatch && colorMatch) {
      objects.push({ id: parseInt(idMatch[1]), colorIndex: parseInt(colorMatch[1]) });
    }
  });
  
  console.log('Objects:');
  objects.forEach(obj => {
    console.log(`  Object ID ${obj.id}: Color ${obj.colorIndex}`);
  });
  
  // Verify each object has a unique color
  const colorIndices = objects.map(o => o.colorIndex);
  const uniqueColors = new Set(colorIndices);
  assert.strictEqual(uniqueColors.size, colorIndices.length, 'Each object should have a unique color');
  
  // Check build items reference all objects
  const buildItemMatches = modelXml.match(/<item objectid="(\d+)" \/>/g);
  assert.ok(buildItemMatches, 'Should have build items');
  assert.strictEqual(buildItemMatches.length, objects.length, 'Should have one build item per object');
  
  console.log(`✓ Found ${buildItemMatches.length} build items`);
  
  // Verify triangles don't have per-triangle color (p1 attribute)
  const triangleWithColorMatches = modelXml.match(/<triangle[^>]+p1=/g);
  assert.strictEqual(triangleWithColorMatches, null, 'Triangles should NOT have p1 attribute (color is on object level)');
  
  console.log('✓ Triangles do not have per-triangle color attributes');
  
  // Verify triangles exist
  const triangleMatches = modelXml.match(/<triangle v1="\d+" v2="\d+" v3="\d+" \/>/g);
  assert.ok(triangleMatches, 'Should have triangles');
  assert.ok(triangleMatches.length > 0, 'Should have at least some triangles');
  
  console.log(`✓ Found ${triangleMatches.length} triangles across all objects`);
  
  console.log('\n✅ 3MF structure is Bambu Studio compatible with separate objects per color!');
});

console.log('Running Bambu Studio compatibility test...\n');
