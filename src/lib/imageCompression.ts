import imageCompression from 'browser-image-compression'

/**
 * Compress an image file to reduce file size while maintaining good quality
 * @param file - The image file to compress
 * @param maxSizeMB - Maximum file size in MB (default: 1MB)
 * @param maxWidthOrHeight - Maximum width or height in pixels (default: 1920px)
 * @returns Compressed file
 */
export async function compressImage(
  file: File,
  maxSizeMB: number = 1,
  maxWidthOrHeight: number = 1920
): Promise<File> {
  // Only compress if file is larger than target size
  const targetSizeBytes = maxSizeMB * 1024 * 1024
  if (file.size <= targetSizeBytes) {
    console.log('Image already small enough, skipping compression')
    return file
  }

  console.log(`Compressing image: ${(file.size / 1024 / 1024).toFixed(2)}MB -> target: ${maxSizeMB}MB`)

  const options = {
    maxSizeMB,
    maxWidthOrHeight,
    useWebWorker: true, // Use web worker for better performance
    fileType: 'image/jpeg', // Always convert to JPEG for better compression
    initialQuality: 0.8, // Start with 80% quality
  }

  try {
    const compressedFile = await imageCompression(file, options)
    const compressionRatio = ((1 - compressedFile.size / file.size) * 100).toFixed(1)
    console.log(
      `Compression complete: ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB (${compressionRatio}% reduction)`
    )
    return compressedFile
  } catch (error) {
    console.error('Error compressing image:', error)
    // If compression fails, return original file
    return file
  }
}

