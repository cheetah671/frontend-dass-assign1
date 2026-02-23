import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NotificationProvider } from './src/context/NotificationContext';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import EventsScreen from './src/screens/EventsScreen';
import EventDetailScreen from './src/screens/EventDetailScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import CreateEventScreen from './src/screens/CreateEventScreen';
import AdminScreen from './src/screens/AdminScreen';
import PasswordRequestScreen from './src/screens/PasswordRequestScreen';
import AdminPasswordRequestsScreen from './src/screens/AdminPasswordRequestsScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import ClubsScreen from './src/screens/ClubsScreen';
import OrganizerDetailScreen from './src/screens/OrganizerDetailScreen';
import UploadPaymentProofScreen from './src/screens/UploadPaymentProofScreen';
import QRScannerScreen from './src/screens/QRScannerScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NotificationProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}> 
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Events" component={EventsScreen} />
          <Stack.Screen name="EventDetail" component={EventDetailScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="CreateEvent" component={CreateEventScreen} /> 
          <Stack.Screen name="Admin" component={AdminScreen} />
          <Stack.Screen name="PasswordRequest" component={PasswordRequestScreen} />
          <Stack.Screen name="AdminPasswordRequests" component={AdminPasswordRequestsScreen} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Clubs" component={ClubsScreen} />
          <Stack.Screen name="OrganizerDetail" component={OrganizerDetailScreen} />
          <Stack.Screen name="UploadPaymentProof" component={UploadPaymentProofScreen} />
          <Stack.Screen name="QRScanner" component={QRScannerScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </NotificationProvider>
  );
}