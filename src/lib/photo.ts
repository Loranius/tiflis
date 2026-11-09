/** Photos are shrunk on the device before upload: the longest side to `maxDimension`, JPEG at 0.82. */
export const PHOTO_MAX_SOURCE_BYTES = 15 * 1024 * 1024;

export async function resizePhotoFile(file: File, maxDimension = 1600): Promise<{ dataUrl: string; contentType: string }> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Браузер не може обробити фото.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.82), contentType: 'image/jpeg' };
  } finally {
    bitmap.close();
  }
}

/** Checks a picked file before resizing; returns a Ukrainian error or null. */
export function photoFileProblem(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'Обери файл зображення.';
  if (file.size > PHOTO_MAX_SOURCE_BYTES) return 'Файл завеликий (максимум 15 МБ).';
  return null;
}
