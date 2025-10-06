const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const JSZip = require('jszip');

// Import the 3MF generator (we'll need to generate a test file)
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

test('Smooth geometry is manifold', async () => {
  console.log('\n=== Testing Smooth Geometry Manifold ===\n');
  
  // Create test using TypeScript compilation
  const testCode = `
import { generate3MF } from './src/utils/3mfGenerator';

const imageData = {
  width: 2,
  height: 2,
  data: new Uint8ClampedArray([
    255, 0, 0, 255,  // red
    255, 0, 0, 255,  // red
    0, 0, 255, 255,  // blue
    0, 0, 255, 255   // blue
  ])
};

const config = {
  width: 10,
  height: 10,
  colorHeights: [0.5, 0.5],
  colors: [{r: 255, g: 0, b: 0}, {r: 0, g: 0, b: 255}],
  imageData: imageData as ImageData,
  showOnFront: true,
  transparencyKeyColor: null,
  detectOutline: false,
  useSmoothing: true  // ENABLE SMOOTHING
};

generate3MF(config).then(async (blob) => {
  const buffer = Buffer.from(await blob.arrayBuffer());
  require('fs').writeFileSync('/tmp/smooth_test.3mf', buffer);
  console.log('✓ Generated smooth 3MF file');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
`;
  
  fs.writeFileSync('/tmp/test_smooth.ts', testCode);
  
  try {
    // Compile and run TypeScript
    await execAsync('cd /home/runner/work/img-to-3mf/img-to-3mf && npx tsx /tmp/test_smooth.ts');
    
    // Load and analyze the generated 3MF
    const zipData = fs.readFileSync('/tmp/smooth_test.3mf');
    const zip = await JSZip.loadAsync(zipData);
    const modelXml = await zip.file('3D/3dmodel.model').async('string');
    
    console.log('Analyzing smooth geometry manifold properties...\n');
    
    // Parse triangles from XML
    const triangleMatches = [...modelXml.matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"/g)];
    console.log(`Found ${triangleMatches.length} triangles`);
    
    // Build edge map
    const edgeMap = new Map();
    triangleMatches.forEach(match => {
      const v1 = parseInt(match[1]);
      const v2 = parseInt(match[2]);
      const v3 = parseInt(match[3]);
      
      const edges = [
        [v1, v2].sort((a, b) => a - b).join(','),
        [v2, v3].sort((a, b) => a - b).join(','),
        [v3, v1].sort((a, b) => a - b).join(',')
      ];
      
      edges.forEach(edge => {
        edgeMap.set(edge, (edgeMap.get(edge) || 0) + 1);
      });
    });
    
    console.log(`Total unique edges: ${edgeMap.size}\n`);
    
    // Check manifold property
    const nonManifoldEdges = [];
    for (const [edge, count] of edgeMap.entries()) {
      if (count !== 2) {
        nonManifoldEdges.push({ edge, count });
      }
    }
    
    if (nonManifoldEdges.length > 0) {
      console.log('❌ NOT MANIFOLD! Non-manifold edges:');
      nonManifoldEdges.forEach(({ edge, count }) => {
        console.log(`  Edge ${edge}: used ${count} times (should be 2)`);
      });
      assert.fail('Smooth geometry is not manifold');
    } else {
      console.log('✅ MANIFOLD! All edges shared by exactly 2 triangles');
      assert.ok(true, 'Smooth geometry is manifold');
    }
    
  } catch (error) {
    console.error('Error during test:', error);
    throw error;
  }
});

test('Bambu Studio XML format is correct', async () => {
  console.log('\n=== Testing Bambu Studio XML Format ===\n');
  
  // Use the test file from previous test
  if (!fs.existsSync('/tmp/smooth_test.3mf')) {
    console.log('Skipping - test file not generated');
    return;
  }
  
  const zipData = fs.readFileSync('/tmp/smooth_test.3mf');
  const zip = await JSZip.loadAsync(zipData);
  const modelXml = await zip.file('3D/3dmodel.model').async('string');
  
  console.log('Checking Bambu Studio required attributes...\n');
  
  // Check for unit="millimeter" attribute
  if (modelXml.includes('unit="millimeter"')) {
    console.log('✅ Has unit="millimeter" attribute');
    assert.ok(true);
  } else {
    console.log('❌ Missing unit="millimeter" attribute');
    assert.fail('Missing unit attribute');
  }
  
  // Check for xml:lang attribute
  if (modelXml.includes('xml:lang="en-US"')) {
    console.log('✅ Has xml:lang="en-US" attribute');
    assert.ok(true);
  } else {
    console.log('⚠️  Missing xml:lang attribute (optional but recommended)');
  }
  
  // Check for colorspace="sRGB"
  if (modelXml.includes('colorspace="sRGB"')) {
    console.log('✅ Has colorspace="sRGB" attribute (REQUIRED for color recognition)');
    assert.ok(true);
  } else {
    console.log('❌ Missing colorspace="sRGB" attribute');
    assert.fail('Missing colorspace attribute');
  }
  
  // Check object type attribute
  if (modelXml.includes('type="model"')) {
    console.log('✅ Objects have type="model" attribute');
    assert.ok(true);
  } else {
    console.log('⚠️  Objects missing type="model" attribute');
  }
  
  // Check for proper namespace
  if (modelXml.includes('xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"')) {
    console.log('✅ Has correct XML namespace');
    assert.ok(true);
  } else {
    console.log('❌ Missing or incorrect XML namespace');
    assert.fail('Missing XML namespace');
  }
  
  // Check material references use pindex
  if (modelXml.includes('pindex=')) {
    console.log('✅ Objects use pindex for material references');
    assert.ok(true);
  } else {
    console.log('❌ Objects missing pindex attribute');
    assert.fail('Missing pindex');
  }
  
  console.log('\n✅ All Bambu Studio format requirements met!');
});
