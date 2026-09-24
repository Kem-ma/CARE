import { keyedError } from './errors';

// Re-encodes a photo as a smaller JPEG. This keeps uploads quick on slow connections, and
// because the image is redrawn on a canvas, hidden metadata (including GPS tags) is dropped.
export async function toJpeg(file, maxSide = 1600, quality = 0.8) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      throw keyedError('Unreadable image', 'img.unreadable');
    }
  }

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(keyedError('Encode failed', 'img.failed'))),
      'image/jpeg',
      quality,
    ),
  );
}
