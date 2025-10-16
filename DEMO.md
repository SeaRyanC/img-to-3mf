# img-to-3mf Demonstration

This document shows a complete example of converting an image to a 3MF file.

## Step 1: Create or Prepare Your Image

We'll use a simple test image with three colors:

```python
from PIL import Image, ImageDraw

img = Image.new('RGB', (80, 80), color='white')
draw = ImageDraw.Draw(img)
draw.rectangle([10, 10, 35, 35], fill='#C12E1F')  # Bambu Red
draw.ellipse([45, 10, 70, 35], fill='#0A2989')     # Bambu Blue
draw.rectangle([10, 45, 35, 70], fill='#F5DC3A')   # Bambu Yellow
img.save('demo.png')
```

## Step 2: First Run - Generate Configuration

```bash
$ img-to-3mf demo.png
Processing demo.png (80x80)
Analyzing image...
Wrote demo.jsonc, edit and re-run to continue
```

This creates `demo.jsonc`:

```jsonc
{
  "colors": {
    "#c12e1f": {
      "height": 1.2,
      "color": "red"
    },
    "#f5dc3a": {
      "height": 1.2,
      "color": "yellow"
    },
    "#0a2989": {
      "height": 1.2,
      "color": "blue"
    }
  },
  "options": {}
}
```

## Step 3: (Optional) Edit Configuration

You can customize the configuration:

```jsonc
{
  "colors": {
    "#c12e1f": {
      "height": 2.0,      // Increased height for red layer
      "color": "red"
    },
    "#f5dc3a": {
      "height": 1.5,
      "color": "yellow"
    },
    "#0a2989": {
      "height": 1.0,
      "color": "blue"
    }
  },
  "options": {
    "backplane": {        // Added backplane for better adhesion
      "color": "black",
      "height": 0.6
    }
  }
}
```

## Step 4: Second Run - Generate 3MF

```bash
$ img-to-3mf demo.png
Processing demo.png (80x80)
Processing image...
Generating backplane...
Running OpenSCAD: openscad -o ".../backplane.3mf" ".../script_xxx.scad"
OpenSCAD output: 
Generating mesh for color #c12e1f (red)...
Running OpenSCAD: openscad -o ".../color_c12e1f.3mf" ".../script_xxx.scad"
OpenSCAD output: 
Generating mesh for color #f5dc3a (yellow)...
Running OpenSCAD: openscad -o ".../color_f5dc3a.3mf" ".../script_xxx.scad"
OpenSCAD output: 
Generating mesh for color #0a2989 (blue)...
Running OpenSCAD: openscad -o ".../color_0a2989.3mf" ".../script_xxx.scad"
OpenSCAD output: 
Combining meshes into final 3MF...
Generated demo.3mf
```

## Step 5: Open in Bambu Studio

The generated `demo.3mf` file can now be opened in Bambu Studio. It will contain:
- 1 black backplane object
- 1 red square object
- 1 yellow square object
- 1 blue circle object

Each object is properly colored and positioned according to the original image.

## What Happens Behind the Scenes

1. **Image Analysis**: The tool analyzes the image pixel by pixel
2. **Background Detection**: Uses flood-fill from the edges to identify background (white)
3. **Color Detection**: Finds the most common colors (red, yellow, blue)
4. **Color Mapping**: Maps each color to the nearest Bambu Lab filament
5. **Mask Generation**: Creates grayscale heightmaps for each color
6. **Mesh Generation**: OpenSCAD converts heightmaps to 3D meshes
7. **3MF Assembly**: Combines all meshes into a single 3MF file with proper metadata

## Tips

- **Image Quality**: Use images with clear, distinct colors
- **Background**: Ensure background is a solid color different from your objects
- **Colors**: The tool handles JPEG artifacts, but PNG works best
- **Heights**: Adjust heights in the config file for your desired layer thickness
- **Backplane**: Add a backplane for better first-layer adhesion

## Troubleshooting

**"OpenSCAD is not installed"**
- Install OpenSCAD from https://openscad.org/
- Make sure it's in your system PATH

**"Colors not detected correctly"**
- Check if background is solid
- Try increasing contrast in your image
- Manually edit the generated .jsonc file

**"Background included as a color"**
- Ensure background touches at least one edge of the image
- Background should be a solid color

**"File size too large"**
- Reduce image resolution
- Use simpler shapes with fewer pixels
