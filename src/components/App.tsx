import { useState, useEffect } from 'preact/hooks';
import { ImageInput } from './ImageInput';
import { Controls } from './Controls';
import { ColorLayers } from './ColorLayers';
import { Preview } from './Preview';
import { quantizeColors, RGB, detectCornerColor } from '../utils/colorQuantization';
import { generate3MF, ModelConfig } from '../utils/3mfGenerator';

export function App() {
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [colorCount, setColorCount] = useState(4);
  const [colors, setColors] = useState<RGB[]>([]);
  const [width, setWidth] = useState(50); // mm
  const [showOnFront, setShowOnFront] = useState(true);
  const [colorHeights, setColorHeights] = useState<number[]>([]);
  const [error, setError] = useState<string>('');
  const [transparencyKeyColor, setTransparencyKeyColor] = useState<RGB | null>(null);

  const handleImageLoad = (data: ImageData, url: string) => {
    setImageData(data);
    setImageUrl(url);
    setError('');
    
    // Auto-detect transparency key color from corners
    const cornerColor = detectCornerColor(data);
    if (cornerColor) {
      setTransparencyKeyColor(cornerColor);
    }
  };

  const handleError = (message: string) => {
    setError(message);
  };

  // Quantize colors when image or color count changes
  useEffect(() => {
    if (!imageData) {
      setColors([]);
      setColorHeights([]);
      return;
    }

    try {
      const quantized = quantizeColors(imageData, colorCount);
      setColors(quantized);
      // Initialize heights - default 0.5mm per layer
      setColorHeights(new Array(quantized.length).fill(0.5));
    } catch (err) {
      setError('Failed to process image colors');
      console.error(err);
    }
  }, [imageData, colorCount]);

  const handleColorHeightChange = (index: number, height: number) => {
    const newHeights = [...colorHeights];
    newHeights[index] = height;
    setColorHeights(newHeights);
  };

  const handleDownload = async () => {
    if (!imageData || colors.length === 0) return;

    try {
      const config: ModelConfig = {
        width,
        height: width, // We'll calculate actual height based on aspect ratio in the generator
        colorHeights,
        colors,
        imageData,
        showOnFront,
        transparencyKeyColor
      };

      const blob = await generate3MF(config);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'model.3mf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to generate 3MF file');
      console.error(err);
    }
  };

  return (
    <div className="container">
      <h1>Image to 3MF Converter</h1>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <ImageInput onImageLoad={handleImageLoad} onError={handleError} />

      {imageUrl && (
        <div className="image-preview">
          <img src={imageUrl} alt="Uploaded image" />
        </div>
      )}

      {imageData && (
        <>
          <Controls
            colorCount={colorCount}
            onColorCountChange={setColorCount}
            width={width}
            onWidthChange={setWidth}
            showOnFront={showOnFront}
            onShowOnFrontChange={setShowOnFront}
            transparencyKeyColor={transparencyKeyColor}
            onTransparencyKeyColorChange={setTransparencyKeyColor}
          />

          {colors.length > 0 && (
            <>
              <ColorLayers
                colors={colors}
                heights={colorHeights}
                onHeightChange={handleColorHeightChange}
              />

              <Preview
                imageData={imageData}
                colors={colors}
                colorHeights={colorHeights}
                width={width}
                showOnFront={showOnFront}
              />

              <div className="actions">
                <button className="download-button" onClick={handleDownload}>
                  Download 3MF File
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
