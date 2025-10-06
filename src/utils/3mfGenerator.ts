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
  const { width, colorHeights, colors, imageData, showOnFront, transparencyKeyColor } = config;
  
  const imgWidth = imageData.width;
  const imgHeight = imageData.height;
  
  // Calculate aspect ratio to determine depth
  const aspectRatio = imgWidth / imgHeight;
  const depth = width / aspectRatio;
  
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
      
      if (isTransparent) {
        colorMap[y][x] = -1; // Transparent
      } else {
        colorMap[y][x] = findClosestColor(pixel, colors);
      }
    }
  }
  
  // Generate geometry for each color as a separate object
  const objectsData: Array<{colorIndex: number, vertices: Vertex[], triangles: Triangle[]}> = [];
  
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
      const px = (region.x1 / imgWidth) * width;
      const py = (region.y1 / imgHeight) * depth;
      const pxNext = (region.x2 / imgWidth) * width;
      const pyNext = (region.y2 / imgHeight) * depth;
      
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
