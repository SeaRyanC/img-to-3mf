import { useRef, useState } from 'preact/hooks';

interface ImageInputProps {
  onImageLoad: (imageData: ImageData, url: string) => void;
  onError: (message: string) => void;
}

export function ImageInput({ onImageLoad, onError }: ImageInputProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const processImage = (file: File) => {
    if (!file.type.startsWith('image/')) {
      onError('Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        onImageLoad(imageData, e.target?.result as string);
      };
      img.onerror = () => {
        onError('Failed to load image');
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      onError('Failed to read file');
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      processImage(file);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer?.files[0];
    if (file) {
      processImage(file);
    }
  };

  const handlePaste = (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          processImage(file);
          break;
        }
      }
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  // Set up paste listener
  if (typeof window !== 'undefined') {
    window.addEventListener('paste', handlePaste as any);
  }

  return (
    <>
      <div
        className={`image-input-area ${isDragging ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <p>Drag and drop an image here, paste from clipboard, or click to browse</p>
        <button className="browse-button" type="button">
          Browse Files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </>
  );
}
