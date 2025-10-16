import * as fs from 'fs';
import * as path from 'path';
import { processImage, createColorMask, createBackplaneMask } from './image-processor';
import { Config, generateDefaultConfig, writeConfig, readConfig } from './config';
import { createMeshWithOpenSCAD, checkOpenSCADInstalled } from './openscad';
import { parse3MF, createCombined3MF, ColoredObject } from './3mf';
import { hexToRgb } from './colors';

export async function processImageTo3MF(
  imageFilepath: string,
  configFilepath: string,
  outputFilepath: string
): Promise<void> {
  // Check OpenSCAD is installed
  if (!checkOpenSCADInstalled()) {
    throw new Error(
      'OpenSCAD is not installed or not in PATH. Please install OpenSCAD from https://openscad.org/'
    );
  }

  // Load configuration
  const config = readConfig(configFilepath);

  // Process the image
  console.log('Processing image...');
  const processedImage = await processImage(imageFilepath);

  // Create temporary directory for intermediate files
  const tempDir = path.join(path.dirname(outputFilepath), `temp_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    const coloredObjects: ColoredObject[] = [];

    // Process backplane if configured
    if (config.options.backplane) {
      console.log('Generating backplane...');
      const backplaneMask = await createBackplaneMask(processedImage);
      const backplane3mfPath = path.join(tempDir, 'backplane.3mf');

      await createMeshWithOpenSCAD(
        backplaneMask,
        config.options.backplane.height,
        backplane3mfPath,
        tempDir
      );

      const backplaneMesh = await parse3MF(backplane3mfPath);
      const backplaneRgb = hexToRgb('#000000'); // Default to black if color mapping fails

      coloredObjects.push({
        mesh: backplaneMesh,
        color: '#000000',
        filamentName: config.options.backplane.color,
      });
    }

    // Process each color
    for (const [hexColor, colorConfig] of Object.entries(config.colors)) {
      console.log(`Generating mesh for color ${hexColor} (${colorConfig.color})...`);

      // Create color mask
      const mask = await createColorMask(processedImage, hexColor);

      // Generate 3MF for this color using OpenSCAD
      const color3mfPath = path.join(tempDir, `color_${hexColor.replace('#', '')}.3mf`);

      await createMeshWithOpenSCAD(mask, colorConfig.height, color3mfPath, tempDir);

      // Parse the generated 3MF
      const mesh = await parse3MF(color3mfPath);

      coloredObjects.push({
        mesh,
        color: hexColor,
        filamentName: colorConfig.color,
      });
    }

    // Combine all meshes into a single 3MF file
    console.log('Combining meshes into final 3MF...');
    await createCombined3MF(coloredObjects, outputFilepath);

    console.log(`Generated ${outputFilepath}`);
  } finally {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      // fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

export async function generateConfigFromImage(
  imageFilepath: string,
  configFilepath: string
): Promise<void> {
  console.log('Analyzing image...');
  const processedImage = await processImage(imageFilepath);

  const config = generateDefaultConfig(processedImage.modalColors);
  writeConfig(configFilepath, config);

  console.log(`Wrote ${configFilepath}, edit and re-run to continue`);
}
