# img-to-3mf

Convert images to 3MF files for multi-color 3D printing on Bambu Lab printers.

## Features

- Converts images (PNG, JPEG, GIF, BMP, WebP, TIFF) to 3MF format
- Automatically detects and removes background
- Identifies up to 16 most common colors in the image
- Maps colors to nearest Bambu Lab Basic PLA filaments
- Generates editable configuration file for customization
- Supports three color modalities: default, backing, and sandwich modes
- Compatible with Bambu Studio

## Requirements

- Node.js 18 or higher
- OpenSCAD (must be installed and in PATH)

### Installing OpenSCAD

- **Ubuntu/Debian**: `sudo apt-get install openscad`
- **macOS**: `brew install openscad` or download from https://openscad.org/
- **Windows**: Download installer from https://openscad.org/

## Installation

```bash
npm install -g img-to-3mf
```

Or use without installing:

```bash
npx img-to-3mf <image-file>
```

## Usage

### First Run: Generate Configuration

```bash
img-to-3mf myimage.jpg
```

Output:
```
Processing myimage.jpg (309x312)
Analyzing image...
Wrote myimage.jsonc, edit and re-run to continue
```

This creates a `myimage.jsonc` configuration file:

```jsonc
{
  "colors": {
    "#ff0000": {
      "height": 1.2,
      "color": "red"
    },
    "#0000ff": {
      "height": 1.2,
      "color": "blue"
    }
  },
  "options": {}
}
```

### Edit Configuration

Customize the configuration file:

- **`height`**: Extrusion height in millimeters for each color layer
- **`color`**: Bambu Lab filament name (e.g., "red", "blue", "white", "black")

#### Color Modalities

The tool supports three different color modalities:

**1. Default Mode (no options specified)**: All colors go through the entire object
```jsonc
{
  "colors": {
    "#ff0000": {
      "height": 1.2,
      "color": "red"
    }
  },
  "options": {}
}
```

**2. Backing Mode**: A backing layer with all other colors on top (measured relative to backing)
```jsonc
{
  "colors": {
    "#ff0000": {
      "height": 1.2,
      "color": "red"
    }
  },
  "options": {
    "backing": {
      "color": "black",
      "thickness": 1.2
    }
  }
}
```

**3. Sandwich Mode**: Colors embedded within a plane, flush on both front and back
```jsonc
{
  "colors": {
    "#ff0000": {
      "height": 1.2,
      "color": "red"
    }
  },
  "options": {
    "sandwich": {
      "color": "black",
      "thickness": 1.2
    }
  }
}
```

### Second Run: Generate 3MF

```bash
img-to-3mf myimage.jpg
```

Output:
```
Processing myimage.jpg (309x312)
Processing image...
Generating backing layer...
Generating mesh for color #ff0000 (red)...
Generating mesh for color #0000ff (blue)...
Combining meshes into final 3MF...
Generated myimage.3mf
```

The `myimage.3mf` file can now be opened in Bambu Studio.

## How It Works

1. **Image Analysis**: Analyzes the image and identifies foreground colors using flood-fill from edges
2. **Color Clustering**: Groups similar colors together to handle JPEG artifacts
3. **Color Quantization**: Identifies the 16 most common colors
4. **Color Mapping**: Maps each color to the nearest Bambu Lab Basic PLA filament
5. **Mask Generation**: Creates monochrome heightmap masks for each color
6. **Mesh Generation**: Uses OpenSCAD to convert heightmaps to 3D meshes
7. **3MF Assembly**: Combines all meshes into a single multi-object 3MF file with color metadata

## Supported Bambu Lab Colors

The tool automatically maps colors to these Bambu Lab Basic PLA filaments:

- black
- white
- red
- orange
- yellow
- green
- blue
- purple
- grey
- brown
- pink
- light-blue
- light-green

## Tips

- Use images with stark color differences for best results
- The tool handles compression artifacts by treating similar colors as identical
- Background is automatically detected and excluded
- Use backing mode for better adhesion with a base layer
- Use sandwich mode for a flush print on both sides
- Adjust heights in the config file to control layer thickness

## Development

```bash
# Clone repository
git clone https://github.com/SeaRyanC/img-to-3mf.git
cd img-to-3mf

# Install dependencies
npm install

# Build
npm run build

# Run locally
node dist/cli.js test.png
```

## License

ISC
