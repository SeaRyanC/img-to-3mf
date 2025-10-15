# img-to-3mf

A web application for converting raster images into 3MF files suitable for multi-color 3D printing.

## Features

- **Image Input**: Support for drag & drop, file browse, and clipboard paste
- **Transparency Modes**:
  - **Full Image**: Converts entire image to rectangular output
  - **Transparent Corners**: Uses corner pixels to define transparency key
  - **Island Mode**: Flood-fill from borders to remove background while preserving internal details
- **Color Quantization**: Automatic color reduction with k-means clustering (2-16 colors)
- **Image Preprocessing**: Noise reduction and isolated speck removal
- **Background Options**:
  - **Through**: All colors extend through all layers
  - **Backplate**: Solid base layer with configurable color and thickness
- **3D Preview**: Real-time WebGL preview with orbit controls
- **Customization**:
  - Adjustable output dimensions (width/height)
  - Individual layer heights per color
  - Front/back face selection
- **3MF Export**: Standards-compliant 3MF file generation

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Then open http://localhost:5173 in your browser.

## Building

```bash
npm run build
```

The built files will be in the `dist` directory.

## Usage

1. Upload an image using drag & drop, file browser, or paste from clipboard
2. Select transparency mode:
   - **Full Image**: For images that should be fully rendered
   - **Transparent Corners**: For images with a solid background color in corners
   - **Island Mode**: For images with a background field to remove (e.g., logo on white background)
3. Adjust the number of colors (2-16) - the app will use only necessary colors
4. Configure background mode:
   - **Through**: Layered appearance with no backing
   - **Backplate**: Add a solid backing layer with custom color and thickness
5. Set output dimensions and individual layer heights
6. Choose whether to display on front or back face
7. Preview the 3D model in real-time
8. Click "Generate 3MF" to download the file

## Technology Stack

- **Preact**: Lightweight React alternative for UI
- **TypeScript 5.9**: Type-safe development
- **Vite**: Fast build tooling
- **Three.js**: WebGL-based 3D preview
- **fflate**: ZIP compression for 3MF packaging

## 3MF File Structure

The generated 3MF files follow the standard 3MF specification with:
- `[Content_Types].xml`: MIME type definitions
- `_rels/.rels`: Package relationships
- `3D/3dmodel.model`: Main model file with references to sub-objects
- `3D/_rels/3dmodel.model.rels`: Model relationships
- `3D/Objects/object_*.model`: Individual mesh objects for each color layer

## License

MIT