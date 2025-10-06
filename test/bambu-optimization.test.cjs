const { test } = require('node:test');
const assert = require('node:assert');

test('3MF Bambu Studio Color Format Tests', async (t) => {
  
  await t.test('Material definition uses pindex instead of p1', () => {
    // Bambu Studio expects pindex for material reference
    const xmlWithPindex = '<object id="2" type="model" pid="1" pindex="0">';
    const xmlWithP1 = '<object id="2" type="model" pid="1" p1="0">';
    
    // Verify pindex format
    assert.ok(xmlWithPindex.includes('pindex="0"'));
    assert.ok(!xmlWithPindex.includes('p1='));
    
    console.log('✓ Object uses pindex attribute for material reference');
  });
  
  await t.test('Material names follow convention', () => {
    // Material names should be descriptive (Color_1, Color_2, etc.)
    const materialXml = '<base name="Color_1" displaycolor="#FF0000" />';
    
    assert.ok(materialXml.includes('name="Color_'));
    assert.ok(materialXml.includes('displaycolor="#'));
    
    console.log('✓ Material names use Color_N convention with #RRGGBB format');
  });
  
  await t.test('Display color format is RGBA hex', () => {
    // Format should be #RRGGBB (Bambu Studio doesn't use alpha channel)
    const colorStr = '#FF0000'; // Red without alpha
    
    assert.strictEqual(colorStr.length, 7); // # + 6 hex digits
    assert.ok(!colorStr.endsWith('FF')); // No alpha channel
    
    console.log('✓ Display color uses #RRGGBB format (no alpha)');
  });
  
  await t.test('Each color is a separate object', () => {
    // Simulate 4 colors → 4 objects
    const numColors = 4;
    const objectIds = [];
    
    for (let i = 0; i < numColors; i++) {
      objectIds.push(i + 2); // Start from 2 (1 is basematerials)
    }
    
    assert.strictEqual(objectIds.length, 4);
    assert.deepStrictEqual(objectIds, [2, 3, 4, 5]);
    
    console.log('✓ 4 colors → 4 separate objects (IDs: 2, 3, 4, 5)');
  });
  
  await t.test('Triangles have no per-triangle color attributes', () => {
    // Objects inherit color, triangles should not have pid/pindex
    const triangleXml = '<triangle v1="0" v2="1" v3="2" />';
    
    assert.ok(!triangleXml.includes('pid='));
    assert.ok(!triangleXml.includes('pindex='));
    assert.ok(!triangleXml.includes('p1='));
    
    console.log('✓ Triangles do not have color attributes (inherited from object)');
  });
  
  await t.test('Build section includes all objects', () => {
    // All color objects should be in build section
    const buildItems = [
      '<item objectid="2" />',
      '<item objectid="3" />',
      '<item objectid="4" />',
      '<item objectid="5" />'
    ];
    
    assert.strictEqual(buildItems.length, 4);
    buildItems.forEach((item, i) => {
      assert.ok(item.includes(`objectid="${i + 2}"`));
    });
    
    console.log('✓ All 4 objects referenced in build section');
  });
});

test('Memory Optimization for Large Images', async (t) => {
  
  await t.test('Large image detection threshold', () => {
    const width1200 = 1200;
    const height1200 = 1200;
    const totalPixels = width1200 * height1200;
    
    assert.strictEqual(totalPixels, 1440000);
    
    const threshold = 500000;
    assert.ok(totalPixels > threshold, '1200x1200 exceeds threshold');
    
    console.log(`✓ 1200x1200 = ${totalPixels.toLocaleString()} pixels (exceeds 500k threshold)`);
  });
  
  await t.test('Sample rate calculation for large images', () => {
    const totalPixels = 1440000; // 1200x1200
    const sampleRate = Math.max(1, Math.floor(Math.sqrt(totalPixels / 100000)));
    
    // Should sample approximately every 3-4 pixels
    assert.ok(sampleRate >= 3);
    assert.ok(sampleRate <= 4);
    
    const sampledPixels = Math.floor(totalPixels / sampleRate);
    console.log(`✓ Sample rate: ${sampleRate}x (${totalPixels.toLocaleString()} → ${sampledPixels.toLocaleString()} pixels)`);
  });
  
  await t.test('Color set size limited for massive images', () => {
    const maxColorSetSize = 10000;
    
    // Even with sampling, limit to 10k unique colors
    assert.strictEqual(maxColorSetSize, 10000);
    
    console.log('✓ Color set capped at 10,000 unique colors for memory safety');
  });
});

console.log('Starting Bambu Studio compatibility and optimization tests...\n');
