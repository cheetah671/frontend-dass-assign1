import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, Animated, Dimensions, Easing } from 'react-native';
import api from '../api/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

const LoginScreen = ({ navigation }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [college, setCollege] = useState('');
  const [participantType, setParticipantType] = useState('NON-IIIT');

  // --- Animations ---
  const slideAnim = useRef(new Animated.Value(50)).current; // Card Slide Up
  const opacityAnim = useRef(new Animated.Value(0)).current; // Card Fade In

  // Entrance Animation (Card Floats Up)
  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const handleAuth = async () => {
    try {
      if (isLogin) {
        const response = await api.post('/auth/login', { email, password });
        
        // 1. Save Token
        await AsyncStorage.setItem('token', response.data.token);
        
        // 2. Save User Name (Critical for Profile Screen)
        await AsyncStorage.setItem('userName', response.data.name || "User");
        
        // ✅ 3. SAVE EMAIL (Critical for Admin Check)
        // We use the email from the response if available, or fallback to the input email
        const userEmail = response.data.user?.email || email;
        await AsyncStorage.setItem('userEmail', userEmail);
        
        // ✅ 4. SAVE ROLE (for organizer features)
        const userRole = response.data.user?.role || 'participant';
        await AsyncStorage.setItem('userRole', userRole);
        
        if (isWeb) window.alert("Welcome to Felicity! ⚡");
        navigation.replace('Home');
      } else {
        // VALIDATION: Check if all required fields are filled
        if (!firstName || !lastName || !email || !password || !contactNumber || !college) {
          alert('❌ Please fill in all required fields');
          return;
        }
        
        // VALIDATION: Email domain validation for IIIT participants
        const iiitDomains = ['@students.iiit.ac.in', '@research.iiit.ac.in'];
        const isIIITEmail = iiitDomains.some(domain => email.toLowerCase().endsWith(domain));
        
        if (participantType === 'IIIT' && !isIIITEmail) {
          alert('❌ IIIT participants must use IIIT email:\n• @students.iiit.ac.in\n• @research.iiit.ac.in');
          return;
        }
        
        if (participantType === 'NON-IIIT' && isIIITEmail) {
          alert('⚠️ You have an IIIT email. Please select "IIIT" as participant type.');
          return;
        }
        
        // Register new user
        const response = await api.post('/auth/register', { 
          firstName,
          lastName,
          email, 
          password,
          contactNumber,
          college,
          participantType,
          name: `${firstName} ${lastName}`
        });
        
        // Save token and user info
        await AsyncStorage.setItem('token', response.data.token);
        await AsyncStorage.setItem('userName', response.data.user?.name || `${firstName} ${lastName}`);
        await AsyncStorage.setItem('userEmail', response.data.user?.email || email);
        await AsyncStorage.setItem('userRole', response.data.user?.role || 'participant');
        
        // Navigate to onboarding for participants
        if (response.data.user?.role === 'participant' || !response.data.user?.role) {
          if (isWeb) window.alert("Welcome! Let's set up your preferences.");
          navigation.replace('Onboarding');
        } else {
          if (isWeb) window.alert("You're in! Please Login.");
          setIsLogin(true);
        }
      }
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || "Something went wrong");
    }
  };

  return (
    <View style={styles.container}>
      {/* Login Card */}
      <Animated.View 
        style={[
          styles.card, 
          { transform: [{ translateY: slideAnim }], opacity: opacityAnim }
        ]}
      >
        <Text style={styles.logo}>FELICITY <Text style={styles.year}>2026</Text></Text>
        <Text style={styles.subtitle}>
          {isLogin ? "Sign in to your account" : "Create your account"}
        </Text>

        {/* Form Inputs */}
        {!isLogin && (
          <>
            <TextInput 
              style={styles.input} 
              placeholder="First Name" 
              placeholderTextColor="#999"
              value={firstName} 
              onChangeText={setFirstName} 
            />
            <TextInput 
              style={styles.input} 
              placeholder="Last Name" 
              placeholderTextColor="#999"
              value={lastName} 
              onChangeText={setLastName} 
            />
            <TextInput 
              style={styles.input} 
              placeholder="Contact Number" 
              placeholderTextColor="#999"
              value={contactNumber} 
              onChangeText={setContactNumber}
              keyboardType="phone-pad"
            />
            <TextInput 
              style={styles.input} 
              placeholder="College / Organization" 
              placeholderTextColor="#999"
              value={college} 
              onChangeText={setCollege} 
            />
            <View style={styles.participantTypeContainer}>
              <Text style={styles.participantTypeLabel}>Participant Type:</Text>
              <View style={styles.radioGroup}>
                <TouchableOpacity 
                  style={styles.radioOption}
                  onPress={() => setParticipantType('IIIT')}
                >
                  <View style={[styles.radio, participantType === 'IIIT' && styles.radioSelected]}>
                    {participantType === 'IIIT' && <View style={styles.radioDot} />}
                  </View>
                  <Text style={styles.radioLabel}>IIIT</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.radioOption}
                  onPress={() => setParticipantType('NON-IIIT')}
                >
                  <View style={[styles.radio, participantType === 'NON-IIIT' && styles.radioSelected]}>
                    {participantType === 'NON-IIIT' && <View style={styles.radioDot} />}
                  </View>
                  <Text style={styles.radioLabel}>NON-IIIT</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
        
        <TextInput 
          style={styles.input} 
          placeholder="Email Address" 
          placeholderTextColor="#999"
          value={email} 
          onChangeText={setEmail} 
          autoCapitalize="none"
        />
        
        <TextInput 
          style={styles.input} 
          placeholder="Password" 
          placeholderTextColor="#999"
          value={password} 
          onChangeText={setPassword} 
          secureTextEntry 
        />

        {/* 🚀 Main Action Button */}
        <TouchableOpacity activeOpacity={0.8} style={styles.mainButton} onPress={handleAuth}>
          <Text style={styles.mainButtonText}>
            {isLogin ? "SIGN IN" : "REGISTER"}
          </Text>
        </TouchableOpacity>

        {/* Toggle Mode */}
        <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.toggleContainer}>
          <Text style={styles.toggleText}>
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <Text style={styles.toggleLink}>
              {isLogin ? "Register" : "Sign In"}
            </Text>
          </Text>
        </TouchableOpacity>

      </Animated.View>

      {/* Footer Branding */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Art • Dance • Music • Tech</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#ffffff',
    padding: 20
  },

  // Card
  card: {
    width: isWeb ? 460 : '100%',
    maxWidth: 460,
    padding: 40,
    borderRadius: 0,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'stretch'
  },

  // Typography
  emojiIcon: { display: 'none' },
  logo: {
    fontSize: 28, 
    fontWeight: '600', 
    color: '#1a1a1a', 
    letterSpacing: 4, 
    marginBottom: 4,
    textAlign: 'center'
  },
  year: { color: '#1a1a1a' },
  subtitle: { 
    fontSize: 14, 
    color: '#666666', 
    marginBottom: 40, 
    textAlign: 'center',
    fontWeight: '400'
  },

  // Inputs
  input: {
    width: '100%',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 0,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    fontSize: 15,
    color: '#1a1a1a',
    fontWeight: '400'
  },

  // Buttons
  mainButton: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    paddingVertical: 14,
    borderRadius: 0,
    alignItems: 'center',
    marginTop: 8,
  },
  mainButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1
  },

  // Footer & Toggles
  toggleContainer: { marginTop: 24, alignSelf: 'center' },
  toggleText: { color: '#666666', fontSize: 13, textAlign: 'center' },
  toggleLink: { color: '#1a1a1a', fontWeight: '600', textDecorationLine: 'underline' },
  
  // Participant Type Radio Buttons
  participantTypeContainer: {
    width: '100%',
    marginVertical: 12,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 0,
  },
  participantTypeLabel: {
    color: '#1a1a1a',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    letterSpacing: 0.5
  },
  radioGroup: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 32
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#666666',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: '#1a1a1a',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1a1a1a',
  },
  radioLabel: {
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: '500',
  },

  footer: { position: 'absolute', bottom: 24 },
  footerText: { 
    color: '#999999', 
    fontSize: 12, 
    fontWeight: '400', 
    letterSpacing: 0.5 
  }
});

export default LoginScreen;