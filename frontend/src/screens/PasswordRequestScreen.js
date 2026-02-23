import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import api from '../api/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PasswordRequestScreen = ({ navigation }) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reason || reason.trim().length < 10) {
      alert('Please provide a reason (at least 10 characters)');
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await api.post('/password-requests/create', 
        { reason: reason.trim() },
        { headers: { Authorization: `Bearer ${token}` }}
      );

      if (Platform.OS === 'web') {
        window.alert(response.data.message);
      } else {
        Alert.alert('Success', response.data.message);
      }
      
      setReason('');
      navigation.goBack();

    } catch (error) {
      const msg = error.response?.data?.message || 'Request failed';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.overlay} />
      
      <View style={styles.contentWrapper}>
        <View style={styles.headerContainer}>
          <Text style={styles.title}>Password Reset Request</Text>
          <Text style={styles.subtitle}>Request admin to reset your password</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Reason for Password Reset *</Text>
          <Text style={styles.helperText}>Explain why you need a password reset (min 10 characters)</Text>
          <TextInput
            style={styles.textArea}
            placeholder="e.g., Forgot password, account compromised, security update needed..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            value={reason}
            onChangeText={setReason}
            textAlignVertical="top"
          />

          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Submitting...' : 'Submit Request'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelText}>← Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Admin will review your request and auto-generate a new secure password if approved. You'll receive the new password from admin.
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  contentWrapper: { flex: 1, padding: 20, justifyContent: 'center' },
  
  headerContainer: {
    alignItems: 'center',
    marginBottom: 30
  },
  emoji: { fontSize: 60, marginBottom: 15 },
  title: {
    fontSize: Platform.OS === 'web' ? 32 : 26,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center'
  },

  form: {
    width: Platform.OS === 'web' ? 500 : '100%',
    backgroundColor: '#1a1a1a',
    padding: 30,
    borderRadius: 20,
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: '#8338ec'
  },

  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 5
  },
  helperText: {
    fontSize: 12,
    color: '#aaa',
    marginBottom: 8,
    fontStyle: 'italic'
  },
  textArea: {
    borderWidth: 2,
    borderColor: '#333',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    fontSize: 16,
    backgroundColor: '#0a0a0a',
    color: '#fff',
    minHeight: 120
  },

  button: {
    backgroundColor: '#8338ec',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10
  },
  buttonDisabled: {
    backgroundColor: '#666'
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16
  },

  cancelButton: {
    marginTop: 15,
    alignItems: 'center',
    padding: 10
  },
  cancelText: {
    color: '#aaa',
    fontSize: 16,
    fontWeight: '600'
  },

  infoBox: {
    backgroundColor: 'rgba(131, 56, 236, 0.2)',
    borderRadius: 12,
    padding: 15,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(131, 56, 236, 0.3)',
    width: Platform.OS === 'web' ? 500 : '100%',
    alignSelf: 'center'
  },
  infoText: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center'
  }
});

export default PasswordRequestScreen;
