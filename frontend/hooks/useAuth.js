import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Custom hook to protect routes with authentication
 * Redirects to login if no token is found
 * Optionally checks for specific roles
 */
export const useAuth = (navigation, requiredRole = null) => {
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      
      if (!token) {
        // No authentication token, redirect to login
        navigation.replace('Login');
        return false;
      }

      // Check role if required
      if (requiredRole) {
        const userRole = await AsyncStorage.getItem('userRole');
        
        if (userRole !== requiredRole) {
          // User doesn't have required role
          alert(`Access Denied: This page requires ${requiredRole} role`);
          navigation.replace('Home');
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Auth check failed:', error);
      navigation.replace('Login');
      return false;
    }
  };

  return { checkAuth };
};

/**
 * Function to check if user is logged in
 * Returns boolean without navigation
 */
export const isAuthenticated = async () => {
  const token = await AsyncStorage.getItem('token');
  return !!token;
};

/**
 * Function to get current user role
 */
export const getUserRole = async () => {
  return await AsyncStorage.getItem('userRole');
};

/**
 * Function to logout user
 */
export const logout = async (navigation, Platform) => {
  await AsyncStorage.removeItem('token');
  await AsyncStorage.removeItem('userName');
  await AsyncStorage.removeItem('userEmail');
  await AsyncStorage.removeItem('userRole');
  
  if (Platform.OS === 'web') {
    window.location.reload();
  } else {
    navigation.replace('Login');
  }
};
