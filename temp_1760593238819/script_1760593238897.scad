
// Auto-generated OpenSCAD script for image-to-3MF conversion
// Image dimensions: 400x448 pixels
// Height: 1.2mm
// Scale: 0.2mm per pixel in XY, 1.2mm tall

scale([0.2, 0.2, 1.2])
linear_extrude(1)
projection()
intersection() {
    translate([0, 0, -2])
    surface(file = "/home/runner/work/img-to-3mf/img-to-3mf/temp_1760593238819/mask_1760593238873.png", center = true, convexity = 10);
    cube([10000, 10000, 1], center = true);
}
