# Geometry Tests

This directory contains comprehensive tests for the 3MF geometry generation.

## Running Tests

```bash
node test/geometry.test.cjs
node test/3mf-validation.test.cjs
```

## Test Coverage

### geometry.test.cjs
Tests the fundamental geometry calculations:
- ✓ ImageData creation
- ✓ Voxel coordinate calculation
- ✓ Layer stacking (Z-axis)
- ✓ Vertex generation (8 vertices per voxel)
- ✓ Triangle generation (12 triangles per voxel)
- ✓ Aspect ratio calculation

### 3mf-validation.test.cjs
Validates generated 3MF files:
- ✓ ZIP structure (proper 3MF format)
- ✓ XML structure
- ✓ Vertex coordinates (non-degenerate, valid values)
- ✓ Triangle indices (valid references)
- ✓ Manifold geometry (each edge shared by exactly 2 triangles)

## Test Results

All tests pass with the current implementation:

```
✅ Voxel mode geometry is CORRECT
   - Each pixel becomes a voxel (8 vertices, 12 triangles)
   - Coordinates properly calculated
   - Model is manifold
   - No degenerate geometry
```

## Known Geometry Characteristics

### Per-Pixel Voxelization
The current implementation creates **one voxel per pixel**. For a 200x200 image:
- 40,000 voxels
- 320,000 vertices
- 480,000 triangles

This is correct for lithophane/3D printing where each pixel's height represents its color/brightness.

### Coordinate System
- **X-axis**: Width direction (left to right)
- **Y-axis**: Depth direction (front to back)
- **Z-axis**: Height direction (layer stacking)

### Layer Stacking
Each color layer stacks on top of the previous:
- Layer 0: Z = 0.0 to colorHeight[0]
- Layer 1: Z = colorHeight[0] to colorHeight[0] + colorHeight[1]
- etc.

## Debugging Tips

If you suspect geometry issues:

1. **Create a simple test image** (e.g., 4x4 with clear patterns)
2. **Run the validation test** to check for:
   - Degenerate coordinates (all X/Y/Z the same)
   - Invalid triangle indices
   - Non-manifold edges
3. **Check vertex counts**: Should be `width × height × 8`
4. **Check triangle counts**: Should be `width × height × 12`
