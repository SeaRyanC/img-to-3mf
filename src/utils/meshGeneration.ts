import { createOpenSCAD, type OpenSCADInstance } from 'openscad-wasm';

export interface Mesh {
  data: string; // STL or 3MF data
  format: 'stl' | '3mf';
}

let openscadInstance: OpenSCADInstance | null = null;

async function getOpenSCAD(): Promise<OpenSCADInstance> {
  if (!openscadInstance) {
    openscadInstance = await createOpenSCAD();
  }
  return openscadInstance;
}

export async function createLayerMeshFromImage(
  pngBlob: Blob,
  width: number,
  height: number,
  layerHeight: number,
  filename: string = 'layer.png'
): Promise<Mesh> {
  const scad = await getOpenSCAD();
  const instance = scad.getInstance();
  
  // Convert blob to array buffer
  const arrayBuffer = await pngBlob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  // Write PNG file to virtual filesystem
  instance.FS.writeFile(filename, uint8Array);
  
  // Create OpenSCAD code using surface() function
  const code = `
// Import the PNG as a heightmap surface
surface(file="${filename}", center=true, invert=false);

// Scale to desired dimensions
scale([${width}, ${height}, ${layerHeight}]) {
  surface(file="${filename}", center=true, invert=false);
}
`;
  
  // Render to STL (we'll convert to 3MF later)
  const stlData = await scad.renderToStl(code);
  
  // Clean up
  try {
    instance.FS.unlink(filename);
  } catch (e) {
    // File might not exist, ignore
  }
  
  return { data: stlData, format: 'stl' };
}

export async function createBackplateMesh(
  width: number,
  height: number,
  thickness: number
): Promise<Mesh> {
  const scad = await getOpenSCAD();
  
  // Create a simple cube for the backplate
  const code = `
cube([${width}, ${height}, ${thickness}]);
`;
  
  const stlData = await scad.renderToStl(code);
  
  return { data: stlData, format: 'stl' };
}
