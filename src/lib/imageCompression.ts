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
  const fileSizeKB = file.size / 1024
  
  // If file is over 300KB, aggressively compress down to 100KB max
  if (fileSizeKB > 300) {
    console.log(`⚠️ Large file detected: ${fileSizeKB.toFixed(0)}KB -> compressing down to 100KB max`)
    maxSizeMB = 0.1 // 100KB
    maxWidthOrHeight = 800 // Smaller dimension for large files
  } else {
    console.log(`Compressing image: ${fileSizeKB.toFixed(0)}KB -> target: ${maxSizeMB}MB, max dimension: ${maxWidthOrHeight}px`)
  }

  const options = {
    maxSizeMB,
    maxWidthOrHeight,
    useWebWorker: true, // Use web worker for better performance
    fileType: 'image/jpeg', // Always convert to JPEG for better compression
    initialQuality: 0.5, // Aggressive compression: 50% quality to minimize file size
  }

  try {
    const compressedFile = await imageCompression(file, options)
    const compressionRatio = ((1 - compressedFile.size / file.size) * 100).toFixed(1)
    const finalSizeKB = compressedFile.size / 1024
    console.log(
      `Compression complete: ${finalSizeKB.toFixed(0)}KB (${compressionRatio}% reduction)`
    )
    return compressedFile
  } catch (error) {
    console.error('Error compressing image:', error)
    // If compression fails, return original file
    return file
  }
}

