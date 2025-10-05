import JSZip from 'jszip';
import { RGB, findClosestColor } from './colorQuantization';

export interface ModelConfig {
  width: number;  // in mm
  height: number; // in mm
  colorHeights: number[]; // height of each color layer in mm
  colors: RGB[];
  imageData: ImageData;
  showOnFront: boolean;
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
  const { width, colorHeights, colors, imageData, showOnFront } = config;
  
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
      
      if (alpha < 128) {
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
    
    // For each pixel that matches this color, create a voxel
    for (let y = 0; y < imgHeight; y++) {
      for (let x = 0; x < imgWidth; x++) {
        if (colorMap[y][x] !== colorIndex) continue;
        
        // Calculate position
        const px = (x / imgWidth) * width;
        const py = (y / imgHeight) * depth;
        const pxNext = ((x + 1) / imgWidth) * width;
        const pyNext = ((y + 1) / imgHeight) * depth;
        
        // Create a box for this voxel
        addVoxel(vertices, triangles, px, py, baseZ, pxNext, pyNext, topZ, colorIndex, showOnFront);
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
