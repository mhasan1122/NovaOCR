import { preprocessImage } from '../utils/imageProcessing';

export interface WordData {
  text: string;
  confidence: number;
}

export interface RecognizeResult {
  text: string;
  confidence: number;
  words: WordData[];
  processingTime: number;
}

export interface PreprocessOptions {
  grayscale?: boolean;
  binarize?: boolean;
  contrast?: boolean;
  maxWidth?: number;
  quality?: number;
}

export interface RecognizeOptions {
  language?: string;
  onProgress?: (progress: number, status: string) => void;
  preprocess?: PreprocessOptions;
}

class OCRService {
  private webViewRef: any = null;
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: RecognizeResult) => void;
      reject: (reason: any) => void;
      onProgress?: (progress: number, status: string) => void;
      startTime: number;
    }
  >();

  /**
   * Registers the reference to the hidden WebView.
   * Called by OCRProvider when the WebView mounts.
   */
  registerWebView(ref: any) {
    this.webViewRef = ref;
  }

  /**
   * Unregisters the WebView reference.
   */
  unregisterWebView() {
    this.webViewRef = null;
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  }

  /**
   * Recognizes text in an image.
   * Handles local image resizing, compression, base64 conversion, and WebView OCR execution.
   * 
   * @param imageUri Local file URI (or base64 data URL).
   * @param options Configurable options including language, progress callback, and preprocessing filters.
   */
  async recognize(imageUri: string, options: RecognizeOptions = {}): Promise<RecognizeResult> {
    if (!this.webViewRef) {
      throw new Error(
        'OCR Service: WebView is not registered. Ensure the <OCRProvider> is mounted at the root of your application.'
      );
    }

    const id = this.generateId();
    const language = options.language || 'eng';
    const onProgress = options.onProgress;
    const startTime = Date.now();

    let base64Data = '';
    
    // If the image is already a base64 Data URL, we can send it directly.
    if (imageUri.startsWith('data:')) {
      base64Data = imageUri;
    } else {
      // Call local resizing and compression utility
      if (onProgress) {
        onProgress(0, 'preprocessing image');
      }
      const prep = options.preprocess || {};
      const preprocessed = await preprocessImage(
        imageUri,
        prep.maxWidth || 1200,
        prep.quality || 0.8
      );
      base64Data = preprocessed.base64Data;
    }

    return new Promise<RecognizeResult>((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve,
        reject,
        onProgress,
        startTime,
      });

      const payload = {
        type: 'RECOGNIZE',
        id,
        image: base64Data,
        language,
        preprocessOptions: {
          grayscale: options.preprocess?.grayscale ?? true,
          binarize: options.preprocess?.binarize ?? false,
          contrast: options.preprocess?.contrast ?? true,
        },
      };

      try {
        this.webViewRef.postMessage(JSON.stringify(payload));
      } catch (err) {
        this.pendingRequests.delete(id);
        reject(new Error(`Failed to transmit image to OCR WebView: ${err instanceof Error ? err.message : String(err)}`));
      }
    });
  }

  /**
   * Receives message events from the WebView and processes them.
   */
  handleMessage(event: any) {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      const { type, id } = message;
      const request = this.pendingRequests.get(id);

      if (!request) return;

      if (type === 'PROGRESS') {
        const { progress, status } = message.data;
        if (request.onProgress) {
          request.onProgress(progress, status);
        }
      } else if (type === 'RESULT') {
        const { text, confidence, words } = message.data;
        const processingTime = Date.now() - request.startTime;
        
        request.resolve({
          text,
          confidence,
          words,
          processingTime,
        });
        this.pendingRequests.delete(id);
      } else if (type === 'ERROR') {
        request.reject(new Error(message.error || 'OCR Processing error inside WebView'));
        this.pendingRequests.delete(id);
      }
    } catch (err) {
      console.error('OCR Service Bridge Error:', err);
    }
  }
}

export const ocrService = new OCRService();
