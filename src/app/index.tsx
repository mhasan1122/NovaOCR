import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ExpoClipboard from 'expo-clipboard';
import { useOCR } from '@/hooks/useOCR';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { historyService } from '@/services/historyService';

export default function HomeScreen() {
  const theme = useTheme();
  const { recognize, isProcessing, progress, status, result, error, reset } = useOCR();

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  // OCR Options States
  const [selectedLanguage, setSelectedLanguage] = useState('eng');
  const [grayscale, setGrayscale] = useState(true);
  const [contrast, setContrast] = useState(true);
  const [binarize, setBinarize] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // SVG Icons
  const CameraIcon = () => (
    <View style={styles.iconContainer}>
      <View style={[styles.cameraBody, { borderColor: theme.text }]} />
      <View style={[styles.cameraLens, { borderColor: theme.text }]} />
      <View style={[styles.cameraFlash, { backgroundColor: theme.text }]} />
    </View>
  );

  const GalleryIcon = () => (
    <View style={styles.iconContainer}>
      <View style={[styles.galleryBorder, { borderColor: theme.text }]}>
        <View style={[styles.gallerySun, { backgroundColor: theme.text }]} />
        <View style={[styles.galleryMountainLeft, { borderBottomColor: theme.textSecondary }]} />
        <View style={[styles.galleryMountainRight, { borderBottomColor: theme.text }]} />
      </View>
    </View>
  );

  const CopyIcon = () => (
    <View style={styles.copyIcon}>
      <View style={[styles.copyBackCard, { borderColor: theme.textSecondary }]} />
      <View style={[styles.copyFrontCard, { borderColor: theme.text, backgroundColor: theme.backgroundElement }]} />
    </View>
  );

  const ResetIcon = () => (
    <View style={styles.resetIcon}>
      <View style={[styles.resetCircle, { borderColor: theme.text }]} />
      <View style={[styles.resetArrow, { borderTopColor: theme.text }]} />
    </View>
  );

  const CheckIcon = () => (
    <View style={styles.checkIcon}>
      <View style={[styles.checkStem, { backgroundColor: '#34c759' }]} />
      <View style={[styles.checkKick, { backgroundColor: '#34c759' }]} />
    </View>
  );

  // Pick image from library
  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'Nova OCR requires photo library permission to scan photos.');
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        quality: 1,
      });

      if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0) {
        setSelectedImage(pickerResult.assets[0].uri);
        reset();
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to select image: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Capture image using camera
  const captureImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'Nova OCR requires camera permission to capture photos.');
        return;
      }

      const cameraResult = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        quality: 1,
      });

      if (!cameraResult.canceled && cameraResult.assets && cameraResult.assets.length > 0) {
        setSelectedImage(cameraResult.assets[0].uri);
        reset();
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to capture image: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Run OCR
  const runOCR = async () => {
    if (!selectedImage) return;

    try {
      const ocrResult = await recognize(selectedImage, {
        language: selectedLanguage,
        preprocess: {
          grayscale,
          contrast,
          binarize,
        },
      });

      // Save to history
      await historyService.saveHistoryItem({
        imageUri: selectedImage,
        text: ocrResult.text,
        confidence: ocrResult.confidence,
        language: selectedLanguage,
        processingTime: ocrResult.processingTime,
        wordCount: ocrResult.words.length,
      });
    } catch (err) {
      console.error('OCR error during execution:', err);
    }
  };

  // Copy to clipboard
  const copyToClipboard = async () => {
    if (!result) return;
    try {
      await ExpoClipboard.setStringAsync(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback
      Clipboard.setString(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Reset all
  const handleReset = () => {
    setSelectedImage(null);
    reset();
  };

  // Format confidence
  const formatConfidence = (score: number) => {
    return `${Math.round(score * 100)}%`;
  };

  // Render confidence color indicator
  const getConfidenceColor = (score: number) => {
    if (score >= 0.85) return '#34c759'; // Green
    if (score >= 0.70) return '#ffcc00'; // Amber
    return '#ff3b30'; // Red
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Image source={require('@/assets/novalogo.png')} style={styles.logo} contentFit="contain" />
            <ThemedText type="small" style={[styles.headerSubtitle, { color: theme.textSecondary, marginTop: Spacing.two }]}>
              Transform printed characters into machine-readable text instantly.
            </ThemedText>
          </View>

          {/* Option Settings Bar */}
          <TouchableOpacity
            style={[styles.settingsToggle, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}
            onPress={() => setShowSettings(!showSettings)}
          >
            <ThemedText type="smallBold" style={{ color: '#0a84ff' }}>
              {showSettings ? 'Hide OCR Settings ▴' : 'Configure OCR Settings ▾'}
            </ThemedText>
            <ThemedText type="code" style={{ color: theme.textSecondary }}>
              Language: {selectedLanguage.toUpperCase()}
            </ThemedText>
          </TouchableOpacity>

          {showSettings && (
            <View style={[styles.settingsPanel, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
              <View style={styles.settingRow}>
                <ThemedText type="small">Engine Language</ThemedText>
                <View style={styles.languageSelectors}>
                  {['eng', 'spa', 'fra', 'deu'].map((lang) => (
                    <TouchableOpacity
                      key={lang}
                      style={[
                        styles.langButton,
                        selectedLanguage === lang && { backgroundColor: '#0a84ff' },
                      ]}
                      onPress={() => setSelectedLanguage(lang)}
                    >
                      <Text style={[styles.langText, selectedLanguage === lang ? { color: '#fff' } : { color: theme.text }]}>
                        {lang.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.settingRow}>
                <ThemedText type="small">Canvas Grayscale Filter</ThemedText>
                <TouchableOpacity
                  style={[styles.toggleButton, grayscale && styles.toggleButtonActive]}
                  onPress={() => setGrayscale(!grayscale)}
                >
                  <Text style={[styles.toggleButtonText, grayscale ? { color: '#fff' } : { color: theme.text }]}>
                    {grayscale ? 'ENABLED' : 'DISABLED'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.settingRow}>
                <ThemedText type="small">Contrast Enhancement</ThemedText>
                <TouchableOpacity
                  style={[styles.toggleButton, contrast && styles.toggleButtonActive]}
                  onPress={() => setContrast(!contrast)}
                >
                  <Text style={[styles.toggleButtonText, contrast ? { color: '#fff' } : { color: theme.text }]}>
                    {contrast ? 'ENABLED' : 'DISABLED'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.settingRow}>
                <ThemedText type="small">Binarization (Threshold)</ThemedText>
                <TouchableOpacity
                  style={[styles.toggleButton, binarize && styles.toggleButtonActive]}
                  onPress={() => setBinarize(!binarize)}
                >
                  <Text style={[styles.toggleButtonText, binarize ? { color: '#fff' } : { color: theme.text }]}>
                    {binarize ? 'ENABLED' : 'DISABLED'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Image Display & Selection Card */}
          {!selectedImage ? (
            <View style={[styles.uploadCard, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
              <ThemedText type="default" style={styles.uploadTitle}>
                Capture or Upload Image
              </ThemedText>
              <ThemedText type="small" style={[styles.uploadDesc, { color: theme.textSecondary }]}>
                Provide an image with clear readable text to execute scanning.
              </ThemedText>

              <View style={styles.uploadActions}>
                <TouchableOpacity
                  style={[styles.uploadButton, { backgroundColor: theme.backgroundSelected }]}
                  onPress={captureImage}
                >
                  <CameraIcon />
                  <ThemedText type="smallBold" style={styles.uploadBtnText}>Camera</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.uploadButton, { backgroundColor: theme.backgroundSelected }]}
                  onPress={pickImage}
                >
                  <GalleryIcon />
                  <ThemedText type="smallBold" style={styles.uploadBtnText}>Gallery</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.previewWrapper}>
              <View style={[styles.imagePreviewContainer, { borderColor: theme.backgroundSelected }]}>
                {/* Corner brackets */}
                <View style={[styles.corner, styles.topLeft, { borderColor: '#0a84ff' }]} />
                <View style={[styles.corner, styles.topRight, { borderColor: '#0a84ff' }]} />
                <View style={[styles.corner, styles.bottomLeft, { borderColor: '#0a84ff' }]} />
                <View style={[styles.corner, styles.bottomRight, { borderColor: '#0a84ff' }]} />

                <Image source={{ uri: selectedImage }} style={styles.imagePreview} contentFit="contain" />
              </View>

              {!isProcessing && !result && (
                <View style={styles.previewControls}>
                  <TouchableOpacity style={styles.scanButton} onPress={runOCR}>
                    <Text style={styles.scanButtonText}>SCAN TEXT</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.cancelFloating, { backgroundColor: theme.backgroundElement }]} onPress={handleReset}>
                    <ResetIcon />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>⚠️ OCR ERROR: {error}</Text>
            </View>
          )}

          {/* Loader and Progress Overlay */}
          {isProcessing && (
            <View style={[styles.loaderCard, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
              <ActivityIndicator size="large" color="#0a84ff" />
              <ThemedText type="smallBold" style={styles.loaderStatus}>
                Status: {status.toUpperCase()}
              </ThemedText>
              
              <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${progress * 100}%`,
                      backgroundColor: '#0a84ff',
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressPercent}>{Math.round(progress * 100)}%</Text>
            </View>
          )}

          {/* Results Viewer */}
          {result && (
            <View style={[styles.resultCard, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
              {/* Results Stats Panel */}
              <View style={styles.resultHeader}>
                <View style={styles.metricBlock}>
                  <Text style={[styles.metricValue, { color: getConfidenceColor(result.confidence) }]}>
                    {formatConfidence(result.confidence)}
                  </Text>
                  <ThemedText type="code" style={{ color: theme.textSecondary }}>CONFIDENCE</ThemedText>
                </View>

                <View style={[styles.metricSeparator, { backgroundColor: theme.backgroundSelected }]} />

                <View style={styles.metricBlock}>
                  <Text style={[styles.metricValue, { color: theme.text }]}>
                    {(result.processingTime / 1000).toFixed(2)}s
                  </Text>
                  <ThemedText type="code" style={{ color: theme.textSecondary }}>SCAN SPEED</ThemedText>
                </View>

                <View style={[styles.metricSeparator, { backgroundColor: theme.backgroundSelected }]} />

                <View style={styles.metricBlock}>
                  <Text style={[styles.metricValue, { color: theme.text }]}>
                    {result.words.length}
                  </Text>
                  <ThemedText type="code" style={{ color: theme.textSecondary }}>WORDS</ThemedText>
                </View>
              </View>

              {/* Action bar */}
              <View style={[styles.actionsBar, { borderColor: theme.backgroundSelected }]}>
                <TouchableOpacity
                  style={[styles.actionButton, copied && { borderColor: '#34c759' }]}
                  onPress={copyToClipboard}
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                  <Text style={[styles.actionButtonText, { color: copied ? '#34c759' : theme.text }]}>
                    {copied ? 'COPIED!' : 'COPY TEXT'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleReset}
                >
                  <ResetIcon />
                  <Text style={[styles.actionButtonText, { color: theme.text }]}>RESET</Text>
                </TouchableOpacity>
              </View>

              {/* Text Output */}
              <ThemedText type="smallBold" style={styles.sectionTitle}>
                Extracted Text
              </ThemedText>
              <ScrollView style={[styles.resultTextContainer, { backgroundColor: theme.backgroundSelected }]} nestedScrollEnabled={true}>
                <Text style={[styles.resultText, { color: theme.text }]}>
                  {result.text ? result.text.trim() : 'No text content was detected.'}
                </Text>
              </ScrollView>

              {/* Structured Word Breakdown */}
              {result.words && result.words.length > 0 && (
                <>
                  <ThemedText type="smallBold" style={[styles.sectionTitle, { marginTop: Spacing.four }]}>
                    Structured Word Map
                  </ThemedText>
                  <View style={styles.wordCloud}>
                    {result.words.slice(0, 50).map((w, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.wordBadge,
                          {
                            borderColor: getConfidenceColor(w.confidence) + '60',
                            backgroundColor: getConfidenceColor(w.confidence) + '15',
                          },
                        ]}
                      >
                        <Text style={[styles.wordBadgeText, { color: theme.text }]}>{w.text}</Text>
                        <Text style={[styles.wordBadgeConfidence, { color: getConfidenceColor(w.confidence) }]}>
                          {Math.round(w.confidence * 100)}%
                        </Text>
                      </View>
                    ))}
                    {result.words.length > 50 && (
                      <View style={[styles.wordBadge, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundSelected }]}>
                        <Text style={[styles.wordBadgeText, { color: theme.textSecondary }]}>+{result.words.length - 50} more</Text>
                      </View>
                    )}
                  </View>
                </>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContainer: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  header: {
    marginBottom: Spacing.two,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  settingsToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
  },
  settingsPanel: {
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    gap: Spacing.three,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  languageSelectors: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  langButton: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3a3a3c',
  },
  langText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  toggleButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3a3a3c',
    minWidth: 95,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#34c759',
    borderColor: '#34c759',
  },
  toggleButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  uploadCard: {
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: Spacing.one,
  },
  uploadDesc: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: Spacing.four,
  },
  uploadActions: {
    flexDirection: 'row',
    gap: Spacing.three,
    width: '100%',
  },
  uploadButton: {
    flex: 1,
    height: 110,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  uploadBtnText: {
    fontSize: 15,
  },
  imagePreviewContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  previewControls: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.three,
    width: '100%',
  },
  previewWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  scanButton: {
    flex: 1,
    backgroundColor: '#0a84ff',
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0a84ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  scanButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 0.8,
  },
  cancelFloating: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderWidth: 1,
    borderColor: '#3a3a3c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    padding: Spacing.three,
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ff3b30',
  },
  errorText: {
    color: '#ff453a',
    fontSize: 13,
    fontWeight: 'bold',
  },
  loaderCard: {
    padding: Spacing.four,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: Spacing.two,
  },
  loaderStatus: {
    marginTop: Spacing.two,
    fontSize: 13,
    color: '#0a84ff',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: Spacing.one,
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  progressPercent: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0a84ff',
  },
  resultCard: {
    padding: Spacing.four,
    borderRadius: 16,
    borderWidth: 1,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: Spacing.three,
  },
  metricBlock: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  metricSeparator: {
    width: 1,
    height: 30,
  },
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: Spacing.two,
    marginBottom: Spacing.four,
    gap: Spacing.two,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    borderWidth: 1,
    borderColor: '#3a3a3c',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: Spacing.two,
  },
  resultTextContainer: {
    height: 220,
    borderRadius: 12,
    padding: Spacing.three,
  },
  resultText: {
    fontSize: 16,
    lineHeight: 24,
  },
  wordCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  wordBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
  },
  wordBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  wordBadgeConfidence: {
    fontSize: 10,
    fontWeight: 'bold',
  },

  // Focus brackets details
  corner: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderWidth: 3,
  },
  topLeft: {
    top: 10,
    left: 10,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 10,
    right: 10,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 10,
    left: 10,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 10,
    right: 10,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },

  // Manual Icons definitions
  iconContainer: {
    width: 24,
    height: 24,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBody: {
    width: 20,
    height: 14,
    borderWidth: 2,
    borderRadius: 3,
    marginTop: 3,
  },
  cameraLens: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderWidth: 2,
    borderRadius: 4,
    top: 8,
  },
  cameraFlash: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    top: 6,
    right: 4,
  },
  galleryBorder: {
    width: 20,
    height: 18,
    borderWidth: 2,
    borderRadius: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  gallerySun: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    top: 3,
    left: 3,
  },
  galleryMountainLeft: {
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    position: 'absolute',
    bottom: -1,
    left: -2,
  },
  galleryMountainRight: {
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    position: 'absolute',
    bottom: -1,
    right: -4,
  },
  copyIcon: {
    width: 16,
    height: 16,
    position: 'relative',
  },
  copyBackCard: {
    width: 10,
    height: 12,
    borderWidth: 1.5,
    borderRadius: 2,
    position: 'absolute',
    top: 1,
    left: 1,
  },
  copyFrontCard: {
    width: 10,
    height: 12,
    borderWidth: 1.5,
    borderRadius: 2,
    position: 'absolute',
    bottom: 1,
    right: 1,
  },
  resetIcon: {
    width: 16,
    height: 16,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderRightColor: 'transparent',
  },
  resetArrow: {
    position: 'absolute',
    right: 0,
    top: 2,
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderTopWidth: 4,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    transform: [{ rotate: '45deg' }],
  },
  checkIcon: {
    width: 16,
    height: 16,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkStem: {
    width: 3,
    height: 10,
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
    left: 8,
    top: 3,
    borderRadius: 1.5,
  },
  checkKick: {
    width: 3,
    height: 5,
    position: 'absolute',
    transform: [{ rotate: '-45deg' }],
    left: 4,
    top: 7,
    borderRadius: 1.5,
  },
  logo: {
    width: 180,
    height: 180,
    marginBottom: Spacing.one,
    alignSelf: 'center',
  },
});
