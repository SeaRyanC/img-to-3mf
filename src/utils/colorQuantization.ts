export interface RGB {
  r: number;
  g: number;
  b: number;
}

// Median cut algorithm for color quantization
export function quantizeColors(imageData: ImageData, colorCount: number): RGB[] {
  const pixels: RGB[] = [];
  
  // Extract unique colors
  const colorSet = new Map<string, RGB>();
  for (let i = 0; i < imageData.data.length; i += 4) {
    const r = imageData.data[i];
    const g = imageData.data[i + 1];
    const b = imageData.data[i + 2];
    const a = imageData.data[i + 3];
    
    // Skip fully transparent pixels
    if (a < 128) continue;
    
    const key = `${r},${g},${b}`;
    if (!colorSet.has(key)) {
      colorSet.set(key, { r, g, b });
    }
  }
  
  pixels.push(...colorSet.values());
  
  if (pixels.length <= colorCount) {
    return pixels;
  }
  
  // Median cut algorithm
  let buckets: RGB[][] = [pixels];
  
  while (buckets.length < colorCount) {
    // Find bucket with largest range
    let maxRange = 0;
    let maxBucketIndex = 0;
    
    for (let i = 0; i < buckets.length; i++) {
      const range = getColorRange(buckets[i]);
      if (range > maxRange) {
        maxRange = range;
        maxBucketIndex = i;
      }
    }
    
    // Split the bucket
    const bucket = buckets[maxBucketIndex];
    const [bucket1, bucket2] = splitBucket(bucket);
    
    buckets.splice(maxBucketIndex, 1, bucket1, bucket2);
  }
  
  // Get average color from each bucket
  return buckets.map(bucket => {
    const avg = { r: 0, g: 0, b: 0 };
    for (const pixel of bucket) {
      avg.r += pixel.r;
      avg.g += pixel.g;
      avg.b += pixel.b;
    }
    return {
      r: Math.round(avg.r / bucket.length),
      g: Math.round(avg.g / bucket.length),
      b: Math.round(avg.b / bucket.length)
    };
  });
}

function getColorRange(pixels: RGB[]): number {
  const rValues = pixels.map(p => p.r);
  const gValues = pixels.map(p => p.g);
  const bValues = pixels.map(p => p.b);
  
  const rRange = Math.max(...rValues) - Math.min(...rValues);
  const gRange = Math.max(...gValues) - Math.min(...gValues);
  const bRange = Math.max(...bValues) - Math.min(...bValues);
  
  return Math.max(rRange, gRange, bRange);
}

function splitBucket(pixels: RGB[]): [RGB[], RGB[]] {
  const rValues = pixels.map(p => p.r);
  const gValues = pixels.map(p => p.g);
  const bValues = pixels.map(p => p.b);
  
  const rRange = Math.max(...rValues) - Math.min(...rValues);
  const gRange = Math.max(...gValues) - Math.min(...gValues);
  const bRange = Math.max(...bValues) - Math.min(...bValues);
  
  let sortedPixels: RGB[];
  if (rRange >= gRange && rRange >= bRange) {
    sortedPixels = [...pixels].sort((a, b) => a.r - b.r);
  } else if (gRange >= bRange) {
    sortedPixels = [...pixels].sort((a, b) => a.g - b.g);
  } else {
    sortedPixels = [...pixels].sort((a, b) => a.b - b.b);
  }
  
  const mid = Math.floor(sortedPixels.length / 2);
  return [sortedPixels.slice(0, mid), sortedPixels.slice(mid)];
}

export function findClosestColor(pixel: RGB, palette: RGB[]): number {
  let minDistance = Infinity;
  let closestIndex = 0;
  
  for (let i = 0; i < palette.length; i++) {
    const distance = Math.sqrt(
      Math.pow(pixel.r - palette[i].r, 2) +
      Math.pow(pixel.g - palette[i].g, 2) +
      Math.pow(pixel.b - palette[i].b, 2)
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = i;
    }
  }
  
  return closestIndex;
}

export function rgbToHex(color: RGB): string {
  return '#' + [color.r, color.g, color.b]
    .map(x => x.toString(16).padStart(2, '0'))
    .join('');
}
