import JSZip from 'jszip';
import { RGB, findClosestColor, colorsMatch } from './colorQuantization';
import { marchingSquares, smoothContour, Contour } from './marchingSquares';

export interface ModelConfig {
  width: number;  // in mm
  height: number; // in mm
  colorHeights: number[]; // height of each color layer in mm
  colors: RGB[];
  imageData: ImageData;
  showOnFront: boolean;
  useSmoothing: boolean;
  transparencyKeyColor: RGB | null;
  outlineMode: boolean; // true = outline only, false = full print
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
  const { width, colorHeights, colors, imageData, showOnFront, useSmoothing, transparencyKeyColor, outlineMode } = config;
  
  const imgWidth = imageData.width;
  const imgHeight = imageData.height;
  
  // Calculate aspect ratio to determine depth
  const aspectRatio = imgWidth / imgHeight;
  const depth = width / aspectRatio;
  
  // Create a 2D array to store which color each pixel belongs to
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
  
  const vertices: Vertex[] = [];
  const triangles: Triangle[] = [];
  
  // Generate geometry for each color layer
  let currentZ = 0;
  
  for (let colorIndex = 0; colorIndex < colors.length; colorIndex++) {
    const layerHeight = colorHeights[colorIndex];
    const baseZ = currentZ;
    const topZ = currentZ + layerHeight;
    
    if (useSmoothing || outlineMode) {
      // Use marching squares for smooth contours
      const contours = marchingSquares(colorMap, colorIndex, imgWidth, imgHeight);
      
      for (let contour of contours) {
        // Smooth the contour
        if (useSmoothing) {
          contour = smoothContour(contour, 0.5);
        }
        
        if (outlineMode) {
          // Generate outline/border geometry
          addContourOutline(vertices, triangles, contour, width, depth, imgWidth, imgHeight, baseZ, topZ, colorIndex);
        } else {
          // Generate filled geometry with smooth edges
          addContourFilled(vertices, triangles, contour, width, depth, imgWidth, imgHeight, baseZ, topZ, colorIndex);
        }
      }
    } else {
      // Original voxel-based approach (for each pixel that matches this color, create a voxel)
      for (let y = 0; y < imgHeight; y++) {
        for (let x = 0; x < imgWidth; x++) {
          if (colorMap[y][x] !== colorIndex) continue;
          
          // Calculate position - fix alignment by centering pixels properly
          const px = (x / imgWidth) * width;
          const py = (y / imgHeight) * depth;
          const pxNext = ((x + 1) / imgWidth) * width;
          const pyNext = ((y + 1) / imgHeight) * depth;
          
          // Create a box for this voxel
          addVoxel(vertices, triangles, px, py, baseZ, pxNext, pyNext, topZ, colorIndex, showOnFront);
        }
      }
    }
    
    currentZ = topZ;
  }
  
  // Generate XML
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <basematerials id="1">`;
  
  // Add materials for each color
  colors.forEach((color, i) => {
    const colorStr = rgbToColorString(color);
    xml += `
      <base name="Color${i}" displaycolor="${colorStr}" />`;
  });
  
  xml += `
    </basematerials>
    <object id="2" type="model">
      <mesh>
        <vertices>`;
  
  // Add vertices
  vertices.forEach(v => {
    xml += `
          <vertex x="${v.x.toFixed(3)}" y="${v.y.toFixed(3)}" z="${v.z.toFixed(3)}" />`;
  });
  
  xml += `
        </vertices>
        <triangles>`;
  
  // Add triangles
  triangles.forEach(t => {
    xml += `
          <triangle v1="${t.v1}" v2="${t.v2}" v3="${t.v3}" pid="1" p1="${t.colorIndex}" />`;
  });
  
  xml += `
        </triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="2" />
  </build>
</model>`;
  
  return xml;
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

function addContourOutline(
  vertices: Vertex[],
  triangles: Triangle[],
  contour: Contour,
  width: number,
  depth: number,
  imgWidth: number,
  imgHeight: number,
  baseZ: number,
  topZ: number,
  colorIndex: number
): void {
  if (contour.points.length < 3) return;
  
  const outlineWidth = 0.3; // mm - width of the outline
  const points = contour.points;
  
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    
    // Convert from image coordinates to world coordinates
    const x1 = (p1.x / imgWidth) * width;
    const y1 = (p1.y / imgHeight) * depth;
    const x2 = (p2.x / imgWidth) * width;
    const y2 = (p2.y / imgHeight) * depth;
    
    // Calculate perpendicular for outline width
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.001) continue;
    
    const nx = -dy / len * outlineWidth;
    const ny = dx / len * outlineWidth;
    
    // Create a quad for this edge segment
    const baseIndex = vertices.length;
    
    vertices.push(
      { x: x1, y: y1, z: baseZ },
      { x: x2, y: y2, z: baseZ },
      { x: x2 + nx, y: y2 + ny, z: baseZ },
      { x: x1 + nx, y: y1 + ny, z: baseZ },
      { x: x1, y: y1, z: topZ },
      { x: x2, y: y2, z: topZ },
      { x: x2 + nx, y: y2 + ny, z: topZ },
      { x: x1 + nx, y: y1 + ny, z: topZ }
    );
    
    // Bottom face
    triangles.push(
      { v1: baseIndex, v2: baseIndex + 1, v3: baseIndex + 2, colorIndex },
      { v1: baseIndex, v2: baseIndex + 2, v3: baseIndex + 3, colorIndex }
    );
    
    // Top face
    triangles.push(
      { v1: baseIndex + 4, v2: baseIndex + 6, v3: baseIndex + 5, colorIndex },
      { v1: baseIndex + 4, v2: baseIndex + 7, v3: baseIndex + 6, colorIndex }
    );
    
    // Outer face
    triangles.push(
      { v1: baseIndex + 1, v2: baseIndex + 5, v3: baseIndex + 6, colorIndex },
      { v1: baseIndex + 1, v2: baseIndex + 6, v3: baseIndex + 2, colorIndex }
    );
    
    // Inner face
    triangles.push(
      { v1: baseIndex, v2: baseIndex + 3, v3: baseIndex + 7, colorIndex },
      { v1: baseIndex, v2: baseIndex + 7, v3: baseIndex + 4, colorIndex }
    );
    
    // Side faces
    triangles.push(
      { v1: baseIndex, v2: baseIndex + 4, v3: baseIndex + 5, colorIndex },
      { v1: baseIndex, v2: baseIndex + 5, v3: baseIndex + 1, colorIndex }
    );
    
    triangles.push(
      { v1: baseIndex + 2, v2: baseIndex + 6, v3: baseIndex + 7, colorIndex },
      { v1: baseIndex + 2, v2: baseIndex + 7, v3: baseIndex + 3, colorIndex }
    );
  }
}

function addContourFilled(
  vertices: Vertex[],
  triangles: Triangle[],
  contour: Contour,
  width: number,
  depth: number,
  imgWidth: number,
  imgHeight: number,
  baseZ: number,
  topZ: number,
  colorIndex: number
): void {
  if (contour.points.length < 3) return;
  
  const baseIndex = vertices.length;
  const points = contour.points;
  
  // Add vertices for base and top
  for (const p of points) {
    const x = (p.x / imgWidth) * width;
    const y = (p.y / imgHeight) * depth;
    vertices.push({ x, y, z: baseZ });
  }
  
  for (const p of points) {
    const x = (p.x / imgWidth) * width;
    const y = (p.y / imgHeight) * depth;
    vertices.push({ x, y, z: topZ });
  }
  
  const n = points.length;
  
  // Triangulate the base (simple fan triangulation)
  for (let i = 1; i < n - 1; i++) {
    triangles.push({
      v1: baseIndex,
      v2: baseIndex + i + 1,
      v3: baseIndex + i,
      colorIndex
    });
  }
  
  // Triangulate the top
  for (let i = 1; i < n - 1; i++) {
    triangles.push({
      v1: baseIndex + n,
      v2: baseIndex + n + i,
      v3: baseIndex + n + i + 1,
      colorIndex
    });
  }
  
  // Side faces
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    
    triangles.push(
      {
        v1: baseIndex + i,
        v2: baseIndex + next,
        v3: baseIndex + n + next,
        colorIndex
      },
      {
        v1: baseIndex + i,
        v2: baseIndex + n + next,
        v3: baseIndex + n + i,
        colorIndex
      }
    );
  }
}
