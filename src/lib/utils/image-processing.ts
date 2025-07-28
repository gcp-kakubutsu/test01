/**
 * Image processing utilities for maintaining quality
 */

/**
 * Process image file to ensure high quality
 * @param file - The image file to process
 * @param maxWidth - Maximum width (default: 2048px)
 * @param quality - JPEG quality (default: 0.95)
 * @returns Promise<Blob> - Processed image blob
 */
export async function processImageForUpload(
  file: File,
  maxWidth: number = 2048,
  quality: number = 0.95
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        
        // Calculate dimensions maintaining aspect ratio
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }
        
        // Set canvas size
        canvas.width = width;
        canvas.height = height;
        
        // Enable high quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw image
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to blob with high quality
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to process image'));
            }
          },
          file.type === 'image/png' ? 'image/png' : 'image/jpeg',
          quality
        );
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Check if image needs processing
 * @param file - The image file to check
 * @returns boolean - Whether the image needs processing
 */
export function needsImageProcessing(file: File): boolean {
  // Process if file is larger than 2MB or width might be > 2048px
  return file.size > 2 * 1024 * 1024;
}