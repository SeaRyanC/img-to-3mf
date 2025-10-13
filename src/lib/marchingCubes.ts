/**
 * Marching Cubes algorithm implementation
 */

import { VoxelVolume } from './voxelization';
import { edgeTable, triTable } from './marchingCubesTables';

export interface Mesh {
  vertices: number[];
  indices: number[];
  normals: number[];
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Apply Marching Cubes algorithm to generate a triangle mesh
 */
export function marchingCubes(
  volume: VoxelVolume,
  isoValue: number = 0.5,
  voxelSize: number = 0.1
): Mesh {
  const { width, height, depth, data } = volume;
  const vertices: number[] = [];
  const normals: number[] = [];
  const vertexMap = new Map<string, number>();
  
  // Process each cube
  for (let z = 0; z < depth - 1; z++) {
    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        processCube(
          data,
          width,
          height,
          depth,
          x,
          y,
          z,
          isoValue,
          voxelSize,
          vertices,
          normals,
          vertexMap
        );
      }
    }
  }
  
  // Create indices
  const indices: number[] = [];
  for (let i = 0; i < vertices.length / 3; i++) {
    indices.push(i);
  }
  
  return { vertices, indices, normals };
}

function processCube(
  data: Float32Array,
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
  isoValue: number,
  voxelSize: number,
  vertices: number[],
  normals: number[],
  vertexMap: Map<string, number>
) {
  // Get the 8 corner values
  const corners = [
    getValue(data, x, y, z, width, height, depth),
    getValue(data, x + 1, y, z, width, height, depth),
    getValue(data, x + 1, y, z + 1, width, height, depth),
    getValue(data, x, y, z + 1, width, height, depth),
    getValue(data, x, y + 1, z, width, height, depth),
    getValue(data, x + 1, y + 1, z, width, height, depth),
    getValue(data, x + 1, y + 1, z + 1, width, height, depth),
    getValue(data, x, y + 1, z + 1, width, height, depth),
  ];
  
  // Calculate cube index
  let cubeIndex = 0;
  for (let i = 0; i < 8; i++) {
    if (corners[i] < isoValue) {
      cubeIndex |= 1 << i;
    }
  }
  
  // Check if cube is entirely inside or outside
  if (edgeTable[cubeIndex] === 0) {
    return;
  }
  
  // Find vertices on edges
  const edgeVertices: Vector3[] = [];
  
  if (edgeTable[cubeIndex] & 1) {
    edgeVertices[0] = interpolateVertex(
      { x, y, z },
      { x: x + 1, y, z },
      corners[0],
      corners[1],
      isoValue
    );
  }
  if (edgeTable[cubeIndex] & 2) {
    edgeVertices[1] = interpolateVertex(
      { x: x + 1, y, z },
      { x: x + 1, y, z: z + 1 },
      corners[1],
      corners[2],
      isoValue
    );
  }
  if (edgeTable[cubeIndex] & 4) {
    edgeVertices[2] = interpolateVertex(
      { x: x + 1, y, z: z + 1 },
      { x, y, z: z + 1 },
      corners[2],
      corners[3],
      isoValue
    );
  }
  if (edgeTable[cubeIndex] & 8) {
    edgeVertices[3] = interpolateVertex(
      { x, y, z: z + 1 },
      { x, y, z },
      corners[3],
      corners[0],
      isoValue
    );
  }
  if (edgeTable[cubeIndex] & 16) {
    edgeVertices[4] = interpolateVertex(
      { x, y: y + 1, z },
      { x: x + 1, y: y + 1, z },
      corners[4],
      corners[5],
      isoValue
    );
  }
  if (edgeTable[cubeIndex] & 32) {
    edgeVertices[5] = interpolateVertex(
      { x: x + 1, y: y + 1, z },
      { x: x + 1, y: y + 1, z: z + 1 },
      corners[5],
      corners[6],
      isoValue
    );
  }
  if (edgeTable[cubeIndex] & 64) {
    edgeVertices[6] = interpolateVertex(
      { x: x + 1, y: y + 1, z: z + 1 },
      { x, y: y + 1, z: z + 1 },
      corners[6],
      corners[7],
      isoValue
    );
  }
  if (edgeTable[cubeIndex] & 128) {
    edgeVertices[7] = interpolateVertex(
      { x, y: y + 1, z: z + 1 },
      { x, y: y + 1, z },
      corners[7],
      corners[4],
      isoValue
    );
  }
  if (edgeTable[cubeIndex] & 256) {
    edgeVertices[8] = interpolateVertex(
      { x, y, z },
      { x, y: y + 1, z },
      corners[0],
      corners[4],
      isoValue
    );
  }
  if (edgeTable[cubeIndex] & 512) {
    edgeVertices[9] = interpolateVertex(
      { x: x + 1, y, z },
      { x: x + 1, y: y + 1, z },
      corners[1],
      corners[5],
      isoValue
    );
  }
  if (edgeTable[cubeIndex] & 1024) {
    edgeVertices[10] = interpolateVertex(
      { x: x + 1, y, z: z + 1 },
      { x: x + 1, y: y + 1, z: z + 1 },
      corners[2],
      corners[6],
      isoValue
    );
  }
  if (edgeTable[cubeIndex] & 2048) {
    edgeVertices[11] = interpolateVertex(
      { x, y, z: z + 1 },
      { x, y: y + 1, z: z + 1 },
      corners[3],
      corners[7],
      isoValue
    );
  }
  
  // Create triangles
  for (let i = 0; triTable[cubeIndex][i] !== -1; i += 3) {
    const v1 = edgeVertices[triTable[cubeIndex][i]];
    const v2 = edgeVertices[triTable[cubeIndex][i + 1]];
    const v3 = edgeVertices[triTable[cubeIndex][i + 2]];
    
    // Scale vertices by voxel size
    vertices.push(v1.x * voxelSize, v1.y * voxelSize, v1.z * voxelSize);
    vertices.push(v2.x * voxelSize, v2.y * voxelSize, v2.z * voxelSize);
    vertices.push(v3.x * voxelSize, v3.y * voxelSize, v3.z * voxelSize);
    
    // Calculate normal
    const normal = calculateNormal(v1, v2, v3);
    normals.push(normal.x, normal.y, normal.z);
    normals.push(normal.x, normal.y, normal.z);
    normals.push(normal.x, normal.y, normal.z);
  }
}

function getValue(
  data: Float32Array,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number
): number {
  if (x < 0 || x >= width || y < 0 || y >= height || z < 0 || z >= depth) {
    return 0;
  }
  return data[x + y * width + z * width * height];
}

function interpolateVertex(
  v1: Vector3,
  v2: Vector3,
  val1: number,
  val2: number,
  isoValue: number
): Vector3 {
  if (Math.abs(isoValue - val1) < 0.00001) {
    return v1;
  }
  if (Math.abs(isoValue - val2) < 0.00001) {
    return v2;
  }
  if (Math.abs(val1 - val2) < 0.00001) {
    return v1;
  }
  
  const t = (isoValue - val1) / (val2 - val1);
  
  return {
    x: v1.x + t * (v2.x - v1.x),
    y: v1.y + t * (v2.y - v1.y),
    z: v1.z + t * (v2.z - v1.z),
  };
}

function calculateNormal(v1: Vector3, v2: Vector3, v3: Vector3): Vector3 {
  const u = {
    x: v2.x - v1.x,
    y: v2.y - v1.y,
    z: v2.z - v1.z,
  };
  const v = {
    x: v3.x - v1.x,
    y: v3.y - v1.y,
    z: v3.z - v1.z,
  };
  
  const normal = {
    x: u.y * v.z - u.z * v.y,
    y: u.z * v.x - u.x * v.z,
    z: u.x * v.y - u.y * v.x,
  };
  
  // Normalize
  const length = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
  if (length > 0) {
    normal.x /= length;
    normal.y /= length;
    normal.z /= length;
  }
  
  return normal;
}
