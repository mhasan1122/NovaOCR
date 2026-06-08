import React, { createContext, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { ocrService } from '../services/ocrService';

export const OCRContext = createContext<typeof ocrService>(ocrService);

export const OCRProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const webViewRef = useRef<WebView>(null);

  // HTML content running inside the hidden WebView.
  // This loads Tesseract.js, maintains cached workers, preprocesses images on Canvas,
  // and communicates back to React Native.
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"></script>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #121212;
            color: #ffffff;
            margin: 0;
            padding: 15px;
            font-size: 14px;
            line-height: 1.5;
          }
          #console {
            background-color: #1e1e1e;
            border-radius: 6px;
            padding: 10px;
            font-family: "Courier New", Courier, monospace;
            font-size: 11px;
            white-space: pre-wrap;
            word-break: break-all;
            height: 150px;
            overflow-y: auto;
            border: 1px solid #333;
          }
          .title {
            font-weight: 600;
            margin-top: 0;
            margin-bottom: 10px;
            color: #0a84ff;
          }
        </style>
      </head>
      <body>
        <h4 class="title">Tesseract.js Engine Bridge</h4>
        <pre id="console">Status: Ready. Waiting for recognition requests...</pre>

        <script>
          const workers = {};
          let currentId = null;

          const consoleEl = document.getElementById('console');
          function log(msg) {
            console.log(msg);
            const timestamp = new Date().toLocaleTimeString();
            consoleEl.textContent += '\\n[' + timestamp + '] ' + msg;
            consoleEl.scrollTop = consoleEl.scrollHeight;
          }

          function postMessageToRN(message) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify(message));
            }
          }

          // Global progress logger callback
          window.currentLogger = function(m) {
            postMessageToRN({
              type: 'PROGRESS',
              id: currentId,
              data: { progress: m.progress || 0, status: m.status || 'processing' }
            });
          };

          /**
           * Retrieves a cached Tesseract worker or instantiates a new one for the target language.
           */
          async function getWorker(language) {
            if (workers[language]) {
              log('Reusing cached worker for: ' + language);
              return workers[language];
            }

            log('Initializing new worker for: ' + language);
            const worker = await Tesseract.createWorker(language, 1, {
              logger: m => {
                if (currentId) {
                  window.currentLogger(m);
                }
              }
            });
            workers[language] = worker;
            log('Worker initialized and cached for: ' + language);
            return worker;
          }

          /**
           * Main OCR processor. Loads image source, preprocesses on canvas if requested,
           * feeds to Tesseract, and posts results back to React Native.
           */
          async function processOCR(id, imageSource, language, preprocessOptions = {}) {
            currentId = id;
            try {
              log('Received request: ' + id + ' (Language: ' + language + ')');
              const worker = await getWorker(language);
              
              let finalSource = imageSource;

              // Canvas-based image enhancement
              if (preprocessOptions.grayscale || preprocessOptions.contrast || preprocessOptions.binarize) {
                log('Applying canvas image filters...');
                const img = new Image();
                img.crossOrigin = 'Anonymous';
                
                const loadPromise = new Promise((resolve, reject) => {
                  img.onload = () => resolve(img);
                  img.onerror = (e) => reject(new Error('Failed to load image into HTML canvas'));
                });
                
                img.src = imageSource;
                await loadPromise;

                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imgData.data;

                // Process pixels for grayscale and thresholding
                for (let i = 0; i < data.length; i += 4) {
                  const r = data[i];
                  const g = data[i + 1];
                  const b = data[i + 2];

                  // 1. Convert to grayscale
                  let gray = 0.299 * r + 0.587 * g + 0.114 * b;

                  // 2. Simple Contrast stretching (expand dynamic range between 40 and 210)
                  if (preprocessOptions.contrast) {
                    if (gray < 40) {
                      gray = 0;
                    } else if (gray > 210) {
                      gray = 255;
                    } else {
                      gray = ((gray - 40) / 170) * 255;
                    }
                  }

                  // 3. Simple Binarization (thresholding at 127)
                  if (preprocessOptions.binarize) {
                    gray = gray > 127 ? 255 : 0;
                  }

                  data[i] = gray;     // R
                  data[i + 1] = gray; // G
                  data[i + 2] = gray; // B
                }
                
                ctx.putImageData(imgData, 0, 0);
                finalSource = canvas;
                log('Canvas image filters applied successfully.');
              }

              log('Executing recognition...');
              const result = await worker.recognize(finalSource);
              
              // Map structured words
              const words = (result.data.words || []).map(w => ({
                text: w.text,
                confidence: w.confidence / 100
              }));

              log('Recognition completed! Words extracted: ' + words.length);
              
              postMessageToRN({
                type: 'RESULT',
                id: id,
                data: {
                  text: result.data.text,
                  confidence: result.data.confidence / 100,
                  words: words
                }
              });
            } catch (err) {
              log('Error during OCR processing: ' + err.message);
              postMessageToRN({
                type: 'ERROR',
                id: id,
                error: err.message
              });
            } finally {
              currentId = null;
            }
          }

          // Listen for incoming recognition requests
          const handleRNMessage = (e) => {
            try {
              const data = JSON.parse(e.data);
              if (data.type === 'RECOGNIZE') {
                processOCR(data.id, data.image, data.language, data.preprocessOptions);
              }
            } catch (err) {
              log('Error parsing React Native payload: ' + err.message);
            }
          };

          window.addEventListener('message', handleRNMessage);
          document.addEventListener('message', handleRNMessage);
          log('Bridge initialized. Awaiting commands.');
        </script>
      </body>
    </html>
  `;

  return (
    <OCRContext.Provider value={ocrService}>
      {children}
      <View style={styles.hiddenWebView}>
        <WebView
          ref={ref => {
            if (ref) {
              ocrService.registerWebView(ref);
              // @ts-ignore
              webViewRef.current = ref;
            } else {
              ocrService.unregisterWebView();
            }
          }}
          source={{ html: htmlContent }}
          onMessage={event => ocrService.handleMessage(event)}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          originWhitelist={['*']}
          mixedContentMode="always"
        />
      </View>
    </OCRContext.Provider>
  );
};

const styles = StyleSheet.create({
  hiddenWebView: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
});
