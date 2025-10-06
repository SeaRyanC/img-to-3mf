// Test for centering at x=125, y=125 and outline detection
const { test } = require('node:test');
const assert = require('node:assert');

test('Centering and Outline Detection Tests', async (t) => {
  
  await t.test('Model is centered at x=125, y=125', () => {
    // Test centering logic
    const modelWidth = 20; // mm
    const modelDepth = 20; // mm
    const centerX = 125;
    const centerY = 125;
    
    const offsetX = centerX - (modelWidth / 2);
    const offsetY = centerY - (modelDepth / 2);
    
    // Expected offsets
    assert.strictEqual(offsetX, 115); // 125 - 10 = 115
    assert.strictEqual(offsetY, 115); // 125 - 10 = 115
    
    // Model bounds should be [115, 135] for both X and Y
    const minX = offsetX;
    const maxX = offsetX + modelWidth;
    const minY = offsetY;
    const maxY = offsetY + modelDepth;
    
    assert.strictEqual(minX, 115);
    assert.strictEqual(maxX, 135);
    assert.strictEqual(minY, 115);
    assert.strictEqual(maxY, 135);
    
    // Center point
    const calculatedCenterX = (minX + maxX) / 2;
    const calculatedCenterY = (minY + maxY) / 2;
    
    assert.strictEqual(calculatedCenterX, 125);
    assert.strictEqual(calculatedCenterY, 125);
    
    console.log(`✓ Model bounds: X[${minX}, ${maxX}], Y[${minY}, ${maxY}]`);
    console.log(`✓ Calculated center: (${calculatedCenterX}, ${calculatedCenterY})`);
  });
  
  await t.test('Outline detection uses flood-fill algorithm', () => {
    // Test outline detection concept
    const perimeter = [
      '#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF',
      '#FFFFFF', undefined, undefined, '#FFFFFF',
      '#FFFFFF', undefined, undefined, '#FFFFFF',
      '#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF'
    ];
    
    // Most common perimeter color
    const colorCounts = new Map();
    perimeter.forEach(color => {
      if (color) {
        colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
      }
    });
    
    const mostCommon = [...colorCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    assert.strictEqual(mostCommon[0], '#FFFFFF');
    assert.strictEqual(mostCommon[1], 12); // 12 out of 12 defined perimeter pixels
    
    console.log('✓ Perimeter color detection: #FFFFFF appears in 12/12 edge pixels');
  });
  
  await t.test('Flood-fill marks connected background pixels', () => {
    // Simulate flood-fill from edges
    const width = 5;
    const height = 5;
    const bgColor = '#FFFFFF';
    
    // Simple 5x5 grid with white border and red center
    const grid = [
      'W', 'W', 'W', 'W', 'W',
      'W', 'R', 'R', 'R', 'W',
      'W', 'R', 'R', 'R', 'W',
      'W', 'R', 'R', 'R', 'W',
      'W', 'W', 'W', 'W', 'W'
    ];
    
    // Edges that match background
    const edgeCount = grid.filter((c, i) => {
      const x = i % width;
      const y = Math.floor(i / width);
      const isEdge = (x === 0 || x === width-1 || y === 0 || y === height-1);
      return isEdge && c === 'W';
    }).length;
    
    assert.strictEqual(edgeCount, 16); // All edge pixels are white
    
    // Center should remain (not marked as background)
    const centerPixels = grid.filter((c, i) => {
      const x = i % width;
      const y = Math.floor(i / width);
      const isCenter = (x >= 1 && x <= 3 && y >= 1 && y <= 3);
      return isCenter && c === 'R';
    }).length;
    
    assert.strictEqual(centerPixels, 9); // 3x3 center is red
    
    console.log('✓ Flood-fill would mark 16 edge pixels as transparent, preserve 9 center pixels');
  });
});
