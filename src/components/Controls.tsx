import { RGB, rgbToHex } from '../utils/colorQuantization';

interface ControlsProps {
  colorCount: number;
  onColorCountChange: (count: number) => void;
  width: number;
  onWidthChange: (width: number) => void;
  showOnFront: boolean;
  onShowOnFrontChange: (showOnFront: boolean) => void;
  transparencyKeyColor: RGB | null;
  onTransparencyKeyColorChange: (color: RGB | null) => void;
  detectOutline: boolean;
  onDetectOutlineChange: (detectOutline: boolean) => void;
  useSmoothing: boolean;
  onUseSmoothingChange: (useSmoothing: boolean) => void;
}

export function Controls({
  colorCount,
  onColorCountChange,
  width,
  onWidthChange,
  showOnFront,
  onShowOnFrontChange,
  transparencyKeyColor,
  onTransparencyKeyColorChange,
  detectOutline,
  onDetectOutlineChange,
  useSmoothing,
  onUseSmoothingChange
}: ControlsProps) {
  const handleColorPickerChange = (e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    const r = parseInt(value.slice(1, 3), 16);
    const g = parseInt(value.slice(3, 5), 16);
    const b = parseInt(value.slice(5, 7), 16);
    onTransparencyKeyColorChange({ r, g, b });
  };
  
  const handleClearTransparency = () => {
    onTransparencyKeyColorChange(null);
  };
  
  return (
    <div className="controls">
      <div className="control-group">
        <label htmlFor="colorCount">Number of Colors</label>
        <input
          id="colorCount"
          type="range"
          min="2"
          max="16"
          value={colorCount}
          onChange={(e) => onColorCountChange(parseInt((e.target as HTMLInputElement).value))}
        />
        <div className="range-value">{colorCount} colors</div>
      </div>

      <div className="control-group">
        <label htmlFor="width">Width (mm)</label>
        <input
          id="width"
          type="number"
          min="10"
          max="300"
          step="1"
          value={width}
          onChange={(e) => onWidthChange(parseFloat((e.target as HTMLInputElement).value))}
        />
      </div>

      <div className="control-group">
        <label htmlFor="face">Image Display</label>
        <select
          id="face"
          value={showOnFront ? 'front' : 'back'}
          onChange={(e) => onShowOnFrontChange((e.target as HTMLSelectElement).value === 'front')}
        >
          <option value="front">Front Face</option>
          <option value="back">Back Face</option>
        </select>
      </div>
      
      <div className="control-group">
        <label htmlFor="transparencyKey">Transparency Key Color</label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            id="transparencyKey"
            type="color"
            value={transparencyKeyColor ? rgbToHex(transparencyKeyColor) : '#ffffff'}
            onChange={handleColorPickerChange}
          />
          <button 
            type="button"
            onClick={handleClearTransparency}
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            Clear
          </button>
          {transparencyKeyColor && (
            <span style={{ fontSize: '12px', color: '#666' }}>
              {rgbToHex(transparencyKeyColor)}
            </span>
          )}
        </div>
      </div>
      
      <div className="control-group">
        <label htmlFor="detectOutline">
          <input
            id="detectOutline"
            type="checkbox"
            checked={detectOutline}
            onChange={(e) => onDetectOutlineChange((e.target as HTMLInputElement).checked)}
            style={{ marginRight: '8px' }}
          />
          Detect Outline (Treat Uniform Background as Transparent)
        </label>
      </div>
      
      <div className="control-group">
        <label htmlFor="useSmoothing">
          <input
            id="useSmoothing"
            type="checkbox"
            checked={useSmoothing}
            onChange={(e) => onUseSmoothingChange((e.target as HTMLInputElement).checked)}
            style={{ marginRight: '8px' }}
          />
          Use Smooth Geometry (Marching Cubes for Large Images)
        </label>
      </div>
    </div>
  );
}
