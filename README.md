# Image to 3MF Converter

A web application that converts raster images into 3MF files for multi-color 3D printing. Built with Preact, TypeScript, and Three.js.

## Features

- **Image Upload**: Drag & drop, browse, or paste images (PNG, JPEG, etc.)
- **Color Quantization**: Automatically reduce images to up to 16 discrete colors
- **Noise Removal**: Apply median filtering and isolated pixel removal to clean up images
- **Transparency Modes**:
  - **Full Image**: Convert the entire rectangular image
  - **Transparent Corners**: Use corner colors as transparency key
  - **Island Mode**: Flood-fill from borders to remove background
- **3D Mesh Generation**: Uses Marching Cubes algorithm to create watertight triangle meshes
- **Per-Layer Height Control**: Adjust the thickness of each color layer independently
- **WebGL Preview**: Animated 3D preview with rotating meshes
- **3MF Export**: Download ready-to-print 3MF files with multi-color support

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- npm 10.x or higher

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

### Build

```bash
npm run build
```

The built files will be in the `dist` directory.

### Preview Production Build

```bash
npm run preview
```

## Usage

1. **Upload an Image**: Click the upload area, drag & drop, or paste (Ctrl+V) an image
2. **Configure Settings**:
   - Adjust max colors (2-16)
   - Set physical dimensions (width in mm)
   - Adjust scale factor
   - Choose display face (front/back)
   - Select transparency mode
3. **Generate 3D Model**: Click "Generate 3D Model" to process
4. **Adjust Layer Heights**: Fine-tune the height of each color layer
5. **Export**: Click "Export 3MF File" to download the result

## Technical Details

### Image Processing Pipeline

1. **Load and Quantize**: Reduce image to ≤16 colors using color histogram analysis
2. **Denoise**: Apply 3×3 median filter and remove isolated pixels
3. **Apply Transparency**: Process based on selected mode (full/transparent/island)
4. **Voxelization**: Create 3D binary volume for each color by extruding 2D mask
5. **Marching Cubes**: Generate watertight triangle meshes at iso-value 0.5
6. **Export**: Package meshes into 3MF format with color materials

### Key Algorithms

- **Color Quantization**: Histogram-based color binning with Euclidean distance
- **Median Filter**: 3×3 kernel for noise suppression
- **Isolated Pixel Removal**: 8-neighbor connectivity analysis
- **Flood Fill**: Border-seeded algorithm for island mode
- **Marching Cubes**: Standard implementation with 256-case lookup table
- **Voxel Extrusion**: Layer-by-layer 2D to 3D conversion

### File Format

The exported 3MF file is a ZIP archive containing:
- `[Content_Types].xml`: MIME type definitions
- `_rels/.rels`: Package relationships
- `3D/3dmodel.model`: 3D model data with meshes, vertices, triangles, and color materials

## Architecture

```
src/
├── components/
│   ├── ImageUpload.tsx      # File upload UI
│   └── Preview3D.tsx         # WebGL 3D preview
├── lib/
│   ├── imageProcessing.ts   # Image loading, quantization, filtering
│   ├── marchingCubes.ts     # Voxelization and mesh generation
│   └── export3mf.ts         # 3MF/STL/OBJ export
├── types/
│   └── index.ts             # TypeScript type definitions
├── App.tsx                  # Main application component
├── main.tsx                 # Application entry point
└── style.css                # Global styles
```

## Technologies

- **Preact**: Lightweight React alternative
- **TypeScript 5.9**: Type-safe JavaScript
- **Vite**: Fast build tool and dev server
- **Three.js**: WebGL 3D rendering
- **JSZip**: ZIP file generation for 3MF format

## License

ISC