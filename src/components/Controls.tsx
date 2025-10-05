interface ControlsProps {
  colorCount: number;
  onColorCountChange: (count: number) => void;
  width: number;
  onWidthChange: (width: number) => void;
  showOnFront: boolean;
  onShowOnFrontChange: (showOnFront: boolean) => void;
}

export function Controls({
  colorCount,
  onColorCountChange,
  width,
  onWidthChange,
  showOnFront,
  onShowOnFrontChange
}: ControlsProps) {
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
    </div>
  );
}
