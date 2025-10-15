import { zip } from 'fflate';
import type { Mesh } from './meshGeneration';

interface MeshData {
  vertices: number[];
  triangles: number[];
}

// Parse STL ASCII or Binary format and extract vertices/triangles
function parseSTL(stlData: string): MeshData {
  const vertices: number[] = [];
  const triangles: number[] = [];
  const vertexMap = new Map<string, number>();
  let vertexIndex = 0;
  
  function addVertex(x: number, y: number, z: number): number {
    const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;
    if (vertexMap.has(key)) {
      return vertexMap.get(key)!;
    }
    vertices.push(x, y, z);
    vertexMap.set(key, vertexIndex);
    return vertexIndex++;
  }
  
  // Try to parse as ASCII STL
  const lines = stlData.split('\n');
  let currentTriangle: number[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('vertex')) {
      const parts = trimmed.split(/\s+/);
      const x = parseFloat(parts[1]);
      const y = parseFloat(parts[2]);
      const z = parseFloat(parts[3]);
      const idx = addVertex(x, y, z);
      currentTriangle.push(idx);
      
      if (currentTriangle.length === 3) {
        triangles.push(...currentTriangle);
        currentTriangle = [];
      }
    }
  }
  
  return { vertices, triangles };
}

export async function generate3MF(
  meshes: Array<{ mesh: Mesh; color: string; name: string }>,
  backplateMesh?: Mesh,
  backplateColor?: string
): Promise<Blob> {
  const files: Record<string, Uint8Array> = {};
  
  // Create [Content_Types].xml
  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`;
  files['[Content_Types].xml'] = new TextEncoder().encode(contentTypes);
  
  // Create _rels/.rels
  const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;
  files['_rels/.rels'] = new TextEncoder().encode(rels);
  
  // Create individual object files
  let objectId = 1;
  const objectComponents: string[] = [];
  const buildItems: string[] = [];
  const objectRels: string[] = [];
  
  let zOffset = 0;
  
  // Add backplate if present
  if (backplateMesh && backplateColor) {
    const meshData = parseSTL(backplateMesh.data);
    const objFile = createObjectModel(objectId, meshData);
    files[`3D/Objects/object_${objectId}.model`] = new TextEncoder().encode(objFile);
    objectRels.push(`  <Relationship Target="/3D/Objects/object_${objectId}.model" Id="rel-${objectId}" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>`);
    
    const parentId = objectId + 1;
    objectComponents.push(`  <object id="${parentId}" type="model">
   <components>
    <component objectid="${objectId}" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>
   </components>
  </object>`);
    
    buildItems.push(`  <item objectid="${parentId}" transform="1 0 0 0 1 0 0 0 1 0 0 ${zOffset}"/>`);
    objectId += 2;
  }
  
  // Add color layer meshes
  for (const { mesh } of meshes) {
    const meshData = parseSTL(mesh.data);
    const objFile = createObjectModel(objectId, meshData);
    files[`3D/Objects/object_${objectId}.model`] = new TextEncoder().encode(objFile);
    objectRels.push(`  <Relationship Target="/3D/Objects/object_${objectId}.model" Id="rel-${objectId}" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>`);
    
    const parentId = objectId + 1;
    objectComponents.push(`  <object id="${parentId}" type="model">
   <components>
    <component objectid="${objectId}" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>
   </components>
  </object>`);
    
    buildItems.push(`  <item objectid="${parentId}" transform="1 0 0 0 1 0 0 0 1 0 0 ${zOffset}"/>`);
    objectId += 2;
  }
  
  // Create 3D/3dmodel.model
  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
 <metadata name="Application">img-to-3mf</metadata>
 <metadata name="CreationDate">${new Date().toISOString().split('T')[0]}</metadata>
 <resources>
${objectComponents.join('\n')}
 </resources>
 <build>
${buildItems.join('\n')}
 </build>
</model>`;
  files['3D/3dmodel.model'] = new TextEncoder().encode(model);
  
  // Create 3D/_rels/3dmodel.model.rels
  const modelRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${objectRels.join('\n')}
</Relationships>`;
  files['3D/_rels/3dmodel.model.rels'] = new TextEncoder().encode(modelRels);
  
  // Create the zip file
  return new Promise((resolve, reject) => {
    zip(files, { level: 6 }, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(new Blob([new Uint8Array(data)], { type: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml' }));
      }
    });
  });
}

function createObjectModel(id: number, mesh: MeshData): string {
  let verticesXml = '';
  for (let i = 0; i < mesh.vertices.length; i += 3) {
    const x = mesh.vertices[i].toFixed(6);
    const y = mesh.vertices[i + 1].toFixed(6);
    const z = mesh.vertices[i + 2].toFixed(6);
    verticesXml += `     <vertex x="${x}" y="${y}" z="${z}"/>\n`;
  }
  
  let trianglesXml = '';
  for (let i = 0; i < mesh.triangles.length; i += 3) {
    const v1 = mesh.triangles[i];
    const v2 = mesh.triangles[i + 1];
    const v3 = mesh.triangles[i + 2];
    trianglesXml += `     <triangle v1="${v1}" v2="${v2}" v3="${v3}"/>\n`;
  }
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
 <resources>
  <object id="${id}" type="model">
   <mesh>
    <vertices>
${verticesXml}    </vertices>
    <triangles>
${trianglesXml}    </triangles>
   </mesh>
  </object>
 </resources>
 <build/>
</model>`;
}

export function download3MF(blob: Blob, filename: string = 'output.3mf') {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
