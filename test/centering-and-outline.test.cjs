// Test for centering at x=125, y=125 and outline detection
const { generate3MF } = require('../src/utils/3mfGenerator.ts');
const JSZip = require('jszip');

async function testCentering() {
  console.log('\n=== Testing Centering at x=125, y=125 ===');
  
  // Create a simple 4x4 test image
  const imageData = {
    width: 4,
    height: 4,
    data: new Uint8ClampedArray(4 * 4 * 4)
  };
  
  // Fill with a single color (red)
  for (let i = 0; i < imageData.data.length; i += 4) {
    imageData.data[i] = 255;     // R
    imageData.data[i + 1] = 0;   // G
    imageData.data[i + 2] = 0;   // B
    imageData.data[i + 3] = 255; // A
  }
  
  const config = {
    width: 20,  // 20mm width
    height: 20, // 20mm height
    colorHeights: [0.5],
    colors: [{ r: 255, g: 0, b: 0 }],
    imageData,
    showOnFront: true,
    transparencyKeyColor: null,
    detectOutline: false
  };
  
  const blob = await generate3MF(config);
  const arrayBuffer = await blob.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const modelXml = await zip.file('3D/3dmodel.model').async('text');
  
  // Parse vertices
  const vertexMatches = [...modelXml.matchAll(/vertex x="([\d.-]+)" y="([\d.-]+)" z="([\d.-]+)"/g)];
  const xValues = vertexMatches.map(m => parseFloat(m[1]));
  const yValues = vertexMatches.map(m => parseFloat(m[2]));
  
  // Calculate bounds
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  
  console.log(`  Model bounds: X[${minX.toFixed(2)}, ${maxX.toFixed(2)}], Y[${minY.toFixed(2)}, ${maxY.toFixed(2)}]`);
  console.log(`  Calculated center: (${centerX.toFixed(2)}, ${centerY.toFixed(2)})`);
  console.log(`  Expected center: (125.00, 125.00)`);
  
  const tolerance = 0.1;
  if (Math.abs(centerX - 125) < tolerance && Math.abs(centerY - 125) < tolerance) {
    console.log('  ✓ Model is correctly centered at x=125, y=125');
    return true;
  } else {
    console.log(`  ✗ Model center is off by X:${(centerX - 125).toFixed(2)}, Y:${(centerY - 125).toFixed(2)}`);
    return false;
  }
}

async function testOutlineDetection() {
  console.log('\n=== Testing Outline Detection ===');
  
  // Create a 10x10 image with white border and red center
  const imageData = {
    width: 10,
    height: 10,
    data: new Uint8ClampedArray(10 * 10 * 4)
  };
  
  // Fill all with white
  for (let i = 0; i < imageData.data.length; i += 4) {
    imageData.data[i] = 255;     // R
    imageData.data[i + 1] = 255; // G
    imageData.data[i + 2] = 255; // B
    imageData.data[i + 3] = 255; // A
  }
  
  // Fill center 6x6 with red
  for (let y = 2; y < 8; y++) {
    for (let x = 2; x < 8; x++) {
      const i = (y * 10 + x) * 4;
      imageData.data[i] = 255;     // R
      imageData.data[i + 1] = 0;   // G
      imageData.data[i + 2] = 0;   // B
      imageData.data[i + 3] = 255; // A
    }
  }
  
  const config = {
    width: 50,
    height: 50,
    colorHeights: [0.5, 0.5],
    colors: [{ r: 255, g: 255, b: 255 }, { r: 255, g: 0, b: 0 }],
    imageData,
    showOnFront: true,
    transparencyKeyColor: null,
    detectOutline: true  // Enable outline detection
  };
  
  const blob = await generate3MF(config);
  const arrayBuffer = await blob.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const modelXml = await zip.file('3D/3dmodel.model').async('text');
  
  // Count objects
  const objectMatches = [...modelXml.matchAll(/<object id="(\d+)"/g)];
  const objectCount = objectMatches.length;
  
  console.log(`  Found ${objectCount} object(s)`);
  
  // With outline detection, white border should be treated as transparent
  // So we should only have 1 object (red center)
  if (objectCount === 1) {
    console.log('  ✓ Outline detection working - white border treated as transparent');
    return true;
  } else {
    console.log('  ✗ Expected 1 object (red only), but found', objectCount);
    return false;
  }
}

async function runTests() {
  console.log('Testing Centering and Outline Detection Features');
  console.log('================================================');
  
  const results = [];
  
  try {
    results.push(await testCentering());
  } catch (err) {
    console.log('  ✗ Test failed:', err.message);
    results.push(false);
  }
  
  try {
    results.push(await testOutlineDetection());
  } catch (err) {
    console.log('  ✗ Test failed:', err.message);
    results.push(false);
  }
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log('\n================================================');
  console.log(`Tests passed: ${passed}/${total}`);
  
  if (passed === total) {
    console.log('✓ All tests passed!');
    process.exit(0);
  } else {
    console.log('✗ Some tests failed');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
