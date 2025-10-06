export interface Contour {
  points: Array<{ x: number; y: number }>;
  colorIndex: number;
}

// Marching squares implementation
// For each configuration (0-15), defines which edges have segments
// Edges: 0=bottom, 1=right, 2=top, 3=left
const EDGE_LOOKUP: number[][] = [
  [],           // 0: ....
  [3, 0],       // 1: ...X
  [0, 1],       // 2: ..X.
  [3, 1],       // 3: ..XX
  [1, 2],       // 4: .X..
  [3, 0, 1, 2], // 5: .X.X (saddle - we'll handle as two separate contours)
  [0, 2],       // 6: .XX.
  [3, 2],       // 7: .XXX
  [2, 3],       // 8: X...
  [2, 0],       // 9: X..X
  [0, 1, 2, 3], // 10: X.X. (saddle - we'll handle as two separate contours)
  [2, 1],       // 11: X.XX
  [1, 3],       // 12: XX..
  [1, 0],       // 13: XX.X
  [0, 3],       // 14: XXX.
  []            // 15: XXXX
];

export function marchingSquares(
  colorMap: number[][],
  colorIndex: number,
  width: number,
  height: number
): Contour[] {
  const contours: Contour[] = [];
  const visited = new Set<string>();
  
  // For each cell in the grid, check if it has edges and trace them
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const config = getCellConfiguration(colorMap, x, y, colorIndex);
      if (config === 0 || config === 15) continue;
      
      const edges = EDGE_LOOKUP[config];
      if (edges.length === 0) continue;
      
      // For each edge pair, try to trace a contour if not visited
      for (let i = 0; i < edges.length; i += 2) {
        if (i + 1 >= edges.length) break;
        
        const startKey = `${x},${y},${edges[i]}`;
        if (visited.has(startKey)) continue;
        
        const contour = traceContour(colorMap, colorIndex, x, y, edges[i], visited, width, height);
        if (contour.points.length > 2) {
          contours.push(contour);
        }
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
  // Bit pattern: 8 4 2 1 => TL TR BR BL
  if (y < colorMap.length && x < colorMap[y].length && colorMap[y][x] === colorIndex) config |= 1;
  if (y < colorMap.length && x + 1 < colorMap[y].length && colorMap[y][x + 1] === colorIndex) config |= 2;
  if (y + 1 < colorMap.length && x + 1 < colorMap[y + 1].length && colorMap[y + 1][x + 1] === colorIndex) config |= 4;
  if (y + 1 < colorMap.length && x < colorMap[y + 1].length && colorMap[y + 1][x] === colorIndex) config |= 8;
  
  return config;
}

function getEdgePoint(x: number, y: number, edge: number): { x: number; y: number } {
  // Returns the midpoint of an edge
  // Edges: 0=bottom, 1=right, 2=top, 3=left
  switch (edge) {
    case 0: return { x: x + 0.5, y: y };       // bottom
    case 1: return { x: x + 1, y: y + 0.5 };   // right
    case 2: return { x: x + 0.5, y: y + 1 };   // top
    case 3: return { x: x, y: y + 0.5 };       // left
    default: return { x: x + 0.5, y: y + 0.5 };
  }
}

function getNextCell(x: number, y: number, edge: number): { x: number; y: number; edge: number } {
  // Given an edge, returns the next cell and the edge we're entering from
  switch (edge) {
    case 0: return { x, y: y - 1, edge: 2 };   // bottom -> move down, enter from top
    case 1: return { x: x + 1, y, edge: 3 };   // right -> move right, enter from left
    case 2: return { x, y: y + 1, edge: 0 };   // top -> move up, enter from bottom
    case 3: return { x: x - 1, y, edge: 1 };   // left -> move left, enter from right
    default: return { x, y, edge: 0 };
  }
}

function traceContour(
  colorMap: number[][],
  colorIndex: number,
  startX: number,
  startY: number,
  startEdge: number,
  visited: Set<string>,
  width: number,
  height: number
): Contour {
  const points: Array<{ x: number; y: number }> = [];
  let x = startX;
  let y = startY;
  let currentEdge = startEdge;
  
  const maxSteps = width * height * 4;
  let steps = 0;
  
  do {
    // Mark this edge as visited
    visited.add(`${x},${y},${currentEdge}`);
    
    // Add the edge midpoint
    points.push(getEdgePoint(x, y, currentEdge));
    
    // Get the cell configuration
    const config = getCellConfiguration(colorMap, x, y, colorIndex);
    const edges = EDGE_LOOKUP[config];
    
    if (edges.length === 0) break;
    
    // Find the exit edge (the edge that's not the entry edge)
    let exitEdge = -1;
    for (let i = 0; i < edges.length; i++) {
      if (edges[i] !== currentEdge && edges[i] !== ((currentEdge + 2) % 4)) {
        // Check if this edge pairs with our current edge
        const pairIndex = edges.indexOf(currentEdge);
        if (pairIndex !== -1) {
          // Find the paired exit edge
          if (pairIndex % 2 === 0 && i === pairIndex + 1) {
            exitEdge = edges[i];
            break;
          } else if (pairIndex % 2 === 1 && i === pairIndex - 1) {
            exitEdge = edges[i];
            break;
          }
        }
      }
    }
    
    if (exitEdge === -1) {
      // Try to find any valid exit edge that's not the entry
      for (const edge of edges) {
        if (edge !== currentEdge) {
          exitEdge = edge;
          break;
        }
      }
    }
    
    if (exitEdge === -1) break;
    
    // Move to the next cell
    const next = getNextCell(x, y, exitEdge);
    x = next.x;
    y = next.y;
    currentEdge = next.edge;
    
    // Check bounds
    if (x < 0 || x >= width - 1 || y < 0 || y >= height - 1) break;
    
    steps++;
    if (steps > maxSteps) break;
    
  } while (x !== startX || y !== startY || currentEdge !== startEdge);
  
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
