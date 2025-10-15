export interface Mesh {
  vertices: number[];
  triangles: number[];
}

export function createLayerMesh(
  imageData: ImageData,
  width: number,
  height: number,
  _depth: number,
  layerHeight: number
): Mesh {
  const imgWidth = imageData.width;
  const imgHeight = imageData.height;
  const scaleX = width / imgWidth;
  const scaleY = height / imgHeight;
  
  const vertices: number[] = [];
  const triangles: number[] = [];
  const vertexMap = new Map<string, number>();
  
  let vertexIndex = 0;
  
  function addVertex(x: number, y: number, z: number): number {
    const key = `${x},${y},${z}`;
    if (vertexMap.has(key)) {
      return vertexMap.get(key)!;
    }
    vertices.push(x, y, z);
    vertexMap.set(key, vertexIndex);
    return vertexIndex++;
  }
  
  // Create a mesh for each white region
  for (let py = 0; py < imgHeight - 1; py++) {
    for (let px = 0; px < imgWidth - 1; px++) {
      const idx = (py * imgWidth + px) * 4;
      const isWhite = imageData.data[idx] > 128 && imageData.data[idx + 3] > 128;
      
      if (!isWhite) continue;
      
      const x0 = px * scaleX;
      const y0 = py * scaleY;
      const x1 = (px + 1) * scaleX;
      const y1 = (py + 1) * scaleY;
      
      // Bottom face (z=0)
      const v0 = addVertex(x0, y0, 0);
      const v1 = addVertex(x1, y0, 0);
      const v2 = addVertex(x1, y1, 0);
      const v3 = addVertex(x0, y1, 0);
      
      // Top face (z=layerHeight)
      const v4 = addVertex(x0, y0, layerHeight);
      const v5 = addVertex(x1, y0, layerHeight);
      const v6 = addVertex(x1, y1, layerHeight);
      const v7 = addVertex(x0, y1, layerHeight);
      
      // Bottom face triangles
      triangles.push(v0, v2, v1);
      triangles.push(v0, v3, v2);
      
      // Top face triangles
      triangles.push(v4, v5, v6);
      triangles.push(v4, v6, v7);
      
      // Side faces
      triangles.push(v0, v1, v5);
      triangles.push(v0, v5, v4);
      
      triangles.push(v1, v2, v6);
      triangles.push(v1, v6, v5);
      
      triangles.push(v2, v3, v7);
      triangles.push(v2, v7, v6);
      
      triangles.push(v3, v0, v4);
      triangles.push(v3, v4, v7);
    }
  }
  
  return { vertices, triangles };
}

export function createBackplateMesh(
  width: number,
  height: number,
  thickness: number
): Mesh {
  const vertices = [
    // Bottom face
    0, 0, -thickness,
    width, 0, -thickness,
    width, height, -thickness,
    0, height, -thickness,
    // Top face
    0, 0, 0,
    width, 0, 0,
    width, height, 0,
    0, height, 0
  ];
  
  const triangles = [
    // Bottom face
    0, 2, 1,
    0, 3, 2,
    // Top face
    4, 5, 6,
    4, 6, 7,
    // Sides
    0, 1, 5,
    0, 5, 4,
    1, 2, 6,
    1, 6, 5,
    2, 3, 7,
    2, 7, 6,
    3, 0, 4,
    3, 4, 7
  ];
  
  return { vertices, triangles };
}
