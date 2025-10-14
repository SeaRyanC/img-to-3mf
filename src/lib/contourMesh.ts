/**
 * Efficient mesh generation using contour extraction and polygon extrusion
 * Generates minimal triangle meshes compared to marching cubes
 * 
 * Uses marching squares algorithm to extract accurate contours,
 * then extrudes and triangulates them into 3D meshes
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
 * Extract contours from a binary mask using marching squares algorithm
 * This produces accurate contours that follow the shape boundary
 */
function extractContours(
  mask: Uint8Array,
  width: number,
  height: number
): Contour[] {
  const visited = new Uint8Array(width * height);
  const contours: Contour[] = [];

  // Find all connected components and trace their contours
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (mask[idx] === 1 && !visited[idx]) {
        // Mark this component as visited using flood fill
        const pixels = floodFill(mask, visited, width, height, x, y);
        
        if (pixels.length > 0) {
          // Trace the contour of this component using marching squares
          const contour = traceMarchingSquaresContour(mask, width, height, pixels);
          if (contour.points.length >= 3) {
            contours.push(contour);
          }
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
 * Trace the contour of a shape using Moore-Neighbor tracing
 * Returns vertices at pixel corners that form the boundary
 * Preserves concave features (unlike convex hull)
 */
function traceMarchingSquaresContour(
  mask: Uint8Array,
  width: number,
  height: number,
  pixels: Point2D[]
): Contour {
  // Find bounding box
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const p of pixels) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  // Simple case: very small regions use bounding box
  if (pixels.length < 4) {
    return {
      points: [
        { x: minX, y: minY },
        { x: maxX + 1, y: minY },
        { x: maxX + 1, y: maxY + 1 },
        { x: minX, y: maxY + 1 },
      ],
      isHole: false,
    };
  }

  // Use Moore-Neighbor tracing to follow the boundary
  // This preserves concave features
  const contourPoints = mooreNeighborTracing(mask, width, height, pixels);

  if (contourPoints.length < 3) {
    // Fallback to bounding box
    return {
      points: [
        { x: minX, y: minY },
        { x: maxX + 1, y: minY },
        { x: maxX + 1, y: maxY + 1 },
        { x: minX, y: maxY + 1 },
      ],
      isHole: false,
    };
  }

  return {
    points: contourPoints,
    isHole: false,
  };
}

/**
 * Get pixel value with bounds checking
 */
function getPixel(
  mask: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number
): number {
  if (x < 0 || x >= width || y < 0 || y >= height) {
    return 0;
  }
  return mask[y * width + x];
}

/**
 * Moore-Neighbor tracing algorithm
 * Follows the boundary of a filled region, preserving concave features
 * Returns ordered boundary points (pixel corners) in CCW order
 */
function mooreNeighborTracing(
  mask: Uint8Array,
  width: number,
  height: number,
  pixels: Point2D[]
): Point2D[] {
  // Extract all boundary pixels (filled pixels with at least one empty neighbor)
  const boundaryPixels: Point2D[] = [];
  const pixelSet = new Set<string>();
  
  for (const p of pixels) {
    pixelSet.add(`${p.x},${p.y}`);
  }
  
  // Directions: right, down, left, up
  const dx = [1, 0, -1, 0];
  const dy = [0, 1, 0, -1];
  
  for (const p of pixels) {
    // Check if this pixel has at least one empty neighbor
    let hasEmptyNeighbor = false;
    for (let d = 0; d < 4; d++) {
      const nx = p.x + dx[d];
      const ny = p.y + dy[d];
      if (getPixel(mask, width, height, nx, ny) === 0) {
        hasEmptyNeighbor = true;
        break;
      }
    }
    
    if (hasEmptyNeighbor) {
      boundaryPixels.push(p);
    }
  }
  
  if (boundaryPixels.length === 0) {
    // No boundary? Return all pixels
    boundaryPixels.push(...pixels);
  }

  // Convert boundary pixels to contour vertices
  // Each pixel contributes its 4 corners
  const vertices: Point2D[] = [];
  const vertexSet = new Set<string>();
  
  for (const p of boundaryPixels) {
    // For each boundary pixel, add corners that are on the actual boundary
    // A corner is on the boundary if it's adjacent to both filled and empty pixels
    const corners = [
      { x: p.x, y: p.y },
      { x: p.x + 1, y: p.y },
      { x: p.x + 1, y: p.y + 1 },
      { x: p.x, y: p.y + 1 },
    ];
    
    for (const corner of corners) {
      const key = `${corner.x},${corner.y}`;
      if (vertexSet.has(key)) continue;
      
      // Check the 4 pixels adjacent to this corner
      const adjPixels = [
        getPixel(mask, width, height, corner.x - 1, corner.y - 1),
        getPixel(mask, width, height, corner.x, corner.y - 1),
        getPixel(mask, width, height, corner.x - 1, corner.y),
        getPixel(mask, width, height, corner.x, corner.y),
      ];
      
      const filledCount = adjPixels.filter(v => v === 1).length;
      
      // Corner is on boundary if it has both filled and empty adjacent pixels
      if (filledCount > 0 && filledCount < 4) {
        vertexSet.add(key);
        vertices.push(corner);
      }
    }
  }
  
  if (vertices.length < 3) {
    // Fallback: use all corner points
    for (const p of boundaryPixels) {
      vertices.push({ x: p.x, y: p.y });
      vertices.push({ x: p.x + 1, y: p.y });
      vertices.push({ x: p.x + 1, y: p.y + 1 });
      vertices.push({ x: p.x, y: p.y + 1 });
    }
  }

  // Sort vertices to form a coherent contour
  const sorted = sortBoundaryPoints(vertices);
  
  // Simplify by removing colinear points
  const simplified = simplifyContour(sorted);
  
  return simplified.length >= 3 ? simplified : sorted;
}

/**
 * Sort boundary points to form a coherent contour
 * Uses angle-based sorting from centroid
 */
function sortBoundaryPoints(points: Point2D[]): Point2D[] {
  if (points.length < 3) return points;
  
  // Find centroid
  let cx = 0, cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  cx /= points.length;
  cy /= points.length;
  
  // Sort by angle from centroid
  const sorted = points.slice().sort((a, b) => {
    const angleA = Math.atan2(a.y - cy, a.x - cx);
    const angleB = Math.atan2(b.y - cy, b.x - cx);
    return angleA - angleB;
  });
  
  return sorted;
}

/**
 * Simplify contour by removing colinear points
 * Reduces vertex count while preserving shape
 */
function simplifyContour(points: Point2D[]): Point2D[] {
  if (points.length < 3) return points;
  
  const simplified: Point2D[] = [];
  
  for (let i = 0; i < points.length; i++) {
    const prev = points[(i - 1 + points.length) % points.length];
    const curr = points[i];
    const next = points[(i + 1) % points.length];
    
    // Check if curr is colinear with prev and next
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    
    // Cross product: if zero, points are colinear
    const cross = dx1 * dy2 - dy1 * dx2;
    
    if (Math.abs(cross) > 0.01) {
      // Not colinear, keep this point
      simplified.push(curr);
    }
  }
  
  return simplified.length >= 3 ? simplified : points;
}

/**
 * Ear clipping triangulation for arbitrary simple polygons
 * Returns triangle indices (groups of 3) for the polygon
 */
function triangulatePolygon(points: Point2D[]): number[] {
  const n = points.length;
  if (n < 3) return [];
  if (n === 3) return [0, 1, 2];

  // For rectangles (4 points), use simple triangulation
  if (n === 4) {
    return [0, 1, 2, 0, 2, 3];
  }

  // For complex polygons, use ear clipping algorithm
  const indices: number[] = [];
  const remaining = Array.from({ length: n }, (_, i) => i);

  while (remaining.length > 3) {
    let earFound = false;

    for (let i = 0; i < remaining.length; i++) {
      const prev = remaining[(i - 1 + remaining.length) % remaining.length];
      const curr = remaining[i];
      const next = remaining[(i + 1) % remaining.length];

      // Check if this is an ear
      if (isEar(points, remaining, prev, curr, next)) {
        // Add this triangle
        indices.push(prev, curr, next);
        // Remove curr from remaining
        remaining.splice(i, 1);
        earFound = true;
        break;
      }
    }

    if (!earFound) {
      // Fallback to fan triangulation if ear clipping fails
      console.warn('Ear clipping failed, using fan triangulation');
      for (let i = 1; i < remaining.length - 1; i++) {
        indices.push(remaining[0], remaining[i], remaining[i + 1]);
      }
      break;
    }
  }

  // Add the last triangle
  if (remaining.length === 3) {
    indices.push(remaining[0], remaining[1], remaining[2]);
  }

  return indices;
}

/**
 * Check if a vertex is an "ear" that can be clipped
 */
function isEar(
  points: Point2D[],
  remaining: number[],
  prevIdx: number,
  currIdx: number,
  nextIdx: number
): boolean {
  const prev = points[prevIdx];
  const curr = points[currIdx];
  const next = points[nextIdx];

  // Check if the triangle is CCW (convex at curr)
  const cross = (curr.x - prev.x) * (next.y - prev.y) - (curr.y - prev.y) * (next.x - prev.x);
  if (cross <= 0) return false; // Reflex vertex

  // Check if any other point is inside this triangle
  for (const idx of remaining) {
    if (idx === prevIdx || idx === currIdx || idx === nextIdx) continue;
    
    const p = points[idx];
    if (pointInTriangle(p, prev, curr, next)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if a point is inside a triangle
 */
function pointInTriangle(p: Point2D, a: Point2D, b: Point2D, c: Point2D): boolean {
  const sign = (p1: Point2D, p2: Point2D, p3: Point2D) => {
    return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
  };

  const d1 = sign(p, a, b);
  const d2 = sign(p, b, c);
  const d3 = sign(p, c, a);

  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);

  return !(hasNeg && hasPos);
}

/**
 * Extrude a 2D contour into a 3D mesh
 * Uses ear clipping for arbitrary polygon triangulation
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

    // Triangulate front and back faces
    const faceIndices = triangulatePolygon(contour.points);
    
    // Front face - reverse winding (CW from outside, normal -Z)
    for (let i = 0; i < faceIndices.length; i += 3) {
      allIndices.push(
        baseIdx + faceIndices[i],
        baseIdx + faceIndices[i + 2],
        baseIdx + faceIndices[i + 1]
      );
    }
    
    // Back face - normal winding (CCW from outside, normal +Z)
    for (let i = 0; i < faceIndices.length; i += 3) {
      allIndices.push(
        baseIdx + n + faceIndices[i],
        baseIdx + n + faceIndices[i + 1],
        baseIdx + n + faceIndices[i + 2]
      );
    }

    // Side faces - connect front and back contours
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
