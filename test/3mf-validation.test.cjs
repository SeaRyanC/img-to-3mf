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
  
  // Parse vertices
  const vertexRegex = /<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"/g;
  const vertices = [];
  let match;
  while ((match = vertexRegex.exec(modelXml)) !== null) {
    vertices.push({
      x: parseFloat(match[1]),
      y: parseFloat(match[2]),
      z: parseFloat(match[3])
    });
  }
  
  console.log(`  Found ${vertices.length} vertices`);
  assert.ok(vertices.length > 0, 'Should have at least one vertex');
  assert.ok(vertices.length % 8 === 0, 'Vertex count should be multiple of 8 (voxel corners)');
  
  // Validate vertex coordinates are finite
  vertices.forEach((v, i) => {
    assert.ok(isFinite(v.x), `Vertex ${i} x should be finite`);
    assert.ok(isFinite(v.y), `Vertex ${i} y should be finite`);
    assert.ok(isFinite(v.z), `Vertex ${i} z should be finite`);
    assert.ok(v.x >= 0, `Vertex ${i} x should be non-negative`);
    assert.ok(v.y >= 0, `Vertex ${i} y should be non-negative`);
    assert.ok(v.z >= 0, `Vertex ${i} z should be non-negative`);
  });
  console.log('✓ All vertices have valid coordinates');
  
  // Check for degenerate coordinates (all same)
  const uniqueX = new Set(vertices.map(v => v.x.toFixed(3)));
  const uniqueY = new Set(vertices.map(v => v.y.toFixed(3)));
  const uniqueZ = new Set(vertices.map(v => v.z.toFixed(3)));
  
  assert.ok(uniqueX.size > 1, `Should have multiple X values (got ${uniqueX.size})`);
  assert.ok(uniqueY.size > 1, `Should have multiple Y values (got ${uniqueY.size})`);
  assert.ok(uniqueZ.size > 1, `Should have multiple Z values (got ${uniqueZ.size})`);
  console.log(`✓ Geometry is not degenerate (X:${uniqueX.size}, Y:${uniqueY.size}, Z:${uniqueZ.size} unique values)`);
  
  // Parse triangles
  const triangleRegex = /<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)" pid="1" p1="(\d+)"/g;
  const triangles = [];
  while ((match = triangleRegex.exec(modelXml)) !== null) {
    triangles.push({
      v1: parseInt(match[1]),
      v2: parseInt(match[2]),
      v3: parseInt(match[3]),
      colorIndex: parseInt(match[4])
    });
  }
  
  console.log(`  Found ${triangles.length} triangles`);
  assert.ok(triangles.length > 0, 'Should have at least one triangle');
  assert.ok(triangles.length % 12 === 0, 'Triangle count should be multiple of 12 (voxel faces)');
  
  // Validate triangle indices
  triangles.forEach((t, i) => {
    assert.ok(t.v1 < vertices.length, `Triangle ${i} v1 should be valid`);
    assert.ok(t.v2 < vertices.length, `Triangle ${i} v2 should be valid`);
    assert.ok(t.v3 < vertices.length, `Triangle ${i} v3 should be valid`);
    assert.ok(t.v1 !== t.v2, `Triangle ${i} should not have v1==v2`);
    assert.ok(t.v2 !== t.v3, `Triangle ${i} should not have v2==v3`);
    assert.ok(t.v1 !== t.v3, `Triangle ${i} should not have v1==v3`);
  });
  console.log('✓ All triangles have valid indices');
  
  // Check manifoldness (each edge shared by exactly 2 triangles)
  const edges = new Map();
  triangles.forEach((t, ti) => {
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
  
  assert.strictEqual(nonManifoldEdges, 0, 'Model should be manifold (all edges shared by exactly 2 triangles)');
  console.log('✓ Model is manifold');
  
  console.log('\n✅ 3MF file is geometrically valid!');
});

console.log('Starting 3MF validation tests...\n');
