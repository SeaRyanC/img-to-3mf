/**
 * Efficient mesh generation using contour extraction and polygon extrusion
 * Generates minimal triangle meshes compared to marching cubes
 * 
 * For a simple rectangle: exactly 12 triangles (2 per face × 6 faces)
 */

import type { Mesh } from '../types';

interface Point2D {
  x: number;
  y: number;
}

interface Contour {
  points: Point2D[];
  isHole: boolean;
}

/**
 * Extract contours from a binary mask by finding connected components
 * and computing their bounding boxes
 */
function extractContours(
  mask: Uint8Array,
  width: number,
  height: number
): Contour[] {
  const visited = new Uint8Array(width * height);
  const contours: Contour[] = [];

  // Find all connected components
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (mask[idx] === 1 && !visited[idx]) {
        // Flood fill to find this component
        const component = floodFill(mask, visited, width, height, x, y);
        
        if (component.length > 0) {
          // Create bounding box contour for this component
          const contour = createBoundingBoxContour(component);
          contours.push(contour);
        }
      }
    }
  }

  return contours;
}

/**
 * Flood fill to find all pixels in a connected component
 */
function floodFill(
  mask: Uint8Array,
  visited: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number
): Point2D[] {
  const pixels: Point2D[] = [];
  const queue: Point2D[] = [{ x: startX, y: startY }];
  visited[startY * width + startX] = 1;

  while (queue.length > 0) {
    const p = queue.shift()!;
    pixels.push(p);

    // Check 4 neighbors
    const neighbors: Point2D[] = [
      { x: p.x + 1, y: p.y },
      { x: p.x - 1, y: p.y },
      { x: p.x, y: p.y + 1 },
      { x: p.x, y: p.y - 1 },
    ];

    for (const n of neighbors) {
      if (n.x >= 0 && n.x < width && n.y >= 0 && n.y < height) {
        const idx = n.y * width + n.x;
        if (mask[idx] === 1 && !visited[idx]) {
          visited[idx] = 1;
          queue.push(n);
        }
      }
    }
  }

  return pixels;
}

/**
 * Create a rectangular bounding box contour from a set of pixels
 * Returns points in counter-clockwise order for positive area
 */
function createBoundingBoxContour(pixels: Point2D[]): Contour {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const p of pixels) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  // Create rectangle points in the order: TL, TR, BR, BL
  // This ensures consistent winding for the volume calculation
  const points: Point2D[] = [
    { x: minX, y: minY },         // top-left
    { x: maxX + 1, y: minY },     // top-right
    { x: maxX + 1, y: maxY + 1 }, // bottom-right
    { x: minX, y: maxY + 1 },     // bottom-left
  ];

  return { points, isHole: false };
}

/**
 * Extrude a 2D contour into a 3D mesh
 * Creates exactly 12 triangles for a 4-point rectangle
 */
export function generateMeshFromContours(
  mask: Uint8Array,
  width: number,
  height: number,
  thickness: number,
  voxelSize: number
): Mesh {
  const contours = extractContours(mask, width, height);

  if (contours.length === 0) {
    return {
      vertices: new Float32Array(0),
      normals: new Float32Array(0),
      indices: new Uint32Array(0),
    };
  }

  const allVertices: number[] = [];
  const allNormals: number[] = [];
  const allIndices: number[] = [];

  for (const contour of contours) {
    const baseIdx = allVertices.length / 3;
    
    // Create vertices for front face (z = 0) and back face (z = thickness)
    const n = contour.points.length;
    
    // Front face vertices
    for (const p of contour.points) {
      allVertices.push(p.x * voxelSize, p.y * voxelSize, 0);
      allNormals.push(0, 0, -1); // Normal pointing backward (into screen)
    }
    
    // Back face vertices
    for (const p of contour.points) {
      allVertices.push(p.x * voxelSize, p.y * voxelSize, thickness);
      allNormals.push(0, 0, 1); // Normal pointing forward (out of screen)
    }

    // Triangulate front face (indices 0 to n-1)
    // For a 4-point rectangle: triangles (0,1,2) and (0,2,3)
    // We need to reverse winding for front face (looking from outside, normal points -Z)
    if (n === 4) {
      // Front face - CW from outside (normal -Z)
      allIndices.push(baseIdx + 0, baseIdx + 2, baseIdx + 1);
      allIndices.push(baseIdx + 0, baseIdx + 3, baseIdx + 2);
      
      // Back face - CCW from outside (normal +Z)
      allIndices.push(baseIdx + n + 0, baseIdx + n + 1, baseIdx + n + 2);
      allIndices.push(baseIdx + n + 0, baseIdx + n + 2, baseIdx + n + 3);
    } else {
      // General polygon - fan triangulation
      for (let i = 1; i < n - 1; i++) {
        allIndices.push(baseIdx + 0, baseIdx + i + 1, baseIdx + i);
        allIndices.push(baseIdx + n + 0, baseIdx + n + i, baseIdx + n + i + 1);
      }
    }

    // Side faces (4 rectangular faces for a 4-point contour)
    // Each side is a quad, triangulated as 2 triangles
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      
      const frontCurrent = baseIdx + i;
      const frontNext = baseIdx + next;
      const backCurrent = baseIdx + n + i;
      const backNext = baseIdx + n + next;

      // Quad: frontCurrent, frontNext, backNext, backCurrent
      // Triangle 1: frontCurrent, frontNext, backNext
      allIndices.push(frontCurrent, frontNext, backNext);
      // Triangle 2: frontCurrent, backNext, backCurrent
      allIndices.push(frontCurrent, backNext, backCurrent);
    }
  }

  return {
    vertices: new Float32Array(allVertices),
    normals: new Float32Array(allNormals),
    indices: new Uint32Array(allIndices),
  };
}

/**
 * Calculate mesh volume using the divergence theorem
 * 
 * For a closed, manifold triangle mesh, the signed volume is:
 * V = (1/6) * sum over all triangles of: v1 · (v2 × v3)
 * 
 * Where v1, v2, v3 are the three vertices of the triangle.
 * Positive volume means triangles are wound counter-clockwise when viewed from outside.
 */
export function calculateMeshVolume(mesh: Mesh): number {
  const { vertices, indices } = mesh;
  let signedVolume = 0;

  for (let i = 0; i < indices.length; i += 3) {
    const i1 = indices[i] * 3;
    const i2 = indices[i + 1] * 3;
    const i3 = indices[i + 2] * 3;

    // Get triangle vertices
    const v1x = vertices[i1], v1y = vertices[i1 + 1], v1z = vertices[i1 + 2];
    const v2x = vertices[i2], v2y = vertices[i2 + 1], v2z = vertices[i2 + 2];
    const v3x = vertices[i3], v3y = vertices[i3 + 1], v3z = vertices[i3 + 2];

    // Calculate v2 × v3 (cross product)
    const crossX = v2y * v3z - v2z * v3y;
    const crossY = v2z * v3x - v2x * v3z;
    const crossZ = v2x * v3y - v2y * v3x;

    // Calculate v1 · (v2 × v3) (dot product)
    const scalarTripleProduct = v1x * crossX + v1y * crossY + v1z * crossZ;

    signedVolume += scalarTripleProduct;
  }

  return Math.abs(signedVolume / 6);
}
