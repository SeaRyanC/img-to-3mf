import JSZip from 'jszip';
import { RGB, findClosestColor, colorsMatch } from './colorQuantization';

export interface ModelConfig {
  width: number;  // in mm
  height: number; // in mm
  colorHeights: number[]; // height of each color layer in mm
  colors: RGB[];
  imageData: ImageData;
  showOnFront: boolean;
  transparencyKeyColor: RGB | null;
  detectOutline: boolean;
  useSmoothing: boolean; // Use marching cubes for smoothing at higher resolutions
}

interface Vertex {
  x: number;
  y: number;
  z: number;
}

interface Triangle {
  v1: number;
  v2: number;
  v3: number;
  colorIndex: number;
}

export async function generate3MF(config: ModelConfig): Promise<Blob> {
  const zip = new JSZip();
  
  // Add required files
  zip.file('[Content_Types].xml', generateContentTypes());
  zip.file('_rels/.rels', generateRels());
  zip.file('3D/_rels/3dmodel.model.rels', generateModelRels());
  
  // Generate 3D model
  const modelXml = generate3DModel(config);
  zip.file('3D/3dmodel.model', modelXml);
  
  const blob = await zip.generateAsync({ type: 'blob' });
  return blob;
}

function generateContentTypes(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`;
}

function generateRels(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;
}

function generateModelRels(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;
}

function generate3DModel(config: ModelConfig): string {
  const { width, colorHeights, colors, imageData, showOnFront, transparencyKeyColor, detectOutline, useSmoothing } = config;
  
  const imgWidth = imageData.width;
  const imgHeight = imageData.height;
  
  // Calculate aspect ratio to determine depth
  const aspectRatio = imgWidth / imgHeight;
  const depth = width / aspectRatio;
  
  // Detect outline background color and create mask if requested
  let outlineMask: boolean[][] | null = null;
  if (detectOutline) {
    const bgColor = detectUniformBackground(imageData);
    if (bgColor) {
      outlineMask = createOutlineMask(imageData, bgColor);
    }
  }
  
  // Create a 2D array to store which color each pixel belongs to
  // Process in chunks to avoid memory issues with large images
  const colorMap: number[][] = [];
  for (let y = 0; y < imgHeight; y++) {
    colorMap[y] = [];
    for (let x = 0; x < imgWidth; x++) {
      const i = (y * imgWidth + x) * 4;
      const pixel = {
        r: imageData.data[i],
        g: imageData.data[i + 1],
        b: imageData.data[i + 2]
      };
      const alpha = imageData.data[i + 3];
      
      // Check transparency
      let isTransparent = alpha < 128;
      
      // Check against transparency key color
      if (!isTransparent && transparencyKeyColor && colorsMatch(pixel, transparencyKeyColor, 10)) {
        isTransparent = true;
      }
      
      // Check outline mask - pixels marked as background in outline mode
      if (!isTransparent && outlineMask && outlineMask[y][x]) {
        isTransparent = true;
      }
      
      if (isTransparent) {
        colorMap[y][x] = -1; // Transparent
      } else {
        colorMap[y][x] = findClosestColor(pixel, colors);
      }
    }
  }
  
  // Generate geometry for each color as a separate object
  const objectsData: Array<{colorIndex: number, vertices: Vertex[], triangles: Triangle[]}> = [];
  
  // Center the model at x=125, y=125
  const centerX = 125;
  const centerY = 125;
  const offsetX = centerX - (width / 2);
  const offsetY = centerY - (depth / 2);
  
  for (let colorIndex = 0; colorIndex < colors.length; colorIndex++) {
    const localVertices: Vertex[] = [];
    const localTriangles: Triangle[] = [];
    const layerHeight = colorHeights[colorIndex];
    const baseZ = 0;  // All layers start at Z=0
    const topZ = layerHeight;  // Only the height varies
    
    // Create vertex map for manifold geometry (vertex sharing)
    const vertexMap = new Map<string, number>();
    const getOrCreateVertex = (x: number, y: number, z: number): number => {
      // Round to 6 decimal places to handle floating point precision
      const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;
      if (vertexMap.has(key)) {
        return vertexMap.get(key)!;
      }
      const index = localVertices.length;
      localVertices.push({ x, y, z });
      vertexMap.set(key, index);
      return index;
    };
    
    // Use improved merging algorithm with connected components
    const mergedRegions = mergeAdjacentVoxels(colorMap, colorIndex, imgWidth, imgHeight);
    
    // Decide whether to apply smoothing based on image size and user preference
    const shouldSmooth = useSmoothing && (imgWidth >= 100 || imgHeight >= 100);
    
    // Create geometry for each merged region
    for (const region of mergedRegions) {
      const px = (region.x1 / imgWidth) * width + offsetX;
      const py = (region.y1 / imgHeight) * depth + offsetY;
      const pxNext = (region.x2 / imgWidth) * width + offsetX;
      const pyNext = (region.y2 / imgHeight) * depth + offsetY;
      
      if (shouldSmooth) {
        // Apply chamfering/beveling to smooth corners with manifold geometry
        addSmoothedVoxelManifold(getOrCreateVertex, localTriangles, px, py, baseZ, pxNext, pyNext, topZ, colorIndex, showOnFront);
      } else {
        // Create a manifold box for this merged region
        addVoxelManifold(getOrCreateVertex, localTriangles, px, py, baseZ, pxNext, pyNext, topZ, colorIndex, showOnFront);
      }
    }
    
    // Only add object if it has geometry
    if (localVertices.length > 0) {
      objectsData.push({ colorIndex, vertices: localVertices, triangles: localTriangles });
    }
  }
  
  // Generate XML with separate objects for each color
  // Using proper basematerials structure for Bambu Studio compatibility
  // CRITICAL: colorspace="sRGB" is REQUIRED by Bambu Studio to recognize colors
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <basematerials id="1" colorspace="sRGB">`;
  
  // Add materials for each color with proper displaycolor format
  // Use simple numeric names as Bambu Studio expects
  colors.forEach((color, i) => {
    const colorStr = rgbToColorString(color);
    xml += `
      <base name="${i + 1}" displaycolor="${colorStr}" />`;
  });
  
  xml += `
    </basematerials>`;
  
  // Add separate object for each color with material reference
  objectsData.forEach((objData, idx) => {
    const objectId = idx + 2; // Start from 2 (1 is reserved for basematerials)
    xml += `
    <object id="${objectId}" type="model" pid="1" pindex="${objData.colorIndex}">
      <mesh>
        <vertices>`;
    
    // Add vertices for this color
    objData.vertices.forEach(v => {
      xml += `
          <vertex x="${v.x.toFixed(3)}" y="${v.y.toFixed(3)}" z="${v.z.toFixed(3)}" />`;
    });
    
    xml += `
        </vertices>
        <triangles>`;
    
    // Add triangles for this color (no per-triangle color needed, object has the color)
    objData.triangles.forEach(t => {
      xml += `
          <triangle v1="${t.v1}" v2="${t.v2}" v3="${t.v3}" />`;
    });
    
    xml += `
        </triangles>
      </mesh>
    </object>`;
  });
  
  xml += `
  </resources>
  <build>`;
  
  // Add all objects to the build
  objectsData.forEach((_, idx) => {
    const objectId = idx + 2;
    xml += `
    <item objectid="${objectId}" />`;
  });
  
  xml += `
  </build>
</model>`;
  
  return xml;
}

// Advanced merging using connected component labeling and rectangular decomposition
// This implements a painter's algorithm to identify connected regions and merge them optimally
function mergeAdjacentVoxels(
  colorMap: number[][],
  targetColor: number,
  width: number,
  height: number
): Array<{x1: number, y1: number, x2: number, y2: number}> {
  const regions: Array<{x1: number, y1: number, x2: number, y2: number}> = [];
  const visited: boolean[][] = Array(height).fill(null).map(() => Array(width).fill(false));
  
  // Find all connected components using flood fill
  const components: Array<Array<{x: number, y: number}>> = [];
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (visited[y][x] || colorMap[y][x] !== targetColor) continue;
      
      // Start a new connected component
      const component: Array<{x: number, y: number}> = [];
      const queue: Array<{x: number, y: number}> = [{x, y}];
      visited[y][x] = true;
      
      while (queue.length > 0) {
        const pixel = queue.shift()!;
        component.push(pixel);
        
        // Check 4-connected neighbors
        const neighbors = [
          {x: pixel.x - 1, y: pixel.y},
          {x: pixel.x + 1, y: pixel.y},
          {x: pixel.x, y: pixel.y - 1},
          {x: pixel.x, y: pixel.y + 1}
        ];
        
        for (const neighbor of neighbors) {
          if (neighbor.x >= 0 && neighbor.x < width &&
              neighbor.y >= 0 && neighbor.y < height &&
              !visited[neighbor.y][neighbor.x] &&
              colorMap[neighbor.y][neighbor.x] === targetColor) {
            visited[neighbor.y][neighbor.x] = true;
            queue.push(neighbor);
          }
        }
      }
      
      if (component.length > 0) {
        components.push(component);
      }
    }
  }
  
  // For each connected component, decompose into rectangles
  for (const component of components) {
    const componentRegions = decomposeComponentIntoRectangles(component, width, height);
    regions.push(...componentRegions);
  }
  
  return regions;
}

// Decompose a connected component into non-overlapping rectangles
// Uses a greedy algorithm to create larger rectangles where possible
function decomposeComponentIntoRectangles(
  component: Array<{x: number, y: number}>,
  width: number,
  height: number
): Array<{x1: number, y1: number, x2: number, y2: number}> {
  if (component.length === 0) return [];
  
  const regions: Array<{x1: number, y1: number, x2: number, y2: number}> = [];
  
  // Create a bitmap for this component
  const bitmap: boolean[][] = Array(height).fill(null).map(() => Array(width).fill(false));
  for (const pixel of component) {
    bitmap[pixel.y][pixel.x] = true;
  }
  
  // Greedy rectangle extraction - find largest rectangles first
  while (true) {
    let bestRect: {x1: number, y1: number, x2: number, y2: number, area: number} | null = null;
    
    // Try each unclaimed pixel as a potential rectangle start
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!bitmap[y][x]) continue;
        
        // Find maximum rectangle starting from this pixel
        const rect = findLargestRectangleFrom(bitmap, x, y, width, height);
        if (rect && (!bestRect || rect.area > bestRect.area)) {
          bestRect = rect;
        }
      }
    }
    
    if (!bestRect) break; // No more rectangles to extract
    
    // Claim this rectangle
    for (let y = bestRect.y1; y < bestRect.y2; y++) {
      for (let x = bestRect.x1; x < bestRect.x2; x++) {
        bitmap[y][x] = false;
      }
    }
    
    regions.push({
      x1: bestRect.x1,
      y1: bestRect.y1,
      x2: bestRect.x2,
      y2: bestRect.y2
    });
  }
  
  return regions;
}

// Find the largest rectangle that can be formed starting from (startX, startY)
function findLargestRectangleFrom(
  bitmap: boolean[][],
  startX: number,
  startY: number,
  width: number,
  height: number
): {x1: number, y1: number, x2: number, y2: number, area: number} | null {
  if (!bitmap[startY][startX]) return null;
  
  // Find maximum width in the starting row
  let maxWidth = 0;
  for (let x = startX; x < width && bitmap[startY][x]; x++) {
    maxWidth++;
  }
  
  let bestRect = {
    x1: startX,
    y1: startY,
    x2: startX + 1,
    y2: startY + 1,
    area: 1
  };
  
  // Try extending downward, limiting width as needed
  let currentWidth = maxWidth;
  for (let y = startY; y < height && currentWidth > 0; y++) {
    // Check how much width we can use in this row
    let rowWidth = 0;
    for (let x = startX; x < startX + currentWidth && x < width && bitmap[y][x]; x++) {
      rowWidth++;
    }
    
    if (rowWidth === 0) break; // Can't extend anymore
    
    currentWidth = Math.min(currentWidth, rowWidth);
    const area = currentWidth * (y - startY + 1);
    
    if (area > bestRect.area) {
      bestRect = {
        x1: startX,
        y1: startY,
        x2: startX + currentWidth,
        y2: y + 1,
        area
      };
    }
  }
  
  return bestRect;
}

// Add a voxel with proper vertex sharing for manifold geometry
// Uses a vertex getter function instead of direct vertex array access
function addVoxelManifold(
  getOrCreateVertex: (x: number, y: number, z: number) => number,
  triangles: Triangle[],
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
  colorIndex: number,
  showOnFront: boolean
): void {
  // Adjust Y coordinates based on showOnFront
  const yFront = showOnFront ? y1 : y2;
  const yBack = showOnFront ? y2 : y1;
  
  // Get or create the 8 vertices of the box (shared with adjacent boxes)
  const v0 = getOrCreateVertex(x1, yFront, z1); // 0
  const v1 = getOrCreateVertex(x2, yFront, z1); // 1
  const v2 = getOrCreateVertex(x2, yBack, z1);  // 2
  const v3 = getOrCreateVertex(x1, yBack, z1);  // 3
  const v4 = getOrCreateVertex(x1, yFront, z2); // 4
  const v5 = getOrCreateVertex(x2, yFront, z2); // 5
  const v6 = getOrCreateVertex(x2, yBack, z2);  // 6
  const v7 = getOrCreateVertex(x1, yBack, z2);  // 7
  
  // 12 triangles (2 per face, 6 faces)
  // Consistent winding order for manifold mesh
  const faces = [
    // Front face (Y = yFront)
    [v0, v1, v5], [v0, v5, v4],
    // Back face (Y = yBack)
    [v2, v3, v7], [v2, v7, v6],
    // Left face (X = x1)
    [v3, v0, v4], [v3, v4, v7],
    // Right face (X = x2)
    [v1, v2, v6], [v1, v6, v5],
    // Top face (Z = z2)
    [v4, v5, v6], [v4, v6, v7],
    // Bottom face (Z = z1)
    [v3, v2, v1], [v3, v1, v0]
  ];
  
  faces.forEach(face => {
    triangles.push({
      v1: face[0],
      v2: face[1],
      v3: face[2],
      colorIndex
    });
  });
}

// Add a smoothed voxel with beveled edges using manifold geometry
function addSmoothedVoxelManifold(
  getOrCreateVertex: (x: number, y: number, z: number) => number,
  triangles: Triangle[],
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
  colorIndex: number,
  showOnFront: boolean
): void {
  // For smoothing, we'll add chamfers to the corners
  const bevelSize = Math.min((x2 - x1), (y2 - y1)) * 0.15; // 15% bevel
  
  // Adjust Y coordinates based on showOnFront
  const yFront = showOnFront ? y1 : y2;
  const yBack = showOnFront ? y2 : y1;
  
  // Create 16 vertices for a beveled box (8 main + 8 beveled corners on XY plane)
  // Bottom layer (z1)
  const v0 = getOrCreateVertex(x1 + bevelSize, yFront, z1);          // 0
  const v1 = getOrCreateVertex(x2 - bevelSize, yFront, z1);          // 1
  const v2 = getOrCreateVertex(x2, yFront + bevelSize, z1);          // 2
  const v3 = getOrCreateVertex(x2, yBack - bevelSize, z1);           // 3
  const v4 = getOrCreateVertex(x2 - bevelSize, yBack, z1);           // 4
  const v5 = getOrCreateVertex(x1 + bevelSize, yBack, z1);           // 5
  const v6 = getOrCreateVertex(x1, yBack - bevelSize, z1);           // 6
  const v7 = getOrCreateVertex(x1, yFront + bevelSize, z1);          // 7
  // Top layer (z2)
  const v8 = getOrCreateVertex(x1 + bevelSize, yFront, z2);          // 8
  const v9 = getOrCreateVertex(x2 - bevelSize, yFront, z2);          // 9
  const v10 = getOrCreateVertex(x2, yFront + bevelSize, z2);         // 10
  const v11 = getOrCreateVertex(x2, yBack - bevelSize, z2);          // 11
  const v12 = getOrCreateVertex(x2 - bevelSize, yBack, z2);          // 12
  const v13 = getOrCreateVertex(x1 + bevelSize, yBack, z2);          // 13
  const v14 = getOrCreateVertex(x1, yBack - bevelSize, z2);          // 14
  const v15 = getOrCreateVertex(x1, yFront + bevelSize, z2);         // 15
  
  // Triangles for beveled box - more complex topology
  const faces = [
    // Bottom face (octagon)
    [v0, v1, v2], [v0, v2, v7], [v2, v3, v7], [v3, v6, v7],
    [v3, v4, v6], [v4, v5, v6], [v5, v6, v0], [v5, v0, v1], [v1, v4, v2], [v2, v4, v3],
    // Top face (octagon)
    [v8, v10, v9], [v8, v15, v10], [v10, v15, v11], [v11, v15, v14],
    [v11, v14, v12], [v12, v14, v13], [v13, v14, v8], [v13, v8, v9], [v9, v10, v12], [v10, v11, v12],
    // Side faces connecting bottom to top
    [v0, v8, v9], [v0, v9, v1],
    [v1, v9, v10], [v1, v10, v2],
    [v2, v10, v11], [v2, v11, v3],
    [v3, v11, v12], [v3, v12, v4],
    [v4, v12, v13], [v4, v13, v5],
    [v5, v13, v14], [v5, v14, v6],
    [v6, v14, v15], [v6, v15, v7],
    [v7, v15, v8], [v7, v8, v0]
  ];
  
  faces.forEach(face => {
    triangles.push({
      v1: face[0],
      v2: face[1],
      v3: face[2],
      colorIndex
    });
  });
}

function rgbToColorString(color: RGB): string {
  const r = color.r.toString(16).padStart(2, '0').toUpperCase();
  const g = color.g.toString(16).padStart(2, '0').toUpperCase();
  const b = color.b.toString(16).padStart(2, '0').toUpperCase();
  // Bambu Studio expects #RRGGBB format (without alpha channel)
  return `#${r}${g}${b}`;
}

// Detect uniform background color from image perimeter
function detectUniformBackground(imageData: ImageData): RGB | null {
  const width = imageData.width;
  const height = imageData.height;
  const perimeterColors = new Map<string, number>();
  
  // Sample perimeter pixels
  for (let x = 0; x < width; x++) {
    // Top edge
    const topIdx = x * 4;
    const topColor = {
      r: imageData.data[topIdx],
      g: imageData.data[topIdx + 1],
      b: imageData.data[topIdx + 2]
    };
    const topAlpha = imageData.data[topIdx + 3];
    
    // Bottom edge
    const botIdx = ((height - 1) * width + x) * 4;
    const botColor = {
      r: imageData.data[botIdx],
      g: imageData.data[botIdx + 1],
      b: imageData.data[botIdx + 2]
    };
    const botAlpha = imageData.data[botIdx + 3];
    
    if (topAlpha >= 128) {
      const key = `${topColor.r},${topColor.g},${topColor.b}`;
      perimeterColors.set(key, (perimeterColors.get(key) || 0) + 1);
    }
    
    if (botAlpha >= 128) {
      const key = `${botColor.r},${botColor.g},${botColor.b}`;
      perimeterColors.set(key, (perimeterColors.get(key) || 0) + 1);
    }
  }
  
  for (let y = 1; y < height - 1; y++) {
    // Left edge
    const leftIdx = (y * width) * 4;
    const leftColor = {
      r: imageData.data[leftIdx],
      g: imageData.data[leftIdx + 1],
      b: imageData.data[leftIdx + 2]
    };
    const leftAlpha = imageData.data[leftIdx + 3];
    
    // Right edge
    const rightIdx = (y * width + width - 1) * 4;
    const rightColor = {
      r: imageData.data[rightIdx],
      g: imageData.data[rightIdx + 1],
      b: imageData.data[rightIdx + 2]
    };
    const rightAlpha = imageData.data[rightIdx + 3];
    
    if (leftAlpha >= 128) {
      const key = `${leftColor.r},${leftColor.g},${leftColor.b}`;
      perimeterColors.set(key, (perimeterColors.get(key) || 0) + 1);
    }
    
    if (rightAlpha >= 128) {
      const key = `${rightColor.r},${rightColor.g},${rightColor.b}`;
      perimeterColors.set(key, (perimeterColors.get(key) || 0) + 1);
    }
  }
  
  // Find most common color
  let maxCount = 0;
  let dominantColor: RGB | null = null;
  
  for (const [key, count] of perimeterColors.entries()) {
    if (count > maxCount) {
      maxCount = count;
      const [r, g, b] = key.split(',').map(Number);
      dominantColor = { r, g, b };
    }
  }
  
  // Only return if it's truly dominant (appears in at least 50% of perimeter)
  const totalPerimeter = (width * 2) + ((height - 2) * 2);
  if (dominantColor && maxCount > totalPerimeter * 0.5) {
    return dominantColor;
  }
  
  return null;
}

// Create mask of background pixels using flood-fill from edges
function createOutlineMask(imageData: ImageData, bgColor: RGB): boolean[][] {
  const width = imageData.width;
  const height = imageData.height;
  
  // Initialize mask - true = background (will be transparent)
  const mask: boolean[][] = Array(height).fill(null).map(() => Array(width).fill(false));
  const visited: boolean[][] = Array(height).fill(null).map(() => Array(width).fill(false));
  
  // Flood-fill from all edge pixels that match background color
  const queue: Array<{x: number, y: number}> = [];
  
  // Add edge pixels matching background to queue
  for (let x = 0; x < width; x++) {
    // Top edge
    addIfMatchesBackground(imageData, 0, x, width, bgColor, queue, visited);
    // Bottom edge
    addIfMatchesBackground(imageData, height - 1, x, width, bgColor, queue, visited);
  }
  
  for (let y = 1; y < height - 1; y++) {
    // Left edge
    addIfMatchesBackground(imageData, y, 0, width, bgColor, queue, visited);
    // Right edge
    addIfMatchesBackground(imageData, y, width - 1, width, bgColor, queue, visited);
  }
  
  // Flood-fill from queue
  while (queue.length > 0) {
    const { x, y } = queue.shift()!;
    mask[y][x] = true;
    
    // Check 4-connected neighbors
    const neighbors = [
      { x: x - 1, y },
      { x: x + 1, y },
      { x, y: y - 1 },
      { x, y: y + 1 }
    ];
    
    for (const { x: nx, y: ny } of neighbors) {
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited[ny][nx]) {
        const i = (ny * width + nx) * 4;
        const pixel = {
          r: imageData.data[i],
          g: imageData.data[i + 1],
          b: imageData.data[i + 2]
        };
        const alpha = imageData.data[i + 3];
        
        if (alpha >= 128 && colorsMatch(pixel, bgColor, 10)) {
          visited[ny][nx] = true;
          queue.push({ x: nx, y: ny });
        }
      }
    }
  }
  
  return mask;
}

function addIfMatchesBackground(
  imageData: ImageData,
  y: number,
  x: number,
  width: number,
  bgColor: RGB,
  queue: Array<{x: number, y: number}>,
  visited: boolean[][]
): void {
  if (visited[y][x]) return;
  
  const i = (y * width + x) * 4;
  const pixel = {
    r: imageData.data[i],
    g: imageData.data[i + 1],
    b: imageData.data[i + 2]
  };
  const alpha = imageData.data[i + 3];
  
  if (alpha >= 128 && colorsMatch(pixel, bgColor, 10)) {
    visited[y][x] = true;
    queue.push({ x, y });
  }
}
