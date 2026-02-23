import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Alert, ScrollView, Modal, TextInput, Image } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import * as ImagePicker from 'expo-image-picker';
import api from '../api/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import jsQR only for web
let jsQR = null;
if (Platform.OS === 'web') {
  jsQR = require('jsqr');
}

const QRScannerScreen = ({ route, navigation }) => {
  const { eventId, eventName } = route.params;
  
  const [hasPermission, setHasPermission] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scannedData, setScannedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scanMode, setScanMode] = useState('camera'); // 'camera' or 'upload'
  const [manualTicketId, setManualTicketId] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [processingImage, setProcessingImage] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const uploadCanvasRef = useRef(null);

  useEffect(() => {
    requestCameraPermission();
    return () => {
      // Cleanup
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  const requestCameraPermission = async () => {
    if (Platform.OS === 'web') {
      try {
        // Stop any existing streams first
        if (videoRef.current && videoRef.current.srcObject) {
          const tracks = videoRef.current.srcObject.getTracks();
          tracks.forEach(track => track.stop());
          videoRef.current.srcObject = null;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 }
          } 
        });
        
        console.log('Camera stream obtained successfully');
        setHasPermission(true);
        
        // Wait for video element to be ready
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current.play()
                .then(() => console.log('Video playing successfully'))
                .catch(err => {
                  console.error('Video play error:', err);
                  // Try again without constraints
                  setTimeout(() => requestCameraPermission(), 1000);
                });
            };
          }
        }, 100);
      } catch (error) {
        console.error('Camera permission error:', error);
        setHasPermission(false);
        
        if (Platform.OS === 'web') {
          window.alert('Camera access failed. Please:\n1. Ensure you granted camera permissions\n2. Close other apps using the camera\n3. Refresh the page and try again');
        }
      }
    } else {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    }
  };

  // Start video when permission granted on web
  useEffect(() => {
    if (Platform.OS === 'web' && hasPermission && videoRef.current && !videoRef.current.srcObject) {
      requestCameraPermission();
    }
  }, [hasPermission, scanMode]);

  // Web-based QR scanning
  useEffect(() => {
    if (Platform.OS === 'web' && hasPermission && scanMode === 'camera') {
      console.log('🎥 Starting QR scanning interval...');
      
      const interval = setInterval(() => {
        if (videoRef.current && canvasRef.current && !scanning) {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            const ctx = canvas.getContext('2d');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            if (canvas.width === 0 || canvas.height === 0) {
              return;
            }
            
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            // Try with inversion for better detection in various lighting
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "attemptBoth",
            });
            
            if (code) {
              console.log('🔍 QR Code detected!');
              console.log('Data length:', code.data.length);
              console.log('Data preview:', code.data.substring(0, 50));
              
              if (code.data && code.data.trim() !== '' && code.data.length > 10) {
                console.log('✅ Valid QR Code - Processing...');
                setScanning(true);
                validateAndProcessQR(code.data);
              } else {
                console.log('⚠️ QR too short or empty, ignoring');
              }
            }
          }
        }
      }, 500);
      
      scanIntervalRef.current = interval;
      
      return () => {
        console.log('🛑 Stopping QR scanning interval');
        clearInterval(interval);
      };
    }
  }, [hasPermission, scanMode, scanning]);

  const scanQRFromVideo = () => {
    if (!videoRef.current || !canvasRef.current || scanning) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      if (canvas.width === 0 || canvas.height === 0) {
        console.log('Video dimensions not ready yet');
        return;
      }
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });
      
      if (code) {
        console.log('🔍 QR Code detected!');
        console.log('Data length:', code.data.length);
        console.log('Data preview:', code.data.substring(0, 50));
        
        if (code.data && code.data.trim() !== '' && code.data.length > 10) {
          console.log('✅ Valid QR Code - Processing...');
          setScanning(true);
          validateAndProcessQR(code.data);
        } else {
          console.log('⚠️ QR too short or empty, ignoring');
        }
      }
    } else {
      console.log('Video not ready, readyState:', video.readyState);
    }
  };

  const handleBarCodeScanned = async ({ type, data }) => {
    if (scanning) return;
    
    setScanning(true);
    console.log('QR Code scanned:', data);
    
    await validateAndProcessQR(data);
  };

  const handleFileUpload = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        if (Platform.OS === 'web') {
          window.alert('Sorry, we need gallery permissions to scan QR codes from images!');
        } else {
          Alert.alert('Permission Required', 'We need gallery permissions to scan QR codes from images!');
        }
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
        base64: Platform.OS !== 'web', // Get base64 for mobile
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        setUploadedImage(imageUri);
        setProcessingImage(true);
        
        // Process the image to extract QR code
        await processImageForQR(imageUri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to pick image');
      } else {
        Alert.alert('Error', 'Failed to pick image');
      }
    }
  };

  const processImageForQR = async (imageUri) => {
    try {
      if (Platform.OS === 'web') {
        // Web: Use canvas to process image
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          const canvas = uploadCanvasRef.current || document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          // Try to detect QR code with multiple attempts
          let code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "attemptBoth",
          });
          
          if (code && code.data) {
            console.log('✅ QR Code found in uploaded image!');
            console.log('Data:', code.data.substring(0, 100));
            setProcessingImage(false);
            validateAndProcessQR(code.data);
          } else {
            console.log('❌ No QR code found in image');
            setProcessingImage(false);
            setUploadedImage(null);
            if (Platform.OS === 'web') {
              window.alert('No QR code found in the image. Please try:\n• A clearer image\n• Better lighting\n• Closer to the QR code');
            } else {
              Alert.alert('QR Not Found', 'No QR code found in the image. Please try a clearer image.');
            }
          }
        };
        
        img.onerror = () => {
          console.error('Failed to load image');
          setProcessingImage(false);
          setUploadedImage(null);
          if (Platform.OS === 'web') {
            window.alert('Failed to load image');
          } else {
            Alert.alert('Error', 'Failed to load image');
          }
        };
        
        img.src = imageUri;
      } else {
        // Mobile: Process with expo-image-manipulator or similar
        if (Platform.OS === 'web') {
          window.alert('Mobile QR scanning from images is not yet implemented. Please use camera scanner.');
        } else {
          Alert.alert('Not Implemented', 'Mobile QR scanning from images is not yet implemented. Please use camera scanner.');
        }
        setProcessingImage(false);
        setUploadedImage(null);
      }
    } catch (error) {
      console.error('Error processing image:', error);
      setProcessingImage(false);
      setUploadedImage(null);
      if (Platform.OS === 'web') {
        window.alert('Failed to process image for QR code');
      } else {
        Alert.alert('Error', 'Failed to process image for QR code');
      }
    }
  };

  const validateAndProcessQR = async (qrData) => {
    // Validate QR data is not empty
    if (!qrData || qrData.trim() === '') {
      console.log('Empty QR code detected, ignoring');
      setScanning(false);
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      
      console.log('Validating QR data:', qrData.substring(0, 100));
      
      // First, validate the QR code
      const scanResponse = await api.post('/attendance/scan-qr', 
        { qrData },
        { headers: { Authorization: `Bearer ${token}` }}
      );

      console.log('Scan response:', scanResponse.data);

      if (!scanResponse.data.valid) {
        if (Platform.OS === 'web') {
          window.alert(scanResponse.data.message || 'Invalid ticket');
        } else {
          Alert.alert('Invalid Ticket', scanResponse.data.message || 'This ticket is not valid');
        }
        setScanning(false);
        setLoading(false);
        return;
      }

      // Check if already marked
      if (scanResponse.data.alreadyMarked) {
        const attendanceTime = new Date(scanResponse.data.registration.attendanceTimestamp).toLocaleString();
        if (Platform.OS === 'web') {
          window.alert(`Attendance already marked!\nTime: ${attendanceTime}`);
        } else {
          Alert.alert(
            'Already Marked',
            `Attendance was already marked on ${attendanceTime}`,
            [{ text: 'OK' }]
          );
        }
        setScanning(false);
        setLoading(false);
        return;
      }

      // Show participant details and confirm marking
      setScannedData(scanResponse.data.registration);
      
    } catch (error) {
      console.error('Error scanning QR:', error);
      const msg = error.response?.data?.message || 'Failed to scan QR code';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
      setScanning(false);
    } finally {
      setLoading(false);
    }
  };

  const confirmMarkAttendance = async () => {
    if (!scannedData) return;

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      
      const response = await api.post('/attendance/mark-attendance',
        { ticketId: scannedData.ticketId },
        { headers: { Authorization: `Bearer ${token}` }}
      );

      if (Platform.OS === 'web') {
        window.alert(response.data.message);
      } else {
        Alert.alert('Success', response.data.message);
      }

      // Reset and allow next scan
      setScannedData(null);
      setScanning(false);

    } catch (error) {
      console.error('Error marking attendance:', error);
      const msg = error.response?.data?.message || 'Failed to mark attendance';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
      setScanning(false);
    } finally {
      setLoading(false);
    }
  };

  const cancelScan = () => {
    setScannedData(null);
    setScanning(false);
  };

  const handleManualEntry = async () => {
    if (!manualTicketId.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Please enter a ticket ID');
      } else {
        Alert.alert('Error', 'Please enter a ticket ID');
      }
      return;
    }

    // Create QR data format from ticket ID
    const qrData = JSON.stringify({ ticketId: manualTicketId.trim() });
    setShowManualInput(false);
    setManualTicketId('');
    await validateAndProcessQR(qrData);
  };

  if (hasPermission === null) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#8338ec" />
        <Text style={styles.loadingText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>No access to camera</Text>
        <Text style={styles.errorSubtext}>Please enable camera permissions in settings</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>QR Scanner</Text>
        <Text style={styles.eventName}>{eventName}</Text>
      </View>

      {/* Mode Selector */}
      <View style={styles.modeSelector}>
        <TouchableOpacity 
          style={[styles.modeButton, scanMode === 'camera' && styles.modeButtonActive]}
          onPress={() => setScanMode('camera')}
        >
          <Text style={[styles.modeButtonText, scanMode === 'camera' && styles.modeButtonTextActive]}>
            📷 Camera
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.modeButton, scanMode === 'upload' && styles.modeButtonActive]}
          onPress={() => setScanMode('upload')}
        >
          <Text style={[styles.modeButtonText, scanMode === 'upload' && styles.modeButtonTextActive]}>
            📁 Upload
          </Text>
        </TouchableOpacity>
      </View>

      {/* Scanner View */}
      {scanMode === 'camera' ? (
        <View style={styles.scannerContainer}>
          {Platform.OS === 'web' ? (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  position: 'absolute',
                  backgroundColor: '#000'
                }}
              />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              <View style={styles.scannerOverlay}>
                <View style={styles.scannerFrame} />
                <Text style={styles.scannerText}>
                  {scanning ? 'Processing...' : 'Point camera at QR code'}
                </Text>
              </View>
            </>
          ) : (
            <>
              <BarCodeScanner
                onBarCodeScanned={scanning ? undefined : handleBarCodeScanned}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.scannerOverlay}>
                <View style={styles.scannerFrame} />
                <Text style={styles.scannerText}>
                  {scanning ? 'Processing...' : 'Point camera at QR code'}
                </Text>
              </View>
            </>
          )}
        </View>
      ) : (
        <View style={styles.uploadContainer}>
          {uploadedImage ? (
            <View style={styles.uploadedImageContainer}>
              <Image 
                source={{ uri: uploadedImage }} 
                style={styles.uploadedImage}
                resizeMode="contain"
              />
              {processingImage && (
                <View style={styles.processingOverlay}>
                  <ActivityIndicator size="large" color="#8338ec" />
                  <Text style={styles.processingText}>Scanning QR code...</Text>
                </View>
              )}
              <TouchableOpacity 
                style={styles.uploadAnotherButton} 
                onPress={() => {
                  setUploadedImage(null);
                  handleFileUpload();
                }}
              >
                <Text style={styles.uploadAnotherButtonText}>📤 Upload Different Image</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity style={styles.uploadButton} onPress={handleFileUpload}>
                <Text style={styles.uploadButtonText}>📤 Upload QR Code Image</Text>
              </TouchableOpacity>
              <Text style={styles.uploadNote}>Select a QR code image from your gallery</Text>
              <Text style={styles.uploadTip}>💡 Tip: Screenshots of QR codes work best!</Text>
            </>
          )}
          <canvas ref={uploadCanvasRef} style={{ display: 'none' }} />
        </View>
      )}

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionsTitle}>📋 Scanning Options:</Text>
        <Text style={styles.instructionsText}>✓ 📤 UPLOAD: Take screenshot of QR → Upload (Most Reliable)</Text>
        <Text style={styles.instructionsText}>✓ 📷 CAMERA: Scan printed QR codes only</Text>
        <Text style={styles.instructionsText}>✓ ⌨️ MANUAL: Type ticket ID if scanning fails</Text>
        <Text style={styles.instructionsNote}>💡 For best results: Use the Upload tab with QR screenshots</Text>
        
        <TouchableOpacity 
          style={styles.manualEntryButton}
          onPress={() => setShowManualInput(true)}
        >
          <Text style={styles.manualEntryButtonText}>⌨️ Manual Ticket Entry</Text>
        </TouchableOpacity>
      </View>

      {/* Confirmation Modal */}
      <Modal
        visible={scannedData !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={cancelScan}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>✅ Valid Ticket</Text>
            
            {scannedData && (
              <ScrollView style={styles.participantInfo}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Name:</Text>
                  <Text style={styles.infoValue}>{scannedData.participantName}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Email:</Text>
                  <Text style={styles.infoValue}>{scannedData.participantEmail}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Mobile:</Text>
                  <Text style={styles.infoValue}>{scannedData.participantMobile}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Ticket ID:</Text>
                  <Text style={styles.infoValue}>{scannedData.ticketId}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Registered:</Text>
                  <Text style={styles.infoValue}>
                    {new Date(scannedData.registrationDate).toLocaleDateString()}
                  </Text>
                </View>
              </ScrollView>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.confirmButton}
                onPress={confirmMarkAttendance}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>✓ Mark Attendance</Text>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={cancelScan}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>✕ Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Manual Entry Modal */}
      <Modal
        visible={showManualInput}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowManualInput(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>⌨️ Manual Ticket Entry</Text>
            <Text style={styles.manualInputDesc}>
              Enter the ticket ID if QR scanning isn't working
            </Text>
            
            <TextInput
              style={styles.manualInput}
              placeholder="Enter Ticket ID (e.g., EVT-123456...)"
              placeholderTextColor="#999"
              value={manualTicketId}
              onChangeText={setManualTicketId}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.confirmButton}
                onPress={handleManualEntry}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>✓ Submit</Text>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => {
                  setShowManualInput(false);
                  setManualTicketId('');
                }}
              >
                <Text style={styles.cancelButtonText}>✕ Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Back Button */}
      <TouchableOpacity style={styles.bottomBackButton} onPress={() => navigation.goBack()}>
        <Text style={styles.bottomBackButtonText}>← Back to Event</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23'
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f23',
    padding: 20
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16
  },
  errorEmoji: {
    fontSize: 80,
    marginBottom: 20
  },
  errorText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10
  },
  errorSubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20
  },

  header: {
    backgroundColor: '#1a1a3e',
    padding: 25,
    paddingTop: 40,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#8338ec'
  },
  headerEmoji: {
    fontSize: 50,
    marginBottom: 10
  },
  headerTitle: {
    fontSize: Platform.OS === 'web' ? 28 : 24,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 5
  },
  eventName: {
    fontSize: 14,
    color: '#ffd60a',
    fontWeight: '600'
  },

  modeSelector: {
    flexDirection: 'row',
    padding: 15,
    gap: 10
  },
  modeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#1a1a3e',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent'
  },
  modeButtonActive: {
    backgroundColor: '#8338ec',
    borderColor: '#fff'
  },
  modeButtonText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '700',
    fontSize: 15
  },
  modeButtonTextActive: {
    color: '#fff'
  },

  scannerContainer: {
    flex: 1,
    margin: 15,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000'
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center'
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: '#8338ec',
    borderRadius: 20,
    backgroundColor: 'transparent'
  },
  scannerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 10,
    borderRadius: 8
  },

  uploadContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  uploadButton: {
    backgroundColor: '#8338ec',
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 15
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800'
  },
  uploadNote: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginTop: 15,
    textAlign: 'center'
  },
  uploadTip: {
    color: '#ffd60a',
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
    fontWeight: '600'
  },
  uploadedImageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center'
  },
  uploadedImage: {
    width: '90%',
    height: '70%',
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#8338ec'
  },
  processingOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 30,
    borderRadius: 15,
    alignItems: 'center'
  },
  processingText: {
    color: '#fff',
    marginTop: 15,
    fontSize: 16,
    fontWeight: '700'
  },
  uploadAnotherButton: {
    backgroundColor: '#8338ec',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
    marginTop: 20
  },
  uploadAnotherButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700'
  },

  instructions: {
    backgroundColor: '#1a1a3e',
    padding: 20,
    margin: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#8338ec'
  },
  instructionsTitle: {
    color: '#ffd60a',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10
  },
  instructionsText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginBottom: 6
  },
  instructionsNote: {
    color: '#ffd60a',
    fontSize: 13,
    marginTop: 8,
    fontWeight: '700'
  },
  manualEntryButton: {
    backgroundColor: '#8338ec',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 15,
    alignItems: 'center'
  },
  manualEntryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    width: Platform.OS === 'web' ? 500 : '100%',
    maxHeight: '80%'
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#06d6a0',
    textAlign: 'center',
    marginBottom: 20
  },
  manualInputDesc: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 15
  },
  manualInput: {
    backgroundColor: '#f5f5f5',
    borderWidth: 2,
    borderColor: '#8338ec',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: '#333',
    marginBottom: 10
  },
  participantInfo: {
    maxHeight: 300
  },
  infoRow: {
    marginBottom: 15
  },
  infoLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
    marginBottom: 4
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '700'
  },
  modalActions: {
    marginTop: 20,
    gap: 10
  },
  confirmButton: {
    backgroundColor: '#06d6a0',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center'
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16
  },
  cancelButton: {
    backgroundColor: '#ef476f',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center'
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16
  },

  bottomBackButton: {
    backgroundColor: '#1a1a3e',
    margin: 15,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#8338ec'
  },
  bottomBackButtonText: {
    color: '#8338ec',
    fontWeight: '800',
    fontSize: 16
  },
  backButton: {
    backgroundColor: '#8338ec',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 20
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16
  }
});

export default QRScannerScreen;
