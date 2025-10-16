import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import Jimp from 'jimp';

export interface OpenSCADOptions {
  maskPath: string;
  height: number;
  outputPath: string;
  imageWidth: number;
  imageHeight: number;
}

export function generateOpenSCADScript(options: OpenSCADOptions): string {
  const { maskPath, height, imageWidth, imageHeight } = options;
  
  // Scale factor to convert pixels to millimeters (1 pixel = 0.2mm is a reasonable default)
  const scale = 0.2;
  const scaleX = imageWidth * scale;
  const scaleY = imageHeight * scale;

  return `
// Auto-generated OpenSCAD script for image-to-3MF conversion
scale([${scaleX}, ${scaleY}, ${height}]) {
  surface(file = "${maskPath.replace(/\\/g, '/')}", center = true, invert = true);
}
`;
}

export async function createMeshWithOpenSCAD(
  mask: any,
  height: number,
  outputPath: string,
  tempDir: string
): Promise<void> {
  // Save the mask as PNG
  const maskFilename = `mask_${Date.now()}.png`;
  const maskPath = path.join(tempDir, maskFilename);
  await mask.writeAsync(maskPath);

  // Generate OpenSCAD script
  const scadFilename = `script_${Date.now()}.scad`;
  const scadPath = path.join(tempDir, scadFilename);

  const script = generateOpenSCADScript({
    maskPath,
    height,
    outputPath,
    imageWidth: mask.getWidth(),
    imageHeight: mask.getHeight(),
  });

  fs.writeFileSync(scadPath, script, 'utf-8');

  // Run OpenSCAD to generate 3MF
  try {
    const command = `openscad -o "${outputPath}" "${scadPath}"`;
    execSync(command, { stdio: 'pipe', timeout: 60000 });
  } catch (error: any) {
    throw new Error(`OpenSCAD execution failed: ${error.message}`);
  }

  // Clean up temporary files
  try {
    fs.unlinkSync(maskPath);
    fs.unlinkSync(scadPath);
  } catch (e) {
    // Ignore cleanup errors
  }
}

export function checkOpenSCADInstalled(): boolean {
  try {
    execSync('openscad --version', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}
