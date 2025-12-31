import * as fs from 'fs';
import * as path from 'path';
import { parse as parseJsonc } from 'jsonc-parser';
import { findNearestBambuColor, hexToRgb } from './colors';

export interface ColorConfig {
  height: number;
  color: string; // Bambu filament color name
}

export interface BackingConfig {
  color: string;
  thickness: number;
}

export interface SandwichConfig {
  color: string;
  thickness: number;
}

export interface Config {
  colors: Record<string, ColorConfig>;
  options: {
    backing?: BackingConfig;
    sandwich?: SandwichConfig;
  };
}

export function generateDefaultConfig(modalColors: string[]): Config {
  const colors: Record<string, ColorConfig> = {};

  for (const hexColor of modalColors) {
    const rgb = hexToRgb(hexColor);
    const bambuColor = findNearestBambuColor(rgb);

    colors[hexColor] = {
      height: 1.2,
      color: bambuColor.name,
    };
  }

  return {
    colors,
    options: {},
  };
}

export function writeConfig(filepath: string, config: Config): void {
  const jsonContent = JSON.stringify(config, null, 2);
  
  // Add comment blocks showing each possibility
  const commentBlock = `// Color Modality Options:
//
// Option 1: Default mode (no options specified)
// All colors go through the entire object
//   "options": {}
//
// Option 2: Backing mode
// A backing layer with all other colors on top (measured relative to backing)
//   "options": {
//     "backing": {
//       "color": "black",
//       "thickness": 1.2
//     }
//   }
//
// Option 3: Sandwich mode  
// Colors embedded within a plane, flush on both front and back
//   "options": {
//     "sandwich": {
//       "color": "black",
//       "thickness": 1.2
//     }
//   }
//
`;
  
  const fullContent = commentBlock + jsonContent;
  fs.writeFileSync(filepath, fullContent, 'utf-8');
}

export function readConfig(filepath: string): Config {
  const content = fs.readFileSync(filepath, 'utf-8');
  const config = parseJsonc(content) as Config;

  // Validate config
  if (!config.colors || typeof config.colors !== 'object') {
    throw new Error('Invalid config: missing or invalid "colors" field');
  }

  if (!config.options) {
    config.options = {};
  }

  return config;
}

export function configExists(filepath: string): boolean {
  return fs.existsSync(filepath);
}

export function getConfigPath(imageFilepath: string): string {
  const dir = path.dirname(imageFilepath);
  const basename = path.basename(imageFilepath, path.extname(imageFilepath));
  return path.join(dir, `${basename}.jsonc`);
}
