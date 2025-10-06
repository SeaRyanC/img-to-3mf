# Image to 3MF Converter

A client-side web application that converts images into multi-color 3MF files suitable for 3D printing.

![App Screenshot](https://github.com/user-attachments/assets/766a3e26-d27c-4e72-9f26-e0d4b7b3d94d)

## Features

- **Multiple Input Methods**: Upload images via drag-and-drop, file browser, or paste from clipboard
- **Color Quantization**: Automatically reduce images to a specified number of colors (2-16) using median cut algorithm
- **Customizable Layer Heights**: Set individual height for each color layer
- **Size Control**: Specify the width of the printed object in millimeters
- **Face Selection**: Choose whether to display the image on the front or back face
- **Live Preview**: See a visualization of the quantized colors with layer effects
- **3MF Export**: Download ready-to-print 3MF files compatible with multi-color 3D printers

## Technology Stack

- **Preact**: Lightweight React alternative for the UI
- **TypeScript 5.9**: Type-safe development
- **Vite**: Fast build tool and dev server
- **JSZip**: 3MF file generation (3MF is a ZIP-based format)

## Getting Started

### Prerequisites

- Node.js (v20 or higher)
- NPM

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open your browser to `http://localhost:5173`

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

### Preview Production Build

```bash
npm run preview
```

## Usage

1. **Load an Image**: 
   - Drag and drop an image onto the upload area
   - Click "Browse Files" to select from your computer
   - Paste an image from your clipboard (Ctrl+V / Cmd+V)

2. **Adjust Settings**:
   - **Number of Colors**: Use the slider to select how many colors (2-16) to use in the output
   - **Width**: Set the width of the final object in millimeters
   - **Image Display**: Choose whether the image appears on the front or back face

3. **Configure Color Layers**:
   - Each detected color is shown with a color swatch
   - Adjust the height (in mm) for each color layer

4. **Preview**: View the quantized image with a 3D layer effect visualization

5. **Download**: Click "Download 3MF File" to save the 3D model file

## How It Works

### Color Quantization

The application uses the **median cut algorithm** to reduce the image to a specified number of colors:

1. Extracts all unique colors from the image
2. Groups colors into buckets by splitting along the dimension with the largest range
3. Continues splitting until the desired number of colors is reached
4. Calculates the average color for each bucket

For large images (>500k pixels), adaptive sampling reduces memory usage by ~70% while maintaining visual quality.

### Voxel Merging

Adjacent voxels of the same color are intelligently merged into larger rectangular regions:

- Reduces triangle count by ~96% (e.g., 30,000 → 1,204 triangles)
- Uses connected component labeling and greedy rectangular decomposition
- No visual quality loss

### Manifold Geometry

Each color object is a closed, watertight mesh:

- Vertices are shared between adjacent boxes (no duplicate vertices)
- Every edge is shared by exactly 2 triangles
- Ensures printability and proper slicing

### 3MF Generation

The 3MF file format is generated with Bambu Studio compatibility:

1. Creates voxels (3D boxes) for each pixel that matches a color
2. Merges adjacent voxels to optimize geometry
3. Each color becomes a separate object with its own material
4. Materials use **sRGB colorspace** (required by Bambu Studio)
5. Objects reference materials via `pindex` attribute
6. All layers positioned at Z=0 (build plate contact)
7. Models automatically centered at (125, 125) for 250×250mm build plates
8. Packages everything into a ZIP file with the `.3mf` extension

## Testing

Run the test suite to validate geometry and 3MF format:

```bash
node test/geometry.test.cjs
node test/3mf-validation.test.cjs
node test/manifold-bambu-fix.test.cjs
```

Tests verify:
- Voxel coordinate calculations
- Layer stacking (Z-axis positioning)
- Vertex/triangle generation
- Manifold mesh topology
- Bambu Studio color format (sRGB colorspace, #RRGGBB colors)
- Valid 3MF file structure

## License

This project is open source and available under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.