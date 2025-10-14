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
- **3D Mesh Generation**: 
  - **Contour-based approach**: Minimal triangle meshes using boundary extraction and polygon extrusion
  - **Concave shape support**: Preserves concave features (L-shapes, C-shapes, stars, etc.)
  - **Interior void support**: Automatically detects and preserves holes in shapes
  - **Efficient**: 95%+ reduction in triangle count vs. marching cubes
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
4. **Contour Extraction**: Extract 2D boundary contours for each color using boundary tracing
5. **Polygon Generation**: Create ordered polygon vertices preserving concave features
6. **Extrusion & Triangulation**: Extrude 2D polygons to 3D and triangulate faces
7. **Export**: Package meshes into 3MF format with color materials

### Key Algorithms

- **Color Quantization**: Histogram-based color binning with Euclidean distance
- **Median Filter**: 3×3 kernel for noise suppression
- **Isolated Pixel Removal**: 8-neighbor connectivity analysis
- **Flood Fill**: Border-seeded algorithm for island mode and component detection
- **Boundary Extraction**: Pixel-corner based contour tracing preserving concave features
- **Polygon Simplification**: Removes colinear points while preserving shape
- **Ear Clipping Triangulation**: Handles arbitrary simple polygons for face generation
- **Extrusion**: Layer-by-layer 2D to 3D conversion with correct winding

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
│   ├── contourMesh.ts       # Efficient contour-based mesh generation
│   ├── marchingCubes.ts     # Legacy marching cubes (for testing)
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

## Shape Support

The application correctly handles a wide variety of shapes:

### Convex Shapes ✓
- Rectangles, squares
- Circles, ellipses
- Regular polygons

### Concave Shapes ✓
- L-shapes, T-shapes, C-shapes
- Star shapes
- Irregular polygons with indentations
- Any shape with inward-curving boundaries

### Complex Shapes ✓
- Multiple disconnected regions
- Shapes with interior holes (donuts, frames)
- Combined convex and concave features

The contour extraction algorithm uses pixel-corner boundary tracing, which preserves all concave and convex features of the original raster image. Volume calculations are accurate within 1% for simple shapes and within 10-15% for complex curved shapes (due to pixel discretization).

## Testing

Run the test suite:

```bash
npm test
```

Tests include:
- Volume validation for rectangles (100% accurate)
- Volume validation for circles (~10% tolerance due to pixel approximation)
- Concave shape handling (L-shapes, C-shapes)
- Triangle count optimization
- Boundary extraction accuracy

## License

ISC