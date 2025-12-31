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

  // Calculate image dimensions in mm (scale so longest edge is 100mm)
  const scale = 100 / Math.max(processedImage.width, processedImage.height);
  const imageWidthMm = processedImage.width * scale;
  const imageHeightMm = processedImage.height * scale;

  try {
    const coloredObjects: ColoredObject[] = [];
    const debugScadParts: string[] = [];

    // Determine color modality mode
    const hasBackingMode = config.options.backing !== undefined;
    const hasSandwichMode = config.options.sandwich !== undefined;
    
    if (hasBackingMode && hasSandwichMode) {
      throw new Error('Cannot specify both "backing" and "sandwich" modes. Choose one or neither.');
    }

    // Process backing layer if in backing mode
    if (hasBackingMode) {
      console.log('Generating backing layer...');
      const backingMask = await createBackplaneMask(processedImage);
      const backing3mfPath = path.join(tempDir, 'backing.3mf');

      await createMeshWithOpenSCAD(
        backingMask,
        config.options.backing!.thickness,
        backing3mfPath,
        tempDir
      );

      const backingMesh = await parse3MF(backing3mfPath);

      coloredObjects.push({
        mesh: backingMesh,
        color: '#000000',
        filamentName: config.options.backing!.color,
      });

      debugScadParts.push(`// Backing layer (${config.options.backing!.color})
color([0, 0, 0]) translate([0, 0, 0])
  surface(file = "backing_mask.png", center = false, invert = true);
`);
    }

    // Process sandwich layer if in sandwich mode
    if (hasSandwichMode) {
      console.log('Generating sandwich layer...');
      const sandwichMask = await createBackplaneMask(processedImage);
      const sandwich3mfPath = path.join(tempDir, 'sandwich.3mf');

      await createMeshWithOpenSCAD(
        sandwichMask,
        config.options.sandwich!.thickness,
        sandwich3mfPath,
        tempDir
      );

      const sandwichMesh = await parse3MF(sandwich3mfPath);

      coloredObjects.push({
        mesh: sandwichMesh,
        color: '#000000',
        filamentName: config.options.sandwich!.color,
      });

      debugScadParts.push(`// Sandwich layer (${config.options.sandwich!.color})
color([0, 0, 0]) translate([0, 0, 0])
  surface(file = "sandwich_mask.png", center = false, invert = true);
`);
    }

    // Process each color in order, ensuring no pixel overlap
    const usedPixels = new Set<string>();
    let colorIndex = 0;
    for (const [hexColor, colorConfig] of Object.entries(config.colors)) {
      console.log(`Generating mesh for color ${hexColor} (${colorConfig.color})...`);

      // Create color mask, excluding pixels already used by previous colors
      const mask = await createColorMask(processedImage, hexColor, usedPixels);

      // Calculate z-offset and height based on mode
      let zOffset = 0;
      let colorHeight = colorConfig.height;
      
      if (hasBackingMode) {
        // In backing mode, colors sit on top of the backing
        zOffset = config.options.backing!.thickness;
      } else if (hasSandwichMode) {
        // In sandwich mode, colors are embedded within the sandwich thickness
        // Colors should not exceed sandwich thickness
        const sandwichThickness = config.options.sandwich!.thickness;
        if (colorConfig.height > sandwichThickness) {
          console.warn(`Warning: Color ${hexColor} height (${colorConfig.height}mm) exceeds sandwich thickness (${sandwichThickness}mm). Clamping to sandwich thickness.`);
          colorHeight = sandwichThickness;
        }
        zOffset = 0;
      }
      
      // Generate 3MF for this color using OpenSCAD
      const color3mfPath = path.join(tempDir, `color_${hexColor.replace('#', '')}.3mf`);

      await createMeshWithOpenSCAD(mask, colorHeight, color3mfPath, tempDir);

      // Parse the generated 3MF and adjust z-offset if needed
      const mesh = await parse3MF(color3mfPath);
      
      // Apply z-offset to mesh vertices if in backing mode
      if (hasBackingMode && zOffset !== 0) {
        // Offset all vertices by the backing thickness
        for (const vertex of mesh.vertices) {
          vertex.z += zOffset;
        }
      }

      coloredObjects.push({
        mesh,
        color: hexColor,
        filamentName: colorConfig.color,
      });

      // Add to debug SCAD
      const rgb = hexToRgb(hexColor);
      debugScadParts.push(`// ${colorConfig.color} (${hexColor})
color([${rgb.r / 255}, ${rgb.g / 255}, ${rgb.b / 255}]) translate([0, 0, ${zOffset}])
  surface(file = "color_${hexColor.replace('#', '')}_mask.png", center = false, invert = true);
`);
      colorIndex++;
    }

    // Create debug.scad file
    const debugScadPath = path.join(path.dirname(outputFilepath), 'debug.scad');
    const debugScad = `// Debug visualization of all color masks
// This shows how all the color layers are positioned

${debugScadParts.join('\n')}
`;
    fs.writeFileSync(debugScadPath, debugScad, 'utf-8');
    console.log(`Generated ${debugScadPath} for debugging`);

    // Combine all meshes into a single 3MF file
    console.log('Combining meshes into final 3MF...');
    await createCombined3MF(coloredObjects, outputFilepath, imageWidthMm, imageHeightMm);

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
