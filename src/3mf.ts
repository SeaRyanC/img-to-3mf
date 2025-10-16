import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import unzipper from 'unzipper';
import { v4 as uuidv4 } from 'uuid';
import { hexToRgb } from './colors';
import { Jimp } from 'jimp';

export interface MeshObject {
  vertices: { x: number; y: number; z: number }[];
  triangles: { v1: number; v2: number; v3: number }[];
}

export interface ColoredObject {
  mesh: MeshObject;
  color: string; // hex color
  filamentName: string;
}

export async function parse3MF(filepath: string): Promise<MeshObject> {
  const tempDir = path.join(path.dirname(filepath), `temp_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // Extract 3MF (which is a ZIP file)
    await fs
      .createReadStream(filepath)
      .pipe(unzipper.Extract({ path: tempDir }))
      .promise();

    // Read the main model file
    const modelPath = path.join(tempDir, '3D', '3dmodel.model');
    if (!fs.existsSync(modelPath)) {
      throw new Error('Invalid 3MF file: missing 3D/3dmodel.model');
    }

    const modelXml = fs.readFileSync(modelPath, 'utf-8');
    const mesh = parseModelXml(modelXml);

    return mesh;
  } finally {
    // Clean up temp directory
    // fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function parseModelXml(xml: string): MeshObject {
  const vertices: { x: number; y: number; z: number }[] = [];
  const triangles: { v1: number; v2: number; v3: number }[] = [];

  // Simple XML parsing for vertices (handles both /> and  />)
  const vertexRegex = /<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"\s*\/>/g;
  let match;
  while ((match = vertexRegex.exec(xml)) !== null) {
    vertices.push({
      x: parseFloat(match[1]),
      y: parseFloat(match[2]),
      z: parseFloat(match[3]),
    });
  }

  // Simple XML parsing for triangles (handles both /> and  />)
  const triangleRegex = /<triangle v1="([^"]+)" v2="([^"]+)" v3="([^"]+)"\s*\/>/g;
  while ((match = triangleRegex.exec(xml)) !== null) {
    triangles.push({
      v1: parseInt(match[1]),
      v2: parseInt(match[2]),
      v3: parseInt(match[3]),
    });
  }

  return { vertices, triangles };
}

// Create thumbnail images for Bambu Studio compatibility
async function createThumbnails(tempDir: string): Promise<void> {
  // Create a simple grey placeholder thumbnail (matching Bambu Studio style)
  // Middle size: 256x256
  const middleThumb = new Jimp({ width: 256, height: 256, color: 0x808080FF });
  await middleThumb.write(path.resolve(path.join(tempDir, 'Metadata', 'plate_1.png')) as `${string}.${string}`);
  
  // Small size: 96x96
  const smallThumb = new Jimp({ width: 96, height: 96, color: 0x808080FF });
  await smallThumb.write(path.resolve(path.join(tempDir, 'Metadata', 'plate_1_small.png')) as `${string}.${string}`);
}

export async function createCombined3MF(
  objects: ColoredObject[],
  outputPath: string
): Promise<void> {
  const tempDir = path.join(path.dirname(outputPath), `temp_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // Create directory structure
    fs.mkdirSync(path.join(tempDir, '3D'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, '3D', 'Objects'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, '3D', '_rels'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, '_rels'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'Metadata'), { recursive: true });

    // Create thumbnail images for Bambu Studio compatibility
    await createThumbnails(tempDir);

    // Create [Content_Types].xml
    const contentTypes = generateContentTypes();
    fs.writeFileSync(path.join(tempDir, '[Content_Types].xml'), contentTypes, 'utf-8');

    // Create _rels/.rels
    const rels = generateRootRels();
    fs.writeFileSync(path.join(tempDir, '_rels', '.rels'), rels, 'utf-8');

    // Create 3D/_rels/3dmodel.model.rels
    const modelRels = generate3DModelRels(objects.length);
    fs.writeFileSync(path.join(tempDir, '3D', '_rels', '3dmodel.model.rels'), modelRels, 'utf-8');

    // Create object model files
    const objectReferences: { id: number; uuid: string; path: string }[] = [];
    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i];
      const objectId = i * 2 + 1; // 1, 3, 5, ...
      const uuid = uuidv4();
      const objectPath = `/3D/Objects/object_${objectId}.model`;
      
      const objectModel = generateObjectModel(obj.mesh, objectId, uuid);
      fs.writeFileSync(
        path.join(tempDir, '3D', 'Objects', `object_${objectId}.model`),
        objectModel,
        'utf-8'
      );

      objectReferences.push({ id: objectId, uuid, path: objectPath });
    }

    // Create main 3dmodel.model
    const mainModel = generateMainModel(objectReferences);
    fs.writeFileSync(path.join(tempDir, '3D', '3dmodel.model'), mainModel, 'utf-8');

    // Create model_settings.config with color information
    const modelSettings = generateModelSettings(objects, objectReferences);
    fs.writeFileSync(path.join(tempDir, 'Metadata', 'model_settings.config'), modelSettings, 'utf-8');

    // Create project_settings.config with filament colors
    const projectSettings = generateProjectSettings(objects);
    fs.writeFileSync(path.join(tempDir, 'Metadata', 'project_settings.config'), projectSettings, 'utf-8');

    // Create ZIP archive
    await createZipArchive(tempDir, outputPath);
  } finally {
    // Clean up temp directory
    // fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function generateContentTypes(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
 <Default Extension="png" ContentType="image/png"/>
</Types>`;
}

function generateRootRels(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
 <Relationship Target="/Metadata/plate_1.png" Id="rel-2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail"/>
 <Relationship Target="/Metadata/plate_1.png" Id="rel-4" Type="http://schemas.bambulab.com/package/2021/cover-thumbnail-middle"/>
 <Relationship Target="/Metadata/plate_1_small.png" Id="rel-5" Type="http://schemas.bambulab.com/package/2021/cover-thumbnail-small"/>
</Relationships>`;
}

function generate3DModelRels(objectCount: number): string {
  let rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
`;
  
  for (let i = 0; i < objectCount; i++) {
    const objectId = i * 2 + 1;
    rels += ` <Relationship Target="/3D/Objects/object_${objectId}.model" Id="rel-${i + 1}" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\n`;
  }

  rels += `</Relationships>`;
  return rels;
}

function generateObjectModel(mesh: MeshObject, objectId: number, uuid: string): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p">
 <metadata name="BambuStudio:3mfVersion">1</metadata>
 <resources>
  <object id="${objectId}" p:UUID="${uuid}" type="model">
   <mesh>
    <vertices>
`;

  for (const v of mesh.vertices) {
    xml += `     <vertex x="${v.x}" y="${v.y}" z="${v.z}"/>\n`;
  }

  xml += `    </vertices>
    <triangles>
`;

  for (const t of mesh.triangles) {
    xml += `     <triangle v1="${t.v1}" v2="${t.v2}" v3="${t.v3}"/>\n`;
  }

  xml += `    </triangles>
   </mesh>
  </object>
 </resources>
 <build/>
</model>`;

  return xml;
}

function generateMainModel(objectReferences: { id: number; uuid: string; path: string }[]): string {
  const buildUuid = uuidv4();
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p">
 <metadata name="Application">img-to-3mf</metadata>
 <metadata name="BambuStudio:3mfVersion">1</metadata>
 <metadata name="Copyright"></metadata>
 <metadata name="CreationDate">${dateStr}</metadata>
 <metadata name="Description"></metadata>
 <metadata name="Designer"></metadata>
 <metadata name="DesignerCover"></metadata>
 <metadata name="License"></metadata>
 <metadata name="ModificationDate">${dateStr}</metadata>
 <metadata name="Origin"></metadata>
 <metadata name="Title"></metadata>
 <resources>
`;

  for (let i = 0; i < objectReferences.length; i++) {
    const obj = objectReferences[i];
    const wrapperId = obj.id + 1;
    const wrapperUuid = uuidv4();
    const componentUuid = uuidv4();

    xml += `  <object id="${wrapperId}" p:UUID="${wrapperUuid}" type="model">
   <components>
    <component p:path="${obj.path}" objectid="${obj.id}" p:UUID="${componentUuid}" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>
   </components>
  </object>
`;
  }

  xml += ` </resources>
 <build p:UUID="${buildUuid}">
`;

  // All objects should be at the same position since they're different color layers of the same image
  const baseX = 100;
  const baseY = 100;
  const baseZ = 0;
  
  for (let i = 0; i < objectReferences.length; i++) {
    const obj = objectReferences[i];
    const wrapperId = obj.id + 1;
    const itemUuid = uuidv4();

    xml += `  <item objectid="${wrapperId}" p:UUID="${itemUuid}" transform="1 0 0 0 1 0 0 0 1 ${baseX} ${baseY} ${baseZ}" printable="1"/>\n`;
  }

  xml += ` </build>
</model>`;

  return xml;
}

function generateModelSettings(
  objects: ColoredObject[],
  objectReferences: { id: number; uuid: string }[]
): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<config>
`;

  for (let i = 0; i < objects.length; i++) {
    const wrapperId = objectReferences[i].id + 1;
    const objectId = objectReferences[i].id;
    const extruder = i + 1; // Extruder IDs start at 1
    const colorName = objects[i].filamentName || `Color${i + 1}`;

    xml += `  <object id="${wrapperId}">
    <metadata key="name" value="${colorName}"/>
    <metadata key="extruder" value="${extruder}"/>
    <part id="${objectId}" subtype="normal_part">
      <metadata key="name" value="${colorName}"/>
      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>
      <mesh_stat edges_fixed="0" degenerate_facets="0" facets_removed="0" facets_reversed="0" backwards_edges="0"/>
    </part>
  </object>
`;
  }

  xml += `</config>`;
  return xml;
}

function generateProjectSettings(objects: ColoredObject[]): string {
  const filamentColors = objects.map(obj => obj.color);
  
  const settings = {
    filament_colour: filamentColors,
  };

  return JSON.stringify(settings, null, 2);
}

async function createZipArchive(sourceDir: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    archive.on('error', (err) => reject(err));

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}
