export interface Contour {
  points: Array<{ x: number; y: number }>;
  colorIndex: number;
}

// Marching squares lookup table for edge cases
// Each entry is an array of edge pairs [entry, exit]
const EDGE_TABLE: Array<Array<[number, number]>> = [
  [], // 0: no edges
  [[0, 1], [1, 3]], // 1: bottom-left corner
  [[1, 0], [0, 2]], // 2: bottom-right corner
  [[1, 3], [0, 2]], // 3: bottom edge
  [[2, 3], [3, 1]], // 4: top-right corner
  [[0, 1], [1, 3], [2, 3], [3, 1]], // 5: saddle (ambiguous)
  [[1, 0], [0, 2], [2, 3], [3, 1]], // 6: right edge
  [[0, 2], [2, 3]], // 7: bottom-right and top-right
  [[3, 2], [2, 0]], // 8: top-left corner
  [[0, 1], [1, 3], [3, 2], [2, 0]], // 9: left edge
  [[1, 0], [0, 2], [3, 2], [2, 0]], // 10: saddle (ambiguous)
  [[1, 3], [3, 2]], // 11: bottom-left and top-left
  [[2, 3], [3, 1], [1, 0]], // 12: top edge
  [[0, 1], [2, 3], [3, 1]], // 13: top-left and bottom-left
  [[1, 0], [2, 3]], // 14: top-right and bottom-right
  [] // 15: all corners (no edges)
];

// Edge positions: [bottom, right, top, left]
// 0 = bottom, 1 = right, 2 = top, 3 = left
const EDGE_OFFSETS: Array<[number, number]> = [
  [0.5, 0], // bottom edge midpoint
  [1, 0.5], // right edge midpoint
  [0.5, 1], // top edge midpoint
  [0, 0.5]  // left edge midpoint
];

export function marchingSquares(
  colorMap: number[][],
  colorIndex: number,
  width: number,
  height: number
): Contour[] {
  const contours: Contour[] = [];
  const visited = new Set<string>();
  
  // For each cell in the grid
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const cellKey = `${x},${y}`;
      if (visited.has(cellKey)) continue;
      
      const config = getCellConfiguration(colorMap, x, y, colorIndex);
      if (config === 0 || config === 15) continue; // No edges
      
      // Trace contour from this cell
      const contour = traceContour(colorMap, colorIndex, x, y, visited, width, height);
      if (contour.points.length > 2) {
        contours.push(contour);
      }
    }
  }
  
  return contours;
}

function getCellConfiguration(
  colorMap: number[][],
  x: number,
  y: number,
  colorIndex: number
): number {
  let config = 0;
  
  // Check four corners: bottom-left, bottom-right, top-right, top-left
  if (y < colorMap.length && x < colorMap[y].length && colorMap[y][x] === colorIndex) config |= 1;
  if (y < colorMap.length && x + 1 < colorMap[y].length && colorMap[y][x + 1] === colorIndex) config |= 2;
  if (y + 1 < colorMap.length && x + 1 < colorMap[y + 1].length && colorMap[y + 1][x + 1] === colorIndex) config |= 4;
  if (y + 1 < colorMap.length && x < colorMap[y + 1].length && colorMap[y + 1][x] === colorIndex) config |= 8;
  
  return config;
}

function traceContour(
  colorMap: number[][],
  colorIndex: number,
  startX: number,
  startY: number,
  visited: Set<string>,
  width: number,
  height: number
): Contour {
  const points: Array<{ x: number; y: number }> = [];
  let x = startX;
  let y = startY;
  let prevEdge = -1;
  
  const maxSteps = width * height * 4; // Safety limit
  let steps = 0;
  
  do {
    const cellKey = `${x},${y}`;
    visited.add(cellKey);
    
    const config = getCellConfiguration(colorMap, x, y, colorIndex);
    const edges = EDGE_TABLE[config];
    
    if (edges.length === 0) break;
    
    // Find the edge to follow (not the one we came from)
    let edgeIndex = 0;
    if (edges.length > 2) {
      // For saddle cases, choose based on previous edge
      edgeIndex = prevEdge === edges[0][1] ? 2 : 0;
    } else if (prevEdge !== -1 && edges[0] && edges[0][0] === prevEdge) {
      edgeIndex = edges.length > 1 ? 1 : 0;
    }
    
    if (!edges[edgeIndex]) break;
    
    const [exitEdge, _] = edges[edgeIndex];
    
    // Add point at edge midpoint
    const offset = EDGE_OFFSETS[exitEdge];
    points.push({
      x: x + offset[0],
      y: y + offset[1]
    });
    
    // Move to next cell
    prevEdge = (exitEdge + 2) % 4; // Opposite edge
    
    switch (exitEdge) {
      case 0: y--; break; // bottom -> move down
      case 1: x++; break; // right -> move right
      case 2: y++; break; // top -> move up
      case 3: x--; break; // left -> move left
    }
    
    // Check bounds
    if (x < 0 || x >= width - 1 || y < 0 || y >= height - 1) break;
    
    steps++;
    if (steps > maxSteps) break;
    
  } while (x !== startX || y !== startY);
  
  return { points, colorIndex };
}

export function smoothContour(contour: Contour, smoothingFactor: number = 0.5): Contour {
  if (contour.points.length < 3) return contour;
  
  const smoothed: Array<{ x: number; y: number }> = [];
  const n = contour.points.length;
  
  for (let i = 0; i < n; i++) {
    const prev = contour.points[(i - 1 + n) % n];
    const curr = contour.points[i];
    const next = contour.points[(i + 1) % n];
    
    smoothed.push({
      x: curr.x * (1 - smoothingFactor) + (prev.x + next.x) * 0.5 * smoothingFactor,
      y: curr.y * (1 - smoothingFactor) + (prev.y + next.y) * 0.5 * smoothingFactor
    });
  }
  
  return { points: smoothed, colorIndex: contour.colorIndex };
}
