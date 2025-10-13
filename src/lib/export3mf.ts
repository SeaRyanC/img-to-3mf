import JSZip from 'jszip';
import type { Mesh, ColorLayer } from '../types';

/**
 * Export mesh as STL string (ASCII format)
 */
export function exportSTL(mesh: Mesh, name: string = 'mesh'): string {
  const lines: string[] = [];
  lines.push(`solid ${name}`);

  const { vertices, normals, indices } = mesh;

  for (let i = 0; i < indices.length; i += 3) {
    const i1 = indices[i] * 3;
    const i2 = indices[i + 1] * 3;
    const i3 = indices[i + 2] * 3;

    // Use normal from first vertex
    const nx = normals[i1];
    const ny = normals[i1 + 1];
    const nz = normals[i1 + 2];

    lines.push(`  facet normal ${nx} ${ny} ${nz}`);
    lines.push(`    outer loop`);
    lines.push(`      vertex ${vertices[i1]} ${vertices[i1 + 1]} ${vertices[i1 + 2]}`);
    lines.push(`      vertex ${vertices[i2]} ${vertices[i2 + 1]} ${vertices[i2 + 2]}`);
    lines.push(`      vertex ${vertices[i3]} ${vertices[i3 + 1]} ${vertices[i3 + 2]}`);
    lines.push(`    endloop`);
    lines.push(`  endfacet`);
  }

  lines.push(`endsolid ${name}`);
  return lines.join('\n');
}

/**
 * Export mesh as OBJ string
 */
export function exportOBJ(mesh: Mesh): string {
  const lines: string[] = [];
  const { vertices, normals, indices } = mesh;

  // Write vertices
  for (let i = 0; i < vertices.length; i += 3) {
    lines.push(`v ${vertices[i]} ${vertices[i + 1]} ${vertices[i + 2]}`);
  }

  // Write normals
  for (let i = 0; i < normals.length; i += 3) {
    lines.push(`vn ${normals[i]} ${normals[i + 1]} ${normals[i + 2]}`);
  }

  // Write faces (1-indexed in OBJ)
  for (let i = 0; i < indices.length; i += 3) {
    const v1 = indices[i] + 1;
    const v2 = indices[i + 1] + 1;
    const v3 = indices[i + 2] + 1;
    lines.push(`f ${v1}//${v1} ${v2}//${v2} ${v3}//${v3}`);
  }

  return lines.join('\n');
}

/**
 * Color to hex string
 */
function colorToHex(color: [number, number, number]): string {
  return color.map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Export as 3MF (3D Manufacturing Format)
 */
export async function export3MF(colorLayers: ColorLayer[]): Promise<Blob> {
  const zip = new JSZip();

  // Add [Content_Types].xml
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`);

  // Add _rels/.rels
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rel0" Target="/3D/3dmodel.model" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`);

  // Build 3D model XML
  let modelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <basematerials id="1">
`;

  // Add color materials
  colorLayers.forEach((layer, idx) => {
    const hexColor = colorToHex(layer.color);
    modelXml += `      <base name="Color${idx}" displaycolor="#${hexColor}"/>\n`;
  });

  modelXml += `    </basematerials>\n`;

  // Add meshes
  colorLayers.forEach((layer, idx) => {
    if (!layer.mesh) return;

    const mesh = layer.mesh;
    const objectId = idx + 2;

    modelXml += `    <object id="${objectId}" type="model">\n`;
    modelXml += `      <mesh>\n`;
    modelXml += `        <vertices>\n`;

    // Write vertices
    for (let i = 0; i < mesh.vertices.length; i += 3) {
      const x = mesh.vertices[i];
      const y = mesh.vertices[i + 1];
      const z = mesh.vertices[i + 2];
      modelXml += `          <vertex x="${x}" y="${y}" z="${z}"/>\n`;
    }

    modelXml += `        </vertices>\n`;
    modelXml += `        <triangles>\n`;

    // Write triangles
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const v1 = mesh.indices[i];
      const v2 = mesh.indices[i + 1];
      const v3 = mesh.indices[i + 2];
      modelXml += `          <triangle v1="${v1}" v2="${v2}" v3="${v3}" pid="1" p1="${idx}"/>\n`;
    }

    modelXml += `        </triangles>\n`;
    modelXml += `      </mesh>\n`;
    modelXml += `    </object>\n`;
  });

  modelXml += `  </resources>\n`;
  modelXml += `  <build>\n`;

  // Add build items
  colorLayers.forEach((layer, idx) => {
    if (layer.mesh) {
      const objectId = idx + 2;
      modelXml += `    <item objectid="${objectId}"/>\n`;
    }
  });

  modelXml += `  </build>\n`;
  modelXml += `</model>`;

  // Add model to zip
  zip.file('3D/3dmodel.model', modelXml);

  // Generate blob
  const blob = await zip.generateAsync({ type: 'blob' });
  return blob;
}

/**
 * Download file to user's computer
 */
export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
