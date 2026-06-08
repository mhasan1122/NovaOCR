import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export interface PreprocessResult {
  uri: string;
  base64Data: string;
  width: number;
  height: number;
}

/**
 * Preprocesses an image to optimize it for Tesseract OCR.
 * This function resizes large images to a maximum width of 1200px (maintaining aspect ratio)
 * and compresses them to reduce file size. Then, it converts the output to a base64 Data URL.
 * 
 * @param imageUri Local path or URI of the image to process.
 * @param maxWidth Maximum width of the preprocessed image (default: 1200).
 * @param quality Compression quality from 0.0 to 1.0 (default: 0.8).
 */
export async function preprocessImage(
  imageUri: string,
  maxWidth = 1200,
  quality = 0.8
): Promise<PreprocessResult> {
  try {
    // Perform resizing and compression using expo-image-manipulator
    const manipResult = await manipulateAsync(
      imageUri,
      [{ resize: { width: maxWidth } }],
      { compress: quality, format: SaveFormat.JPEG }
    );

    // Convert the resulting compressed image file to base64 Data URL
    const base64 = await FileSystem.readAsStringAsync(manipResult.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const base64Data = `data:image/jpeg;base64,${base64}`;

    return {
      uri: manipResult.uri,
      base64Data,
      width: manipResult.width,
      height: manipResult.height,
    };
  } catch (error) {
    console.error('OCR Preprocessing Error:', error);
    throw new Error(`Failed to preprocess image for OCR: ${error instanceof Error ? error.message : String(error)}`);
  }
}
