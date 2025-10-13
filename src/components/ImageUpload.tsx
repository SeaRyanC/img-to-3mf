import { useRef } from 'preact/hooks';
import type { ImageData2D } from '../types';
import { loadImage, loadImageFromClipboard } from '../lib/imageProcessing';

interface ImageUploadProps {
  onImageLoad: (imageData: ImageData2D) => void;
}

export function ImageUpload({ onImageLoad }: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const handleFile = async (file: File) => {
    try {
      const imageData = await loadImage(file);
      onImageLoad(imageData);
    } catch (error) {
      console.error('Failed to load image:', error);
      alert('Failed to load image. Please try another file.');
    }
  };

  const handleFileSelect = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      handleFile(input.files[0]);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (dropZoneRef.current) {
      dropZoneRef.current.style.borderColor = '#4CAF50';
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    if (dropZoneRef.current) {
      dropZoneRef.current.style.borderColor = '#ccc';
    }
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    if (dropZoneRef.current) {
      dropZoneRef.current.style.borderColor = '#ccc';
    }

    const files = e.dataTransfer?.files;
    if (files && files[0]) {
      await handleFile(files[0]);
    }
  };

  const handlePaste = async (e: ClipboardEvent) => {
    try {
      const imageData = await loadImageFromClipboard(e);
      if (imageData) {
        onImageLoad(imageData);
      }
    } catch (error) {
      console.error('Failed to load image from clipboard:', error);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  // Add paste listener to window
  if (typeof window !== 'undefined') {
    window.addEventListener('paste', handlePaste as any);
  }

  return (
    <div
      ref={dropZoneRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        border: '2px dashed #ccc',
        borderRadius: '8px',
        padding: '40px',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'border-color 0.3s',
      }}
      onClick={handleBrowseClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      <div>
        <p style={{ fontSize: '18px', marginBottom: '10px' }}>
          Drop image here, click to browse, or paste (Ctrl+V)
        </p>
        <p style={{ fontSize: '14px', color: '#666' }}>
          Supports PNG, JPEG, and other image formats
        </p>
      </div>
    </div>
  );
}
