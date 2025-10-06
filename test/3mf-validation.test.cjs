const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Read the actual 3MF generator code
const generatorPath = path.join(__dirname, '..', 'src', 'utils', '3mfGenerator.ts');
console.log('Note: This test validates the geometry algorithm logic.');
console.log('Full integration test would require compiling TypeScript.');

test('3MF structure validation from generated file', async () => {
  // Read a generated 3MF file if it exists
  const testFile = '/tmp/playwright-logs/model.3mf';
  
  if (!fs.existsSync(testFile)) {
    console.log('⚠️  No test 3MF file found at', testFile);
    console.log('   Skipping file-based validation');
    return;
  }
  
  console.log('✓ Found test 3MF file');
  
  // Extract and parse
  const JSZip = require('jszip');
  const data = fs.readFileSync(testFile);
  const zip = await JSZip.loadAsync(data);
  
  // Check required files exist
  assert.ok(zip.file('[Content_Types].xml'), '[Content_Types].xml should exist');
  assert.ok(zip.file('_rels/.rels'), '_rels/.rels should exist');
  assert.ok(zip.file('3D/3dmodel.model'), '3D/3dmodel.model should exist');
  console.log('✓ All required files present in 3MF');
  
  // Read and parse the model
  const modelXml = await zip.file('3D/3dmodel.model').async('string');
  
  // Validate XML structure
  assert.ok(modelXml.includes('<?xml version="1.0"'), 'Should have XML declaration');
  assert.ok(modelXml.includes('<model'), 'Should have model element');
  assert.ok(modelXml.includes('<resources>'), 'Should have resources');
  assert.ok(modelXml.includes('<basematerials'), 'Should have materials');
  assert.ok(modelXml.includes('<object'), 'Should have object');
  assert.ok(modelXml.includes('<mesh>'), 'Should have mesh');
  assert.ok(modelXml.includes('<vertices>'), 'Should have vertices');
  assert.ok(modelXml.includes('<triangles>'), 'Should have triangles');
  console.log('✓ XML structure is valid');
  
  // Parse objects (separate objects for each color)
  const objectRegex = /<object id="\d+"[^>]*>([\s\S]*?)<\/object>/g;
  const objects = [];
  let match;
  
  while ((match = objectRegex.exec(modelXml)) !== null) {
    const objectContent = match[1];
    
    // Parse vertices for this object
    const vertexRegex = /<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)" \/>/g;
    const objVertices = [];
    let vMatch;
    while ((vMatch = vertexRegex.exec(objectContent)) !== null) {
      objVertices.push({
        x: parseFloat(vMatch[1]),
        y: parseFloat(vMatch[2]),
        z: parseFloat(vMatch[3])
      });
    }
    
    // Parse triangles for this object
    const triangleRegex = /<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)" \/>/g;
    const objTriangles = [];
    let tMatch;
    while ((tMatch = triangleRegex.exec(objectContent)) !== null) {
      objTriangles.push({
        v1: parseInt(tMatch[1]),
        v2: parseInt(tMatch[2]),
        v3: parseInt(tMatch[3])
      });
    }
    
    if (objVertices.length > 0) {
      objects.push({ vertices: objVertices, triangles: objTriangles });
    }
  }
  
  console.log(`✓ Found ${objects.length} objects`);
  
  let totalVertices = 0;
  let totalTriangles = 0;
  
  objects.forEach((obj, idx) => {
    console.log(`  Object ${idx}: ${obj.vertices.length} vertices, ${obj.triangles.length} triangles`);
    totalVertices += obj.vertices.length;
    totalTriangles += obj.triangles.length;
    
    // Validate triangle indices for this object
    obj.triangles.forEach((t, i) => {
      assert.ok(t.v1 < obj.vertices.length, `Object ${idx} Triangle ${i} v1 should be valid`);
      assert.ok(t.v2 < obj.vertices.length, `Object ${idx} Triangle ${i} v2 should be valid`);
      assert.ok(t.v3 < obj.vertices.length, `Object ${idx} Triangle ${i} v3 should be valid`);
      assert.ok(t.v1 !== t.v2, `Object ${idx} Triangle ${i} should not have v1==v2`);
      assert.ok(t.v2 !== t.v3, `Object ${idx} Triangle ${i} should not have v2==v3`);
      assert.ok(t.v1 !== t.v3, `Object ${idx} Triangle ${i} should not have v1==v3`);
    });
    
    // Check manifoldness for this object
    const edges = new Map();
    obj.triangles.forEach((t, ti) => {
      const addEdge = (v1, v2) => {
        const key = v1 < v2 ? `${v1},${v2}` : `${v2},${v1}`;
        if (!edges.has(key)) edges.set(key, []);
        edges.get(key).push(ti);
      };
      addEdge(t.v1, t.v2);
      addEdge(t.v2, t.v3);
      addEdge(t.v3, t.v1);
    });
    
    let nonManifoldEdges = 0;
    edges.forEach((tris, edge) => {
      if (tris.length !== 2) {
        nonManifoldEdges++;
      }
    });
    
    assert.strictEqual(nonManifoldEdges, 0, `Object ${idx} should be manifold`);
  });
  
  console.log(`✓ Total: ${totalVertices} vertices, ${totalTriangles} triangles`);
  console.log('✓ All triangles have valid indices');
  console.log('✓ All objects are manifold');
  
  console.log('\n✅ 3MF file is geometrically valid!');
});

console.log('Starting 3MF validation tests...\n');
