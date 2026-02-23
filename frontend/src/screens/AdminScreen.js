import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, Modal, TextInput, Dimensions, ActivityIndicator, ScrollView } from 'react-native';
import api from '../api/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Navbar from '../../components/Navbar';

const { width } = Dimensions.get('window');

const AdminScreen = ({ navigation }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newOrg, setNewOrg] = useState({
    name: '',
    email: '',
    password: '',
    category: '',
    contactNumber: '',
    description: ''
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const generateCredentials = () => {
    // Generate email from organization name
    const orgNameSlug = newOrg.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const generatedEmail = `${orgNameSlug}${randomNum}@felicity.iiit.ac.in`;
    
    // Generate random password
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let generatedPassword = '';
    for (let i = 0; i < 12; i++) {
      generatedPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    setNewOrg(prev => ({
      ...prev,
      email: generatedEmail,
      password: generatedPassword
    }));
    
    // Show credentials to admin
    if (Platform.OS === 'web') {
      alert(`Generated Credentials:\nEmail: ${generatedEmail}\nPassword: ${generatedPassword}\n\nPlease save these and share with the organizer.`);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      
      // ✅ Updated: Explicitly sending Authorization header
      const response = await api.get('/auth/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setUsers(response.data);
    } catch (error) {
      if (error.response?.status === 403) {
        alert('Access Denied: Admin privileges required');
      } else {
        alert('Server Error: Could not load user list');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (Platform.OS === 'web' && !window.confirm("Banish this user?")) return;

    try {
      const token = await AsyncStorage.getItem('token');
      await api.delete(`/auth/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(prev => prev.filter(user => user._id !== id));
    } catch (error) {
      alert("Delete failed: Check admin permissions");
    }
  };

  const handleDisableOrganizer = async (id) => {
    if (Platform.OS === 'web' && !window.confirm("Disable this organizer? They won't be able to log in.")) return;

    try {
      const token = await AsyncStorage.getItem('token');
      await api.put(`/auth/organizer/disable/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update local state
      setUsers(prev => prev.map(user => 
        user._id === id ? { ...user, isDisabled: true } : user
      ));
      
      alert('Organizer disabled successfully');
    } catch (error) {
      alert(error.response?.data?.message || "Failed to disable organizer");
    }
  };

  const handleEnableOrganizer = async (id) => {
    try {
      const token = await AsyncStorage.getItem('token');
      await api.put(`/auth/organizer/enable/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update local state
      setUsers(prev => prev.map(user => 
        user._id === id ? { ...user, isDisabled: false } : user
      ));
      
      alert('Organizer enabled successfully');
    } catch (error) {
      alert(error.response?.data?.message || "Failed to enable organizer");
    }
  };

  const handleCreateOrganizer = async () => {
    if (!newOrg.name || !newOrg.email || !newOrg.password || !newOrg.category || !newOrg.contactNumber) {
      alert("Please fill all required fields (name, email, password, category, contact number)");
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      const payload = { 
        name: newOrg.name,
        email: newOrg.email,
        password: newOrg.password,
        category: newOrg.category,
        contactNumber: newOrg.contactNumber,
        description: newOrg.description || ''
      };
      
      console.log('Creating organizer:', payload);
      
      const response = await api.post('/auth/organizer/create', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Organizer created:', response.data);
      
      if (Platform.OS === 'web') {
        alert(`Success! Created organizer: ${newOrg.name}`);
      } else {
        Alert.alert('Success', `Created organizer: ${newOrg.name}`);
      }
      
      setModalVisible(false);
      setNewOrg({ name: '', email: '', password: '', category: '', contactNumber: '', description: '' });
      fetchUsers(); 
    } catch (error) {
      console.error('Creation error:', error.response?.data || error.message);
      const errorMsg = error.response?.data?.message || "Creation Failed: " + error.message;
      if (Platform.OS === 'web') {
        alert(errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Navbar navigation={navigation} activeScreen="Admin" />
      
      <ScrollView style={styles.contentWrapper} showsVerticalScrollIndicator={false}>
        <View style={styles.headerContainer}>
          <Text style={styles.header}>Admin Dashboard</Text>
          <Text style={styles.subHeader}>System Management</Text>
        </View>

        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
          <Text style={styles.addButtonText}>Add New Club / Organizer</Text>
        </TouchableOpacity>

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#ffbe0b" />
          </View>
        ) : users.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No users found</Text>
          </View>
        ) : (
          <View style={styles.tableContainer}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.headerCell, styles.nameColumn]}>Name</Text>
              <Text style={[styles.headerCell, styles.emailColumn]}>Email</Text>
              <Text style={[styles.headerCell, styles.clubColumn]}>Club/Role</Text>
              <Text style={[styles.headerCell, styles.statusColumn]}>Status</Text>
              <Text style={[styles.headerCell, styles.actionsColumn]}>Actions</Text>
            </View>

            {/* Table Body */}
            {users.map((item) => (
                <View style={[
                  styles.tableRow,
                  item.role === 'organizer' && styles.organizerRow,
                  item.isDisabled && styles.disabledRow
                ]}>
                  {/* Name Column */}
                  <View style={[styles.tableCell, styles.nameColumn]}>
                    <View style={styles.nameInfo}>
                      <Text style={styles.name}>{item.name || 'Unknown User'}</Text>
                      <Text style={styles.contactText}>
                        {item.contactNumber || ''}
                      </Text>
                    </View>
                  </View>

                  {/* Email Column */}
                  <View style={[styles.tableCell, styles.emailColumn]}>
                    <Text style={styles.email}>{item.email || 'No email'}</Text>
                  </View>

                  {/* Club/Role Column */}
                  <View style={[styles.tableCell, styles.clubColumn]}>
                    {item.role === 'organizer' ? (
                      <View>
                        <Text style={styles.categoryText}>{item.category || 'N/A'}</Text>
                        {item.description && (
                          <Text style={styles.descriptionText} numberOfLines={1}>
                            {item.description}
                          </Text>
                        )}
                      </View>
                    ) : (
                      <View style={[
                        styles.roleBadge, 
                        item.email === 'admin@felicity.iiit.ac.in' ? styles.adminBadge : styles.userBadge
                      ]}>
                        <Text style={styles.roleBadgeText}>
                          {item.email === 'admin@felicity.iiit.ac.in' ? 'ADMIN' : 'PARTICIPANT'}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Status Column */}
                  <View style={[styles.tableCell, styles.statusColumn]}>
                    {item.role === 'organizer' && (
                      <View style={[
                        styles.statusBadge,
                        item.isDisabled ? styles.disabledBadge : styles.activeBadge
                      ]}>
                        <Text style={styles.statusText}>
                          {item.isDisabled ? 'DISABLED' : 'ACTIVE'}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Actions Column */}
                  <View style={[styles.tableCell, styles.actionsColumn]}>
                    {item.email === 'admin@felicity.iiit.ac.in' ? (
                      <Text style={styles.protectedText}>Protected</Text>
                    ) : (
                      <View style={styles.actionButtons}>
                        {item.role === 'organizer' && (
                          <TouchableOpacity
                            style={[
                              styles.actionBtn,
                              item.isDisabled ? styles.enableBtn : styles.disableBtn
                            ]}
                            onPress={() => item.isDisabled ? handleEnableOrganizer(item._id) : handleDisableOrganizer(item._id)}
                          >
                            <Text style={styles.actionBtnText}>
                              {item.isDisabled ? 'Enable' : 'Disable'}
                            </Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.deleteBtn]}
                          onPress={() => handleDelete(item._id)}
                        >
                          <Text style={styles.deleteBtnText}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              ))}
          </View>
        )}
      </ScrollView>

      <Modal animationType="fade" transparent={true} visible={modalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Organizer</Text>
            <Text style={styles.modalSubtitle}>Fill in the details below</Text>
            
            <TextInput 
              style={styles.input} 
              placeholder="Organization Name *" 
              placeholderTextColor="#999"
              value={newOrg.name} 
              onChangeText={(t) => setNewOrg({...newOrg, name: t})} 
            />
            <TextInput 
              style={styles.input} 
              placeholder="Category (e.g., robotics, cultural) *" 
              placeholderTextColor="#999"
              value={newOrg.category} 
              onChangeText={(t) => setNewOrg({...newOrg, category: t})} 
            />
            <TextInput 
              style={styles.input} 
              placeholder="Contact Number *" 
              placeholderTextColor="#999"
              value={newOrg.contactNumber} 
              keyboardType="phone-pad"
              onChangeText={(t) => setNewOrg({...newOrg, contactNumber: t})} 
            />
            <TextInput 
              style={styles.input} 
              placeholder="Description (optional)" 
              placeholderTextColor="#999"
              value={newOrg.description} 
              multiline
              numberOfLines={2}
              onChangeText={(t) => setNewOrg({...newOrg, description: t})} 
            />
            
            {/* Auto-generate button */}
            <TouchableOpacity 
              style={styles.generateBtn} 
              onPress={generateCredentials}
            >
              <Text style={styles.generateBtnText}>Generate Credentials</Text>
            </TouchableOpacity>
            
            <TextInput 
              style={styles.input} 
              placeholder="Email *" 
              placeholderTextColor="#999"
              value={newOrg.email} 
              autoCapitalize="none" 
              keyboardType="email-address"
              onChangeText={(t) => setNewOrg({...newOrg, email: t})} 
            />
            <TextInput 
              style={styles.input} 
              placeholder="Password *" 
              placeholderTextColor="#999"
              value={newOrg.password} 
              secureTextEntry 
              onChangeText={(t) => setNewOrg({...newOrg, password: t})} 
            />
            
            {newOrg.email && newOrg.password && (
              <View style={styles.credentialsBox}>
                <Text style={styles.credentialsTitle}>Login Credentials</Text>
                <Text style={styles.credentialsText}>Email: {newOrg.email}</Text>
                <Text style={styles.credentialsText}>Password: {newOrg.password}</Text>
                <Text style={styles.credentialsNote}>Save and share these with the organizer</Text>
              </View>
            )}
            
            <TouchableOpacity style={styles.submitButton} onPress={handleCreateOrganizer}>
              <Text style={styles.submitButtonText}>Create Account</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {
              setModalVisible(false);
              setNewOrg({ name: '', email: '', password: '', category: '', contactNumber: '', description: '' });
            }}>
              <Text style={styles.closeButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  contentWrapper: { paddingHorizontal: 20, paddingBottom: 40 },
  headerContainer: { alignItems: 'center', paddingVertical: 40, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  header: { fontSize: 28, fontWeight: '600', color: '#1a1a1a', letterSpacing: 0.3 },
  subHeader: { fontSize: 14, color: '#666666', marginTop: 8, fontWeight: '400' },
  addButton: { 
    backgroundColor: '#1a1a1a', 
    padding: 14, 
    borderRadius: 0, 
    marginVertical: 20, 
    alignItems: 'center', 
    width: Platform.OS === 'web' ? 400 : '100%', 
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a'
  },
  addButtonText: { color: '#ffffff', fontWeight: '500', fontSize: 14, letterSpacing: 0.3 },
  
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { color: '#666666', fontSize: 16, marginTop: 10, fontWeight: '400' },
  
  // Table styles
  tableContainer: {
    marginHorizontal: 0,
    marginBottom: 20,
    backgroundColor: '#ffffff',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#d0d0d0',
  },
  headerCell: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1a1a1a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  organizerRow: {
    backgroundColor: '#ffffff',
  },
  disabledRow: {
    opacity: 0.5,
    backgroundColor: '#f5f5f5',
  },
  tableCell: {
    paddingHorizontal: 8,
  },
  
  // Column widths
  nameColumn: { flex: 2.5 },
  emailColumn: { flex: 2 },
  clubColumn: { flex: 2 },
  statusColumn: { flex: 1.2 },
  actionsColumn: { flex: 2 },
  
  // Name column styles
  nameInfo: { flex: 1 },
  name: { fontSize: 14, fontWeight: '500', color: '#1a1a1a', marginBottom: 3, letterSpacing: 0.3 },
  contactText: { fontSize: 11, color: '#666666', fontWeight: '400' },
  
  // Email column styles
  email: { fontSize: 13, color: '#666666', fontWeight: '400' },
  
  // Club/Role column styles
  categoryText: { fontSize: 13, color: '#1a1a1a', fontWeight: '500', marginBottom: 2 },
  descriptionText: { fontSize: 11, color: '#666666', fontStyle: 'normal', fontWeight: '400' },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 0,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  adminBadge: { backgroundColor: '#f5f5f5', borderColor: '#d0d0d0' },
  userBadge: { backgroundColor: '#f5f5f5', borderColor: '#d0d0d0' },
  roleBadgeText: { fontSize: 10, fontWeight: '500', color: '#1a1a1a', letterSpacing: 0.5 },
  
  // Status column styles
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 0,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  activeBadge: { backgroundColor: '#ffffff', borderColor: '#1a1a1a' },
  disabledBadge: { backgroundColor: '#f5f5f5', borderColor: '#666666' },
  statusText: { fontSize: 10, fontWeight: '500', color: '#1a1a1a', letterSpacing: 0.5 },
  
  // Actions column styles
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 0,
    minWidth: 70,
    alignItems: 'center',
    borderWidth: 1,
  },
  disableBtn: { backgroundColor: '#ffffff', borderColor: '#666666' },
  enableBtn: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  deleteBtn: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  actionBtnText: { fontSize: 11, fontWeight: '500', color: '#1a1a1a', letterSpacing: 0.3 },
  deleteBtnText: { fontSize: 11, fontWeight: '500', color: '#ffffff', letterSpacing: 0.3 },
  protectedText: { fontSize: 11, color: '#666666', fontStyle: 'normal', fontWeight: '400' },
  
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  modalContent: { 
    width: Platform.OS === 'web' ? 500 : 350, 
    backgroundColor: '#ffffff', 
    borderRadius: 0, 
    padding: 30, 
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  modalTitle: { 
    fontSize: 22, 
    fontWeight: '600', 
    marginBottom: 8, 
    textAlign: 'center',
    color: '#1a1a1a',
    letterSpacing: 0.3
  },
  modalSubtitle: { 
    fontSize: 13, 
    color: '#666666', 
    marginBottom: 24, 
    textAlign: 'center',
    fontWeight: '400'
  },
  input: { 
    width: '100%', 
    borderWidth: 1, 
    borderColor: '#d0d0d0', 
    backgroundColor: '#ffffff', 
    marginBottom: 16, 
    padding: 12, 
    borderRadius: 0,
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '400'
  },
  generateBtn: {
    backgroundColor: '#f5f5f5',
    width: '100%',
    padding: 12,
    borderRadius: 0,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  generateBtnText: {
    color: '#1a1a1a',
    fontWeight: '500',
    fontSize: 13,
    letterSpacing: 0.3
  },
  credentialsBox: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 0,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    width: '100%'
  },
  credentialsTitle: {
    color: '#1a1a1a',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
    letterSpacing: 0.3
  },
  credentialsText: {
    color: '#1a1a1a',
    fontSize: 12,
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '400'
  },
  credentialsNote: {
    color: '#666666',
    fontSize: 11,
    marginTop: 8,
    fontWeight: '400'
  },
  submitButton: { 
    backgroundColor: '#1a1a1a', 
    width: '100%', 
    padding: 14, 
    borderRadius: 0, 
    alignItems: 'center', 
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1a1a1a'
  },
  submitButtonText: { 
    color: '#ffffff', 
    fontWeight: '500', 
    fontSize: 14,
    letterSpacing: 0.3
  },
  closeButtonText: { 
    color: '#666666', 
    marginTop: 10, 
    textAlign: 'center',
    fontWeight: '400',
    fontSize: 13
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
});

export default AdminScreen;