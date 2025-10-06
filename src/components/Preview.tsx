import { useEffect, useRef } from 'preact/hooks';
import { RGB, findClosestColor } from '../utils/colorQuantization';

interface PreviewProps {
  imageData: ImageData;
  colors: RGB[];
  colorHeights: number[];
  width: number;
  showOnFront: boolean;
}

export function Preview({ imageData, colors, colorHeights, width, showOnFront }: PreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageData || colors.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create a preview showing the quantized colors
    const previewData = new ImageData(imageData.width, imageData.height);
    
    for (let i = 0; i < imageData.data.length; i += 4) {
      const pixel = {
        r: imageData.data[i],
        g: imageData.data[i + 1],
        b: imageData.data[i + 2]
      };
      const alpha = imageData.data[i + 3];
      
      if (alpha < 128) {
        previewData.data[i] = 255;
        previewData.data[i + 1] = 255;
        previewData.data[i + 2] = 255;
        previewData.data[i + 3] = 255;
      } else {
        const closestColorIndex = findClosestColor(pixel, colors);
        const closestColor = colors[closestColorIndex];
        
        previewData.data[i] = closestColor.r;
        previewData.data[i + 1] = closestColor.g;
        previewData.data[i + 2] = closestColor.b;
        previewData.data[i + 3] = 255;
      }
    }

    // Draw the preview with proper scaling
    const scale = 4; // Scale factor for better visibility
    canvas.width = imageData.width * scale;
    canvas.height = imageData.height * scale;
    
    // Disable image smoothing for crisp pixels
    ctx.imageSmoothingEnabled = false;
    
    // Create a temporary canvas with the quantized data
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    
    tempCtx.putImageData(previewData, 0, 0);
    
    // Draw scaled up
    ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);

    // No layer offset effect - just show the quantized image clearly
    // This prevents X/Y position offset confusion in the preview
  }, [imageData, colors, colorHeights, width, showOnFront]);

  return (
    <div className="preview-section">
      <h3>Preview (Quantized Colors with Layer Effect)</h3>
      <canvas ref={canvasRef} className="preview-canvas" />
    </div>
  );
}
