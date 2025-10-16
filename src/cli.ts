#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { processImageTo3MF, generateConfigFromImage } from './processor';
import { getConfigPath, configExists } from './config';
import { analyzeImage } from './image-processor';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: img-to-3mf <image-file>');
    process.exit(1);
  }

  const imageFilepath = args[0];

  // Check if image file exists
  if (!fs.existsSync(imageFilepath)) {
    console.error(`Error: Image file not found: ${imageFilepath}`);
    process.exit(1);
  }

  // Get image dimensions
  const imageInfo = await analyzeImage(imageFilepath);
  console.log(`Processing ${path.basename(imageFilepath)} (${imageInfo.width}x${imageInfo.height})`);

  const configFilepath = getConfigPath(imageFilepath);
  const outputFilepath = imageFilepath.replace(path.extname(imageFilepath), '.3mf');

  if (!configExists(configFilepath)) {
    // First run: generate config file
    await generateConfigFromImage(imageFilepath, configFilepath);
  } else {
    // Subsequent run: process image to 3MF
    try {
      await processImageTo3MF(imageFilepath, configFilepath, outputFilepath);
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
