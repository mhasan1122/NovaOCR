import { useState, useCallback, useContext } from 'react';
import { OCRContext } from '../components/OCRProvider';
import { RecognizeOptions, RecognizeResult } from '../services/ocrService';

/**
 * Reusable hook to execute OCR processing on images.
 * Manages reactive UI states for loading, progress percentage, text logs,
 * and error/success outputs.
 */
export function useOCR() {
  const ocrServiceInstance = useContext(OCRContext);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('idle');
  const [result, setResult] = useState<RecognizeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recognize = useCallback(
    async (imageUri: string, options: RecognizeOptions = {}): Promise<RecognizeResult> => {
      setIsProcessing(true);
      setProgress(0);
      setStatus('starting');
      setError(null);
      setResult(null);

      // Merge user callbacks with reactive state updates
      const mergedOptions: RecognizeOptions = {
        ...options,
        onProgress: (p, s) => {
          setProgress(p);
          setStatus(s);
          if (options.onProgress) {
            options.onProgress(p, s);
          }
        },
      };

      try {
        const ocrResult = await ocrServiceInstance.recognize(imageUri, mergedOptions);
        setResult(ocrResult);
        setStatus('completed');
        setIsProcessing(false);
        return ocrResult;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setStatus('failed');
        setIsProcessing(false);
        throw err;
      }
    },
    [ocrServiceInstance]
  );

  const reset = useCallback(() => {
    setIsProcessing(false);
    setProgress(0);
    setStatus('idle');
    setResult(null);
    setError(null);
  }, []);

  return {
    recognize,
    reset,
    isProcessing,
    progress,
    status,
    result,
    error,
  };
}
