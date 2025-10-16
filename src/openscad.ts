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

  return `
// Auto-generated OpenSCAD script for image-to-3MF conversion
// Image dimensions: ${imageWidth}x${imageHeight} pixels
// Height: ${height}mm
// Scale: ${scale}mm per pixel in XY, ${height}mm tall

scale([${scale}, ${scale}, ${height}])
linear_extrude(1)
projection()
intersection() {
    translate([0, 0, -2])
    surface(file = "${maskPath.replace(/\\/g, '/')}", center = true, convexity = 10);
    cube([10000, 10000, 1], center = true);
}
`;
}

export async function createMeshWithOpenSCAD(
  mask: any,
  height: number,
  outputPath: string,
  tempDir: string
): Promise<void> {
  // Convert the mask to a heightmap
  // White pixels (0xFFFFFFFF) should be at the desired height
  // Black pixels (0x000000FF) should be at 0 height
  
  const width = mask.bitmap.width;
  const heightPx = mask.bitmap.height;
  
  // For the heightmap, we scale the height to 0-100 range for OpenSCAD
  // Then OpenSCAD will scale it by our height value
  // Actually, surface() uses the brightness (0-255) directly as Z coordinate
  // We need to create a grayscale heightmap
  
  // Save the mask as PNG - it's already a heightmap (white = high, black = low)
  const maskFilename = `mask_${Date.now()}.png`;
  const maskPath = path.resolve(path.join(tempDir, maskFilename));
  await mask.write(maskPath);

  // Generate OpenSCAD script
  const scadFilename = `script_${Date.now()}.scad`;
  const scadPath = path.resolve(path.join(tempDir, scadFilename));

  const script = generateOpenSCADScript({
    maskPath,
    height,
    outputPath,
    imageWidth: width,
    imageHeight: heightPx,
  });

  fs.writeFileSync(scadPath, script, 'utf-8');

  // Run OpenSCAD to generate 3MF
  try {
    const resolvedOutputPath = path.resolve(outputPath);
    const command = `openscad -o "${resolvedOutputPath}" "${scadPath}"`;
    console.log(`Running OpenSCAD: ${command}`);
    const output = execSync(command, { stdio: 'pipe', timeout: 120000, encoding: 'utf-8' });
    console.log(`OpenSCAD output: ${output}`);
  } catch (error: any) {
    const stderr = error.stderr ? error.stderr.toString() : 'No stderr';
    const stdout = error.stdout ? error.stdout.toString() : 'No stdout';
    throw new Error(`OpenSCAD execution failed: ${error.message}\nStdout: ${stdout}\nStderr: ${stderr}`);
  }

  // Clean up temporary files
  try {
    // fs.unlinkSync(maskPath);
    // fs.unlinkSync(scadPath);
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
