/**
 * Voxelization utilities
 */

export interface VoxelVolume {
  width: number;
  height: number;
  depth: number;
  data: Float32Array;
}

/**
 * Create a 3D voxel volume from a 2D color mask
 */
export function createVoxelVolume(
  colorMap: number[][],
  colorIndex: number,
  layerThickness: number,
  voxelSize: number
): VoxelVolume {
  const height = colorMap.length;
  const width = colorMap[0].length;
  const depth = Math.ceil(layerThickness / voxelSize);
  
  const data = new Float32Array(width * height * depth);
  
  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = x + y * width + z * width * height;
        data[idx] = colorMap[y][x] === colorIndex ? 1.0 : 0.0;
      }
    }
  }
  
  return { width, height, depth, data };
}

/**
 * Compute signed distance field for smoother edges (optional enhancement)
 */
export function computeSDF(colorMap: number[][], colorIndex: number): number[][] {
  const height = colorMap.length;
  const width = colorMap[0].length;
  
  // Create binary mask
  const mask: boolean[][] = [];
  for (let y = 0; y < height; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < width; x++) {
      row.push(colorMap[y][x] === colorIndex);
    }
    mask.push(row);
  }
  
  // Compute distance transform
  const result: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      if (mask[y][x]) {
        // Inside: positive distance to nearest boundary
        row.push(distanceToFalse(mask, x, y));
      } else {
        // Outside: negative distance to nearest true
        row.push(-distanceToTrue(mask, x, y));
      }
    }
    result.push(row);
  }
  
  return result;
}

function distanceToFalse(mask: boolean[][], x: number, y: number): number {
  let minDist = Infinity;
  const height = mask.length;
  const width = mask[0].length;
  
  for (let dy = -10; dy <= 10; dy++) {
    for (let dx = -10; dx <= 10; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && !mask[ny][nx]) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        minDist = Math.min(minDist, dist);
      }
    }
  }
  
  return minDist === Infinity ? 10 : minDist;
}

function distanceToTrue(mask: boolean[][], x: number, y: number): number {
  let minDist = Infinity;
  const height = mask.length;
  const width = mask[0].length;
  
  for (let dy = -10; dy <= 10; dy++) {
    for (let dx = -10; dx <= 10; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && mask[ny][nx]) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        minDist = Math.min(minDist, dist);
      }
    }
  }
  
  return minDist === Infinity ? 10 : minDist;
}

/**
 * Flood fill to identify enclosed voids
 */
export function preserveVoids(volume: VoxelVolume): VoxelVolume {
  const { width, height, depth, data } = volume;
  const visited = new Set<number>();
  const queue: number[] = [];
  
  // Mark all boundary voxels that are empty (0) as external
  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (
          (x === 0 || x === width - 1 || y === 0 || y === height - 1 || z === 0 || z === depth - 1) &&
          data[x + y * width + z * width * height] === 0
        ) {
          queue.push(x + y * width + z * width * height);
        }
      }
    }
  }
  
  // Flood fill external empty space
  while (queue.length > 0) {
    const idx = queue.shift()!;
    
    if (visited.has(idx)) continue;
    visited.add(idx);
    
    const x = idx % width;
    const y = Math.floor((idx % (width * height)) / width);
    const z = Math.floor(idx / (width * height));
    
    // Check neighbors
    const neighbors = [
      [x + 1, y, z],
      [x - 1, y, z],
      [x, y + 1, z],
      [x, y - 1, z],
      [x, y, z + 1],
      [x, y, z - 1],
    ];
    
    for (const [nx, ny, nz] of neighbors) {
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && nz >= 0 && nz < depth) {
        const nIdx = nx + ny * width + nz * width * height;
        if (data[nIdx] === 0 && !visited.has(nIdx)) {
          queue.push(nIdx);
        }
      }
    }
  }
  
  // Any unvisited 0 voxels are internal voids - keep them as 0
  return volume;
}
