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
  const { width, colorHeights, colors, imageData, showOnFront, transparencyKeyColor, detectOutline } = config;
  
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
    
    // Merge adjacent voxels to reduce triangle count
    const mergedRegions = mergeAdjacentVoxels(colorMap, colorIndex, imgWidth, imgHeight);
    
    // Create geometry for each merged region
    for (const region of mergedRegions) {
      const px = (region.x1 / imgWidth) * width + offsetX;
      const py = (region.y1 / imgHeight) * depth + offsetY;
      const pxNext = (region.x2 / imgWidth) * width + offsetX;
      const pyNext = (region.y2 / imgHeight) * depth + offsetY;
      
      // Create a box for this merged region
      addVoxel(localVertices, localTriangles, px, py, baseZ, pxNext, pyNext, topZ, colorIndex, showOnFront);
    }
    
    // Only add object if it has geometry
    if (localVertices.length > 0) {
      objectsData.push({ colorIndex, vertices: localVertices, triangles: localTriangles });
    }
  }
  
  // Generate XML with separate objects for each color
  // Using proper basematerials structure for Bambu Studio compatibility
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <basematerials id="1">`;
  
  // Add materials for each color with proper displaycolor format
  colors.forEach((color, i) => {
    const colorStr = rgbToColorString(color);
    xml += `
      <base name="Color_${i + 1}" displaycolor="${colorStr}" />`;
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

// Merge adjacent voxels horizontally to reduce triangle count
function mergeAdjacentVoxels(
  colorMap: number[][],
  targetColor: number,
  width: number,
  height: number
): Array<{x1: number, y1: number, x2: number, y2: number}> {
  const regions: Array<{x1: number, y1: number, x2: number, y2: number}> = [];
  const visited: boolean[][] = Array(height).fill(null).map(() => Array(width).fill(false));
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (visited[y][x] || colorMap[y][x] !== targetColor) continue;
      
      // Find the extent of horizontal merge
      let x2 = x;
      while (x2 < width && colorMap[y][x2] === targetColor && !visited[y][x2]) {
        x2++;
      }
      
      // Mark as visited
      for (let xi = x; xi < x2; xi++) {
        visited[y][xi] = true;
      }
      
      // Add region
      regions.push({ x1: x, y1: y, x2: x2, y2: y + 1 });
    }
  }
  
  return regions;
}

function addVoxel(
  vertices: Vertex[],
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
  const baseIndex = vertices.length;
  
  // Adjust Y coordinates based on showOnFront
  const yFront = showOnFront ? y1 : y2;
  const yBack = showOnFront ? y2 : y1;
  
  // 8 vertices of the box
  vertices.push(
    { x: x1, y: yFront, z: z1 }, // 0
    { x: x2, y: yFront, z: z1 }, // 1
    { x: x2, y: yBack, z: z1 },  // 2
    { x: x1, y: yBack, z: z1 },  // 3
    { x: x1, y: yFront, z: z2 }, // 4
    { x: x2, y: yFront, z: z2 }, // 5
    { x: x2, y: yBack, z: z2 },  // 6
    { x: x1, y: yBack, z: z2 }   // 7
  );
  
  // 12 triangles (2 per face, 6 faces)
  const faces = [
    // Front face
    [0, 1, 5], [0, 5, 4],
    // Back face
    [2, 3, 7], [2, 7, 6],
    // Left face
    [3, 0, 4], [3, 4, 7],
    // Right face
    [1, 2, 6], [1, 6, 5],
    // Top face
    [4, 5, 6], [4, 6, 7],
    // Bottom face
    [3, 2, 1], [3, 1, 0]
  ];
  
  faces.forEach(face => {
    triangles.push({
      v1: baseIndex + face[0],
      v2: baseIndex + face[1],
      v3: baseIndex + face[2],
      colorIndex
    });
  });
}

function rgbToColorString(color: RGB): string {
  const r = color.r.toString(16).padStart(2, '0');
  const g = color.g.toString(16).padStart(2, '0');
  const b = color.b.toString(16).padStart(2, '0');
  return `#${r}${g}${b}FF`;
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
