import { useState, useEffect } from 'preact/hooks';
import type { TransparencyMode, BackgroundMode, ColorLayer, AppState } from '../types';
import { Preview } from './Preview';
import { preprocessImage } from '../utils/imageProcessing';
import { quantizeColors, rgbToHex } from '../utils/colorQuantization';
import { generateColorLayers } from '../utils/layerGeneration';
import { createLayerMesh, createBackplateMesh } from '../utils/meshGeneration';
import { generate3MF, download3MF } from '../utils/3mfGenerator';

export function App() {
  const [state, setState] = useState<AppState>({
    image: null,
    colorCount: 8,
    colors: [],
    transparencyMode: 'full',
    backgroundMode: 'through',
    backplateColor: '#ffffff',
    backplateThickness: 1.0,
    outputWidth: 50,
    outputHeight: 50,
    outputDepth: 5,
    displayFace: 'front'
  });
  
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [meshes, setMeshes] = useState<Array<{ mesh: any; color: string; name: string }>>([]);
  const [backplateMesh, setBackplateMesh] = useState<any>(null);
  
  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setState(s => ({ ...s, image: img }));
        processImage(img, state.transparencyMode, state.colorCount);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };
  
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageUpload(file);
    }
  };
  
  const handlePaste = (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            handleImageUpload(file);
          }
        }
      }
    }
  };
  
  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);
  
  const processImage = async (img: HTMLImageElement, mode: TransparencyMode, maxColors: number) => {
    setProcessing(true);
    
    try {
      const imageData = preprocessImage(img, mode);
      const colors = quantizeColors(imageData, maxColors);
      
      const colorLayers: ColorLayer[] = colors.map(rgb => ({
        color: rgbToHex(rgb[0], rgb[1], rgb[2]),
        rgb,
        height: 0.5
      }));
      
      setState(s => ({ ...s, colors: colorLayers }));
      updateMeshes(imageData, colorLayers, state.outputWidth, state.outputHeight, state.backgroundMode, state.backplateColor, state.backplateThickness);
    } catch (error) {
      console.error('Error processing image:', error);
    } finally {
      setProcessing(false);
    }
  };
  
  const updateMeshes = (imageData: ImageData, colors: ColorLayer[], width: number, height: number, bgMode: BackgroundMode, _bpColor: string, bpThickness: number) => {
    const layers = generateColorLayers(imageData, colors);
    const newMeshes = [];
    
    for (const color of colors) {
      const layerData = layers.get(color.color);
      if (layerData) {
        const mesh = createLayerMesh(layerData, width, height, 5, color.height);
        newMeshes.push({ mesh, color: color.color, name: `Layer ${color.color}` });
      }
    }
    
    setMeshes(newMeshes);
    
    if (bgMode === 'backplate') {
      const bpMesh = createBackplateMesh(width, height, bpThickness);
      setBackplateMesh(bpMesh);
    } else {
      setBackplateMesh(null);
    }
  };
  
  useEffect(() => {
    if (state.image) {
      processImage(state.image, state.transparencyMode, state.colorCount);
    }
  }, [state.transparencyMode, state.colorCount]);
  
  useEffect(() => {
    if (state.image && state.colors.length > 0) {
      const imageData = preprocessImage(state.image, state.transparencyMode);
      updateMeshes(imageData, state.colors, state.outputWidth, state.outputHeight, state.backgroundMode, state.backplateColor, state.backplateThickness);
    }
  }, [state.outputWidth, state.outputHeight, state.colors, state.backgroundMode, state.backplateColor, state.backplateThickness]);
  
  const handleGenerate3MF = async () => {
    setProcessing(true);
    try {
      const blob = await generate3MF(
        meshes,
        state.backgroundMode === 'backplate' ? backplateMesh : undefined,
        state.backgroundMode === 'backplate' ? state.backplateColor : undefined
      );
      download3MF(blob);
    } catch (error) {
      console.error('Error generating 3MF:', error);
    } finally {
      setProcessing(false);
    }
  };
  
  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="section">
          <h3>Image Input</h3>
          <div
            className={`image-input ${dragOver ? 'drag-over' : ''}`}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
          >
            <p>Drag & drop, paste, or browse</p>
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              id="file-input"
              onChange={(e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) handleImageUpload(file);
              }}
            />
            <button onClick={() => document.getElementById('file-input')?.click()}>
              Browse Files
            </button>
          </div>
          {state.image && (
            <img src={state.image.src} alt="Preview" className="image-preview" />
          )}
        </div>
        
        <div className="section">
          <h3>Transparency Mode</h3>
          <div className="radio-group">
            <div className="radio-option">
              <input
                type="radio"
                id="mode-full"
                name="transparency"
                checked={state.transparencyMode === 'full'}
                onChange={() => setState(s => ({ ...s, transparencyMode: 'full' }))}
              />
              <label htmlFor="mode-full">Full Image</label>
            </div>
            <div className="radio-option">
              <input
                type="radio"
                id="mode-transparent"
                name="transparency"
                checked={state.transparencyMode === 'transparent'}
                onChange={() => setState(s => ({ ...s, transparencyMode: 'transparent' }))}
              />
              <label htmlFor="mode-transparent">Transparent Corners</label>
            </div>
            <div className="radio-option">
              <input
                type="radio"
                id="mode-island"
                name="transparency"
                checked={state.transparencyMode === 'island'}
                onChange={() => setState(s => ({ ...s, transparencyMode: 'island' }))}
              />
              <label htmlFor="mode-island">Island Mode</label>
            </div>
          </div>
        </div>
        
        <div className="section">
          <h3>Colors</h3>
          <div className="form-group">
            <div className="range-value">
              <label>Max Colors: {state.colorCount}</label>
            </div>
            <input
              type="range"
              min="2"
              max="16"
              value={state.colorCount}
              onChange={(e) => setState(s => ({ ...s, colorCount: parseInt((e.target as HTMLInputElement).value) }))}
            />
          </div>
          <div className="color-layers">
            {state.colors.map((color, idx) => (
              <div key={idx} className="color-layer">
                <div className="color-swatch" style={{ backgroundColor: color.color }} />
                <input
                  type="number"
                  step="0.1"
                  value={color.height}
                  onChange={(e) => {
                    const newColors = [...state.colors];
                    newColors[idx].height = parseFloat((e.target as HTMLInputElement).value) || 0.5;
                    setState(s => ({ ...s, colors: newColors }));
                  }}
                  placeholder="Height (mm)"
                />
              </div>
            ))}
          </div>
        </div>
        
        <div className="section">
          <h3>Background</h3>
          <div className="radio-group">
            <div className="radio-option">
              <input
                type="radio"
                id="bg-through"
                name="background"
                checked={state.backgroundMode === 'through'}
                onChange={() => setState(s => ({ ...s, backgroundMode: 'through' }))}
              />
              <label htmlFor="bg-through">Through</label>
            </div>
            <div className="radio-option">
              <input
                type="radio"
                id="bg-backplate"
                name="background"
                checked={state.backgroundMode === 'backplate'}
                onChange={() => setState(s => ({ ...s, backgroundMode: 'backplate' }))}
              />
              <label htmlFor="bg-backplate">Backplate</label>
            </div>
          </div>
          {state.backgroundMode === 'backplate' && (
            <>
              <div className="form-group">
                <label>Backplate Color</label>
                <input
                  type="color"
                  value={state.backplateColor}
                  onChange={(e) => setState(s => ({ ...s, backplateColor: (e.target as HTMLInputElement).value }))}
                />
              </div>
              <div className="form-group">
                <label>Backplate Thickness (mm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={state.backplateThickness}
                  onChange={(e) => setState(s => ({ ...s, backplateThickness: parseFloat((e.target as HTMLInputElement).value) || 1.0 }))}
                />
              </div>
            </>
          )}
        </div>
        
        <div className="section">
          <h3>Dimensions</h3>
          <div className="form-group">
            <label>Width (mm)</label>
            <input
              type="number"
              value={state.outputWidth}
              onChange={(e) => setState(s => ({ ...s, outputWidth: parseFloat((e.target as HTMLInputElement).value) || 50 }))}
            />
          </div>
          <div className="form-group">
            <label>Height (mm)</label>
            <input
              type="number"
              value={state.outputHeight}
              onChange={(e) => setState(s => ({ ...s, outputHeight: parseFloat((e.target as HTMLInputElement).value) || 50 }))}
            />
          </div>
        </div>
        
        <div className="section">
          <h3>Display Face</h3>
          <div className="radio-group">
            <div className="radio-option">
              <input
                type="radio"
                id="face-front"
                name="face"
                checked={state.displayFace === 'front'}
                onChange={() => setState(s => ({ ...s, displayFace: 'front' }))}
              />
              <label htmlFor="face-front">Front</label>
            </div>
            <div className="radio-option">
              <input
                type="radio"
                id="face-back"
                name="face"
                checked={state.displayFace === 'back'}
                onChange={() => setState(s => ({ ...s, displayFace: 'back' }))}
              />
              <label htmlFor="face-back">Back</label>
            </div>
          </div>
        </div>
        
        <button
          className="button-primary"
          onClick={handleGenerate3MF}
          disabled={!state.image || processing || meshes.length === 0}
        >
          {processing ? 'Processing...' : 'Generate 3MF'}
        </button>
      </div>
      
      <div className="preview-container">
        {meshes.length > 0 || backplateMesh ? (
          <Preview
            meshes={meshes}
            backplateMesh={state.backgroundMode === 'backplate' ? backplateMesh : undefined}
            backplateColor={state.backgroundMode === 'backplate' ? state.backplateColor : undefined}
          />
        ) : (
          <div className="preview-loading">
            {state.image ? 'Processing...' : 'Upload an image to begin'}
          </div>
        )}
      </div>
    </div>
  );
}
