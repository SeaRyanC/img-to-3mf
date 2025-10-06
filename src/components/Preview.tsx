import { useEffect, useRef } from 'preact/hooks';
import { RGB, findClosestColor, colorsMatch } from '../utils/colorQuantization';

interface PreviewProps {
  imageData: ImageData;
  colors: RGB[];
  colorHeights: number[];
  width: number;
  showOnFront: boolean;
  transparencyKeyColor: RGB | null;
}

export function Preview({ imageData, colors, colorHeights, width, showOnFront, transparencyKeyColor }: PreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageData || colors.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw the preview with proper scaling
    const scale = 4; // Scale factor for better visibility
    canvas.width = imageData.width * scale;
    canvas.height = imageData.height * scale;
    
    // Disable image smoothing for crisp pixels
    ctx.imageSmoothingEnabled = false;
    
    // Draw checkerboard background for transparent areas
    const checkerSize = 8; // Size of each checker square
    for (let y = 0; y < canvas.height; y += checkerSize) {
      for (let x = 0; x < canvas.width; x += checkerSize) {
        const isEven = (Math.floor(x / checkerSize) + Math.floor(y / checkerSize)) % 2 === 0;
        ctx.fillStyle = isEven ? '#cccccc' : '#999999';
        ctx.fillRect(x, y, checkerSize, checkerSize);
      }
    }

    // Create a preview showing the quantized colors
    const previewData = new ImageData(imageData.width, imageData.height);
    
    for (let i = 0; i < imageData.data.length; i += 4) {
      const pixel = {
        r: imageData.data[i],
        g: imageData.data[i + 1],
        b: imageData.data[i + 2]
      };
      const alpha = imageData.data[i + 3];
      
      // Check transparency
      let isTransparent = alpha < 128;
      
      // Check against transparency key color
      if (!isTransparent && transparencyKeyColor && colorsMatch(pixel, transparencyKeyColor, 10)) {
        isTransparent = true;
      }
      
      if (isTransparent) {
        // Make fully transparent so checkerboard shows through
        previewData.data[i] = 0;
        previewData.data[i + 1] = 0;
        previewData.data[i + 2] = 0;
        previewData.data[i + 3] = 0;
      } else {
        const closestColorIndex = findClosestColor(pixel, colors);
        const closestColor = colors[closestColorIndex];
        
        previewData.data[i] = closestColor.r;
        previewData.data[i + 1] = closestColor.g;
        previewData.data[i + 2] = closestColor.b;
        previewData.data[i + 3] = 255;
      }
    }
    
    // Create a temporary canvas with the quantized data
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    
    tempCtx.putImageData(previewData, 0, 0);
    
    // Draw scaled up on top of checkerboard
    ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
  }, [imageData, colors, colorHeights, width, showOnFront, transparencyKeyColor]);

  return (
    <div className="preview-section">
      <h3>Preview (Quantized Colors)</h3>
      <canvas ref={canvasRef} className="preview-canvas" />
    </div>
  );
}
