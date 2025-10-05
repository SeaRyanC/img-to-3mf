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

    // Draw the preview
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(previewData, 0, 0);

    // Add a simple 3D effect by drawing layers
    const layerOffsetScale = 10; // pixels per mm
    
    // Draw stacked layers effect
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    
    tempCtx.putImageData(previewData, 0, 0);
    
    // Clear and redraw with layer effect
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    let currentOffset = 0;
    for (let i = colors.length - 1; i >= 0; i--) {
      const layerHeight = colorHeights[i] || 0.5;
      const offset = Math.floor(currentOffset * layerOffsetScale);
      
      // Draw this layer
      ctx.globalAlpha = 0.8;
      
      // Create a mask for this color
      const maskData = ctx.createImageData(imageData.width, imageData.height);
      for (let j = 0; j < previewData.data.length; j += 4) {
        const pixel = {
          r: previewData.data[j],
          g: previewData.data[j + 1],
          b: previewData.data[j + 2]
        };
        const closestColorIndex = findClosestColor(pixel, colors);
        
        if (closestColorIndex === i) {
          maskData.data[j] = previewData.data[j];
          maskData.data[j + 1] = previewData.data[j + 1];
          maskData.data[j + 2] = previewData.data[j + 2];
          maskData.data[j + 3] = 255;
        } else {
          maskData.data[j + 3] = 0;
        }
      }
      
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = imageData.width;
      maskCanvas.height = imageData.height;
      const maskCtx = maskCanvas.getContext('2d');
      if (maskCtx) {
        maskCtx.putImageData(maskData, 0, 0);
        ctx.drawImage(maskCanvas, offset, offset);
      }
      
      currentOffset += layerHeight;
    }
    
    ctx.globalAlpha = 1;
  }, [imageData, colors, colorHeights, width, showOnFront]);

  return (
    <div className="preview-section">
      <h3>Preview (Quantized Colors with Layer Effect)</h3>
      <canvas ref={canvasRef} className="preview-canvas" />
    </div>
  );
}
