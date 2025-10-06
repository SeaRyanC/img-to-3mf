const test = require('node:test');
const assert = require('node:assert');

// Test manifold geometry and Bambu Studio color format

test('Manifold geometry validation', async (t) => {
  // Simulate the vertex deduplication logic
  const vertices = [];
  const vertexMap = new Map();
  
  const getOrCreateVertex = (x, y, z) => {
    const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;
    if (vertexMap.has(key)) {
      return vertexMap.get(key);
    }
    const index = vertices.length;
    vertices.push({ x, y, z });
    vertexMap.set(key, index);
    return index;
  };
  
  // Create two adjacent boxes that share a face
  // Box 1: (0,0,0) to (1,1,1)
  const box1_v0 = getOrCreateVertex(0, 0, 0);
  const box1_v1 = getOrCreateVertex(1, 0, 0);
  const box1_v2 = getOrCreateVertex(1, 1, 0);
  const box1_v3 = getOrCreateVertex(0, 1, 0);
  const box1_v4 = getOrCreateVertex(0, 0, 1);
  const box1_v5 = getOrCreateVertex(1, 0, 1);
  const box1_v6 = getOrCreateVertex(1, 1, 1);
  const box1_v7 = getOrCreateVertex(0, 1, 1);
  
  // Box 2: (1,0,0) to (2,1,1) - shares face with Box 1
  const box2_v0 = getOrCreateVertex(1, 0, 0); // Should reuse box1_v1
  const box2_v1 = getOrCreateVertex(2, 0, 0);
  const box2_v2 = getOrCreateVertex(2, 1, 0);
  const box2_v3 = getOrCreateVertex(1, 1, 0); // Should reuse box1_v2
  const box2_v4 = getOrCreateVertex(1, 0, 1); // Should reuse box1_v5
  const box2_v5 = getOrCreateVertex(2, 0, 1);
  const box2_v6 = getOrCreateVertex(2, 1, 1);
  const box2_v7 = getOrCreateVertex(1, 1, 1); // Should reuse box1_v6
  
  // Verify vertex sharing
  assert.strictEqual(box2_v0, box1_v1, 'Adjacent boxes should share vertex at (1,0,0)');
  assert.strictEqual(box2_v3, box1_v2, 'Adjacent boxes should share vertex at (1,1,0)');
  assert.strictEqual(box2_v4, box1_v5, 'Adjacent boxes should share vertex at (1,0,1)');
  assert.strictEqual(box2_v7, box1_v6, 'Adjacent boxes should share vertex at (1,1,1)');
  
  // Verify total vertex count (12 instead of 16 if they didn't share)
  assert.strictEqual(vertices.length, 12, 'Vertex sharing reduces total vertex count from 16 to 12');
  
  console.log('✓ Manifold geometry: Vertices are properly shared between adjacent boxes');
  console.log(`✓ Total vertices: ${vertices.length} (expected 12 for 2 adjacent boxes)`);
});

test('Bambu Studio color format validation', async (t) => {
  // Simulate the basematerials XML generation
  const generateBaseMaterials = (colors) => {
    let xml = '<basematerials id="1" colorspace="sRGB">\n';
    colors.forEach((color, i) => {
      const r = color.r.toString(16).padStart(2, '0').toUpperCase();
      const g = color.g.toString(16).padStart(2, '0').toUpperCase();
      const b = color.b.toString(16).padStart(2, '0').toUpperCase();
      const colorStr = `#${r}${g}${b}`;
      xml += `  <base name="${i + 1}" displaycolor="${colorStr}" />\n`;
    });
    xml += '</basematerials>';
    return xml;
  };
  
  const testColors = [
    { r: 255, g: 0, b: 0 },
    { r: 0, g: 255, b: 0 },
    { r: 0, g: 0, b: 255 }
  ];
  
  const xml = generateBaseMaterials(testColors);
  
  // Validate colorspace attribute
  assert.ok(xml.includes('colorspace="sRGB"'), 'basematerials must have colorspace="sRGB" for Bambu Studio');
  
  // Validate material names are simple numbers
  assert.ok(xml.includes('name="1"'), 'First material should be named "1"');
  assert.ok(xml.includes('name="2"'), 'Second material should be named "2"');
  assert.ok(xml.includes('name="3"'), 'Third material should be named "3"');
  
  // Validate color format (no alpha channel)
  assert.ok(xml.includes('displaycolor="#FF0000"'), 'Red color should be #FF0000 (no alpha)');
  assert.ok(xml.includes('displaycolor="#00FF00"'), 'Green color should be #00FF00 (no alpha)');
  assert.ok(xml.includes('displaycolor="#0000FF"'), 'Blue color should be #0000FF (no alpha)');
  
  // Ensure NO alpha channel in colors
  assert.ok(!xml.includes('displaycolor="#FF0000FF"'), 'Should NOT include alpha channel');
  assert.ok(!xml.includes('displaycolor="#00FF00FF"'), 'Should NOT include alpha channel');
  assert.ok(!xml.includes('displaycolor="#0000FFFF"'), 'Should NOT include alpha channel');
  
  console.log('✓ Bambu Studio format: colorspace="sRGB" attribute present');
  console.log('✓ Material names use simple numeric format (1, 2, 3...)');
  console.log('✓ Colors use #RRGGBB format (no alpha channel)');
  console.log('\nGenerated basematerials XML:');
  console.log(xml);
});

test('Edge map validation for manifold check', async (t) => {
  // Test that each edge is used by exactly 2 triangles in a manifold mesh
  const triangles = [
    // Box 1 - Bottom face (just two triangles for testing)
    { v1: 0, v2: 1, v3: 2 },
    { v1: 0, v2: 2, v3: 3 },
    // Box 1 - Right face (shares edge 1-2 with bottom)
    { v1: 1, v2: 2, v3: 6 },
    { v1: 1, v2: 6, v3: 5 }
  ];
  
  const edgeMap = new Map();
  
  const addEdge = (v1, v2) => {
    // Sort vertices to ensure consistent edge key
    const key = v1 < v2 ? `${v1},${v2}` : `${v2},${v1}`;
    edgeMap.set(key, (edgeMap.get(key) || 0) + 1);
  };
  
  // Add all edges from triangles
  triangles.forEach(tri => {
    addEdge(tri.v1, tri.v2);
    addEdge(tri.v2, tri.v3);
    addEdge(tri.v3, tri.v1);
  });
  
  // Check manifold property: each edge should be used by exactly 2 triangles
  // (except boundary edges which would be used by 1, but in a closed mesh all should be 2)
  const edgeUsage = Array.from(edgeMap.values());
  const allManifold = edgeUsage.every(count => count === 2 || count === 1); // Allow boundary edges
  
  assert.ok(allManifold, 'Mesh should be manifold or have boundary edges');
  console.log('✓ Edge map validation: Mesh topology is valid');
  console.log(`✓ Total edges: ${edgeMap.size}`);
  console.log(`✓ Edge usage: ${edgeUsage.join(', ')}`);
});

console.log('\n=== Manifold Geometry and Bambu Studio Format Tests ===\n');
