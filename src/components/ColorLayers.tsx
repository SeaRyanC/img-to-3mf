import { RGB, rgbToHex } from '../utils/colorQuantization';

interface ColorLayersProps {
  colors: RGB[];
  heights: number[];
  onHeightChange: (index: number, height: number) => void;
}

export function ColorLayers({ colors, heights, onHeightChange }: ColorLayersProps) {
  return (
    <div className="color-layers">
      <h3>Color Layers</h3>
      {colors.map((color, index) => (
        <div key={index} className="color-layer">
          <div
            className="color-swatch"
            style={{ backgroundColor: rgbToHex(color) }}
          />
          <label>
            Color {index + 1} ({rgbToHex(color)})
          </label>
          <input
            type="number"
            min="0.1"
            max="10"
            step="0.1"
            value={heights[index] || 0.5}
            onChange={(e) => onHeightChange(index, parseFloat((e.target as HTMLInputElement).value))}
            placeholder="Height (mm)"
          />
          <span>mm</span>
        </div>
      ))}
    </div>
  );
}
