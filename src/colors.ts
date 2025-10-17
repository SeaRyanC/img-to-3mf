// Bambu Lab Basic PLA filament colors
// Based on Bambu Lab's standard color offerings
export interface FilamentColor {
  name: string;
  hex: string;
  rgb: { r: number; g: number; b: number };
}

export const BAMBU_BASIC_COLORS: FilamentColor[] = [
  { name: 'black', hex: '#161616', rgb: { r: 22, g: 22, b: 22 } },
  { name: 'white', hex: '#FFFFFF', rgb: { r: 255, g: 255, b: 255 } },
  { name: 'red', hex: '#C12E1F', rgb: { r: 193, g: 46, b: 31 } },
  { name: 'orange', hex: '#E66E2F', rgb: { r: 230, g: 110, b: 47 } },
  { name: 'yellow', hex: '#F5DC3A', rgb: { r: 245, g: 220, b: 58 } },
  { name: 'green', hex: '#018001', rgb: { r: 1, g: 128, b: 1 } },
  { name: 'blue', hex: '#0A2989', rgb: { r: 10, g: 41, b: 137 } },
  { name: 'purple', hex: '#6B2D8F', rgb: { r: 107, g: 45, b: 143 } },
  { name: 'grey', hex: '#808080', rgb: { r: 128, g: 128, b: 128 } },
  { name: 'brown', hex: '#5C3317', rgb: { r: 92, g: 51, b: 23 } },
  { name: 'pink', hex: '#FF69B4', rgb: { r: 255, g: 105, b: 180 } },
  { name: 'light-blue', hex: '#87CEEB', rgb: { r: 135, g: 206, b: 235 } },
  { name: 'light-green', hex: '#90EE90', rgb: { r: 144, g: 238, b: 144 } },
];

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

export function colorDistance(
  c1: { r: number; g: number; b: number },
  c2: { r: number; g: number; b: number }
): number {
  // Euclidean distance in RGB space
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
}

export function findNearestBambuColor(rgb: { r: number; g: number; b: number }): FilamentColor {
  let nearest = BAMBU_BASIC_COLORS[0];
  let minDistance = colorDistance(rgb, nearest.rgb);

  for (const color of BAMBU_BASIC_COLORS) {
    const distance = colorDistance(rgb, color.rgb);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = color;
    }
  }

  return nearest;
}
