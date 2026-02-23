import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator, Platform, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import api from '../api/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const UploadPaymentProofScreen = ({ route, navigation }) => {
  const { ticketId, eventName } = route.params;
  const [imageUri, setImageUri] = useState(null);
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Sorry, we need camera roll permissions to upload payment proof!');
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        // Store both URI and base64
        if (asset.base64) {
          // Create proper data URI from base64
          const base64Data = `data:image/jpeg;base64,${asset.base64}`;
          setImageUri(base64Data);
        } else {
          setImageUri(asset.uri);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      alert('Failed to pick image');
    }
  };

  const uploadProof = async () => {
    if (!imageUri) {
      alert('Please select a payment proof image first');
      return;
    }

    setUploading(true);
    try {
      const token = await AsyncStorage.getItem('token');

      // Ensure we have proper base64 data URI
      let base64Image = imageUri;
      
      // If imageUri is not a data URI, convert it
      if (!imageUri.startsWith('data:image')) {
        if (Platform.OS === 'web') {
          const response = await fetch(imageUri);
          const blob = await response.blob();
          base64Image = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        } else {
          // For mobile, expo-image-picker should have given us base64
          console.error('Image not in base64 format');
          alert('Failed to process image. Please try again.');
          setUploading(false);
          return;
        }
      }

      console.log('Uploading payment proof, data URI length:', base64Image.length);
      console.log('Data URI starts with:', base64Image.substring(0, 30));

      const response = await api.post(
        `/registrations/upload-payment-proof/${ticketId}`,
        { paymentProof: base64Image },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (Platform.OS === 'web') {
        window.alert(response.data.message);
      } else {
        Alert.alert('Success!', response.data.message);
      }

      navigation.goBack();
    } catch (error) {
      console.error('Upload error:', error);
      const msg = error.response?.data?.message || 'Failed to upload payment proof';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Upload Payment Proof</Text>
        <Text style={styles.eventName}>{eventName}</Text>
        <Text style={styles.ticketId}>Ticket ID: {ticketId}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Please upload a clear screenshot or photo of your payment confirmation.
          </Text>
        </View>

        <TouchableOpacity style={styles.pickButton} onPress={pickImage}>
          <Text style={styles.pickButtonText}>
            {imageUri ? 'Change Image' : 'Select Payment Proof'}
          </Text>
        </TouchableOpacity>

        {imageUri && (
          <View style={styles.previewContainer}>
            <Text style={styles.previewLabel}>Preview:</Text>
            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
          </View>
        )}

        <TouchableOpacity 
          style={[styles.uploadButton, (!imageUri || uploading) && styles.disabledButton]}
          onPress={uploadProof}
          disabled={!imageUri || uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.uploadButtonText}>✓ Submit Payment Proof</Text>
          )}
        </TouchableOpacity>

        <View style={styles.noteBox}>
          <Text style={styles.noteTitle}>⚠️ Important Notes:</Text>
          <Text style={styles.noteText}>• Your order will be reviewed by the organizer</Text>
          <Text style={styles.noteText}>• You'll receive a QR code once approved</Text>
          <Text style={styles.noteText}>• Email will be sent upon approval</Text>
          <Text style={styles.noteText}>• Stock will be reserved after approval</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23'
  },
  header: {
    backgroundColor: '#1a1a3e',
    padding: 25,
    paddingTop: 40,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#ffd60a'
  },
  headerEmoji: {
    fontSize: 50,
    marginBottom: 10
  },
  headerTitle: {
    fontSize: Platform.OS === 'web' ? 28 : 24,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 8
  },
  eventName: {
    fontSize: 16,
    color: '#ffd60a',
    fontWeight: '600',
    marginBottom: 4
  },
  ticketId: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)'
  },

  content: {
    flex: 1,
    padding: 20
  },

  infoBox: {
    backgroundColor: 'rgba(131, 56, 236, 0.2)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(131, 56, 236, 0.3)'
  },
  infoText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center'
  },

  pickButton: {
    backgroundColor: '#06d6a0',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20
  },
  pickButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16
  },

  previewContainer: {
    alignItems: 'center',
    marginBottom: 20
  },
  previewLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10
  },
  imagePreview: {
    width: Platform.OS === 'web' ? 400 : '100%',
    height: 300,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ffd60a'
  },

  uploadButton: {
    backgroundColor: '#8338ec',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20
  },
  disabledButton: {
    backgroundColor: '#555'
  },
  uploadButtonText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 17
  },

  noteBox: {
    backgroundColor: 'rgba(255, 214, 10, 0.1)',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 214, 10, 0.3)'
  },
  noteTitle: {
    color: '#ffd60a',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8
  },
  noteText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    lineHeight: 22
  },

  backButton: {
    backgroundColor: '#1a1a3e',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#8338ec'
  },
  backButtonText: {
    color: '#8338ec',
    fontWeight: '800',
    fontSize: 16
  }
});

export default UploadPaymentProofScreen;
