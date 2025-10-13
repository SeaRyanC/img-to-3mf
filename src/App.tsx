import { useState } from 'preact/hooks';
import { ImageUpload } from './components/ImageUpload';
import { Preview3D } from './components/Preview3D';
import type { ImageData2D, ColorLayer, ProcessingOptions } from './types';
import { preprocessImage } from './lib/imageProcessing';
import { marchingCubes, createVoxelVolume, createColorMask } from './lib/marchingCubes';
import { export3MF, downloadFile } from './lib/export3mf';

export function App() {
  const [imageData, setImageData] = useState<ImageData2D | null>(null);
  const [options, setOptions] = useState<ProcessingOptions>({
    maxColors: 16,
    width: 100,
    height: 100,
    scale: 1.0,
    displayFace: 'front',
    transparencyMode: 'full',
    colorLayers: [],
  });
  const [processing, setProcessing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleImageLoad = (img: ImageData2D) => {
    setImageData(img);
    
    // Create preview
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const imgData = ctx.createImageData(img.width, img.height);
      imgData.data.set(img.data);
      ctx.putImageData(imgData, 0, 0);
      setPreviewImage(canvas.toDataURL());
    }

    // Reset color layers
    setOptions(prev => ({ ...prev, colorLayers: [] }));
  };

  const handleProcess = async () => {
    if (!imageData) return;

    setProcessing(true);
    try {
      // Preprocess image
      const { quantized, palette } = preprocessImage(
        imageData,
        options.maxColors,
        options.transparencyMode
      );

      // Calculate physical dimensions
      const physicalWidth = options.width * options.scale;

      // Calculate voxel size based on image resolution
      // Use smaller voxel size to ensure adequate depth resolution
      const voxelSize = physicalWidth / Math.max(imageData.width, imageData.height);
      
      // Default layer height
      const defaultLayerHeight = 2.0; // mm

      // Generate mesh for each color
      const colorLayers: ColorLayer[] = [];

      for (const color of palette) {
        // Create mask for this color
        const mask = createColorMask(quantized.data, quantized.width, quantized.height, color);

        // Check if mask has any pixels
        const hasPixels = mask.some(v => v === 1);
        if (!hasPixels) continue;

        // Create voxel volume with enough depth for solid volume
        // Ensure minimum depth resolution (at least 6 voxels for proper marching cubes)
        // Marching cubes needs enough resolution to properly capture volume
        const minDepthVoxels = 6;
        const depthVoxels = Math.max(minDepthVoxels, Math.ceil(defaultLayerHeight / voxelSize));
        const actualDepth = depthVoxels * voxelSize;
        
        const volume = createVoxelVolume(mask, quantized.width, quantized.height, actualDepth, voxelSize);

        // Apply marching cubes
        const mesh = marchingCubes(
          volume.data,
          volume.width,
          volume.height,
          volume.depth,
          0.5,
          voxelSize
        );

        colorLayers.push({
          color,
          height: actualDepth,
          mesh,
        });
      }

      setOptions(prev => ({ ...prev, colorLayers }));
    } catch (error) {
      console.error('Processing error:', error);
      alert('Failed to process image. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleExport = async () => {
    if (options.colorLayers.length === 0) return;

    try {
      const blob = await export3MF(options.colorLayers);
      downloadFile(blob, 'output.3mf');
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export 3MF file.');
    }
  };

  const handleLayerHeightChange = (index: number, height: number) => {
    setOptions(prev => ({
      ...prev,
      colorLayers: prev.colorLayers.map((layer, i) =>
        i === index ? { ...layer, height } : layer
      ),
    }));
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>Image to 3MF Converter</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Left panel - Controls */}
        <div>
          <div style={{ marginBottom: '20px' }}>
            <ImageUpload onImageLoad={handleImageLoad} />
          </div>

          {previewImage && (
            <div style={{ marginBottom: '20px' }}>
              <h3>Original Image</h3>
              <img
                src={previewImage}
                alt="Preview"
                style={{ maxWidth: '100%', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
          )}

          {imageData && (
            <div style={{ marginBottom: '20px' }}>
              <h3>Settings</h3>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>
                  Max Colors: {options.maxColors}
                </label>
                <input
                  type="range"
                  min="2"
                  max="16"
                  value={options.maxColors}
                  onChange={(e) => setOptions(prev => ({ ...prev, maxColors: parseInt((e.target as HTMLInputElement).value) }))}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>
                  Width (mm): {options.width}
                </label>
                <input
                  type="range"
                  min="10"
                  max="300"
                  value={options.width}
                  onChange={(e) => setOptions(prev => ({ ...prev, width: parseInt((e.target as HTMLInputElement).value) }))}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>
                  Scale: {options.scale.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="5"
                  step="0.1"
                  value={options.scale}
                  onChange={(e) => setOptions(prev => ({ ...prev, scale: parseFloat((e.target as HTMLInputElement).value) }))}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>
                  Display Face
                </label>
                <select
                  value={options.displayFace}
                  onChange={(e) => setOptions(prev => ({ ...prev, displayFace: (e.target as HTMLSelectElement).value as 'front' | 'back' }))}
                  style={{ width: '100%', padding: '5px' }}
                >
                  <option value="front">Front</option>
                  <option value="back">Back</option>
                </select>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>
                  Transparency Mode
                </label>
                <div>
                  <label style={{ marginRight: '15px' }}>
                    <input
                      type="radio"
                      value="full"
                      checked={options.transparencyMode === 'full'}
                      onChange={(e) => setOptions(prev => ({ ...prev, transparencyMode: (e.target as HTMLInputElement).value as any }))}
                    />
                    {' '}Full Image
                  </label>
                  <label style={{ marginRight: '15px' }}>
                    <input
                      type="radio"
                      value="transparent"
                      checked={options.transparencyMode === 'transparent'}
                      onChange={(e) => setOptions(prev => ({ ...prev, transparencyMode: (e.target as HTMLInputElement).value as any }))}
                    />
                    {' '}Transparent Corners
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="island"
                      checked={options.transparencyMode === 'island'}
                      onChange={(e) => setOptions(prev => ({ ...prev, transparencyMode: (e.target as HTMLInputElement).value as any }))}
                    />
                    {' '}Island
                  </label>
                </div>
              </div>

              <button
                onClick={handleProcess}
                disabled={processing}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '16px',
                  backgroundColor: processing ? '#ccc' : '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: processing ? 'not-allowed' : 'pointer',
                  marginBottom: '10px',
                }}
              >
                {processing ? 'Processing...' : 'Generate 3D Model'}
              </button>
            </div>
          )}

          {options.colorLayers.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h3>Color Layers ({options.colorLayers.length})</h3>
              {options.colorLayers.map((layer, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '10px',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                  }}
                >
                  <div
                    style={{
                      width: '30px',
                      height: '30px',
                      backgroundColor: `rgb(${layer.color[0]}, ${layer.color[1]}, ${layer.color[2]})`,
                      border: '1px solid #000',
                      marginRight: '10px',
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '12px' }}>
                      Height: {layer.height}mm
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="10"
                      step="0.5"
                      value={layer.height}
                      onChange={(e) => handleLayerHeightChange(idx, parseFloat((e.target as HTMLInputElement).value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              ))}

              <button
                onClick={handleExport}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '16px',
                  backgroundColor: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Export 3MF File
              </button>
            </div>
          )}
        </div>

        {/* Right panel - 3D Preview */}
        <div>
          <h3>3D Preview</h3>
          <div
            style={{
              width: '100%',
              height: '600px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            {options.colorLayers.length > 0 ? (
              <Preview3D colorLayers={options.colorLayers} />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#666',
                }}
              >
                Process an image to see 3D preview
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
