import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Platform, Alert, Modal } from 'react-native';
import api from '../api/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AdminPasswordRequestsScreen = ({ navigation }) => {
  const [requests, setRequests] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [passwordModal, setPasswordModal] = useState({ visible: false, password: '', email: '', name: '', clubName: '' });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await api.get('/password-requests/pending', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRequests(response.data);
    } catch (error) {
      console.error('Error fetching requests:', error);
      const msg = error.response?.data?.message || 'Failed to load requests';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAllRequests = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await api.get('/password-requests/all', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllRequests(response.data);
    } catch (error) {
      console.error('Error fetching all requests:', error);
      const msg = error.response?.data?.message || 'Failed to load history';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    }
  };

  const handleApprove = async (id) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await api.put(`/password-requests/approve/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Get the request details
      const request = requests.find(r => r._id === id);
      
      // Show generated password modal
      setPasswordModal({
        visible: true,
        password: response.data.generatedPassword,
        email: request.userId.email,
        name: request.userId.name,
        clubName: request.clubName
      });
      
      fetchRequests(); 
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to approve';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    }
  };

  const handleReject = async (id) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await api.put(`/password-requests/reject/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (Platform.OS === 'web') {
        window.alert(response.data.message);
      } else {
        Alert.alert('Success', response.data.message);
      }
      
      fetchRequests(); 
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to reject';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#8338ec" />
        <Text style={styles.loadingText}>Loading requests...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Password Requests</Text>
        <Text style={styles.headerSubtitle}>
          {requests.length === 0 ? 'No pending requests' : `${requests.length} pending`}
        </Text>
      </View>

      <TouchableOpacity 
        style={styles.historyButton}
        onPress={() => {
          setShowHistory(!showHistory);
          if (!showHistory) fetchAllRequests();
        }}
      >
        <Text style={styles.historyButtonText}>{showHistory ? 'Hide' : 'View'} History</Text>
      </TouchableOpacity>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {!showHistory ? (
          requests.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No pending requests</Text>
            </View>
          ) : (
            requests.map((request) => (
            <View key={request._id} style={styles.requestCard}>
              <View style={styles.requestHeader}>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{request.userId?.name || 'Unknown User'}</Text>
                  <Text style={styles.userEmail}>{request.userId?.email || 'No email'}</Text>
                  {request.clubName && <Text style={styles.clubName}>{request.clubName}</Text>}
                  <Text style={styles.userRole}>
                    {request.userType ? 
                      (request.userType.charAt(0).toUpperCase() + request.userType.slice(1)) : 
                      (request.userId?.role === 'organizer' ? 'Organizer' : 
                       request.userId?.role === 'admin' ? 'Admin' : 'Participant')}
                  </Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>Pending</Text>
                </View>
              </View>

              <View style={styles.requestDetails}>
                <Text style={styles.detailLabel}>Requested:</Text>
                <Text style={styles.detailValue}>
                  {new Date(request.requestedAt || request.createdAt).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric'
                  })}
                </Text>
              </View>

              {request.reason && (
                <View style={styles.reasonBox}>
                  <Text style={styles.reasonLabel}>Reason:</Text>
                  <Text style={styles.reasonText}>{request.reason}</Text>
                </View>
              )}

              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={styles.approveButton}
                  onPress={() => handleApprove(request._id)}
                >
                  <Text style={styles.approveButtonText}>Approve</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.rejectButton}
                  onPress={() => handleReject(request._id)}
                >
                  <Text style={styles.rejectButtonText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) 
        ) : (
          allRequests.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No password reset history</Text>
              <Text style={styles.emptySubtext}>Requests will appear here once processed</Text>
            </View>
          ) : (
            allRequests.map((request) => (
              <View key={request._id} style={[
                styles.requestCard,
                request.status === 'approved' && styles.approvedCard,
                request.status === 'rejected' && styles.rejectedCard
              ]}>
                <View style={styles.requestHeader}>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{request.userId?.name || 'Unknown User'}</Text>
                    <Text style={styles.userEmail}>{request.userId?.email || 'No email'}</Text>
                    {request.clubName && <Text style={styles.clubName}>{request.clubName}</Text>}
                    <Text style={styles.userRole}>
                      {request.userType ? 
                        (request.userType.charAt(0).toUpperCase() + request.userType.slice(1)) : 
                        (request.userId?.role === 'organizer' ? 'Organizer' : 
                         request.userId?.role === 'admin' ? 'Admin' : 'Participant')}
                    </Text>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    request.status === 'approved' && styles.approvedBadge,
                    request.status === 'rejected' && styles.rejectedBadge
                  ]}>
                    <Text style={styles.statusText}>
                      {request.status === 'approved' ? 'Approved' : 
                       request.status === 'rejected' ? 'Rejected' : 'Pending'}
                    </Text>
                  </View>
                </View>

                <View style={styles.requestDetails}>
                  <Text style={styles.detailLabel}>Requested:</Text>
                  <Text style={styles.detailValue}>
                    {new Date(request.requestedAt || request.createdAt).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                </View>

                {request.processedAt && (
                  <View style={styles.requestDetails}>
                    <Text style={styles.detailLabel}>Processed:</Text>
                    <Text style={styles.detailValue}>
                      {new Date(request.processedAt).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Text>
                  </View>
                )}

                {request.reason && (
                  <View style={styles.reasonBox}>
                    <Text style={styles.reasonLabel}>Reason:</Text>
                    <Text style={styles.reasonText}>{request.reason}</Text>
                  </View>
                )}

                {request.adminComments && (
                  <View style={styles.adminCommentsBox}>
                    <Text style={styles.reasonLabel}>Admin Comments:</Text>
                    <Text style={styles.reasonText}>{request.adminComments}</Text>
                  </View>
                )}

                {request.processedBy && (
                  <View style={styles.processedByBox}>
                    <Text style={styles.processedByText}>Processed by: {request.processedBy.name}</Text>
                  </View>
                )}
              </View>
            ))
          )
        )}
      </ScrollView>

      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>

      {/* Generated Password Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={passwordModal.visible}
        onRequestClose={() => setPasswordModal({ ...passwordModal, visible: false })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Password Reset Approved!</Text>
            <Text style={styles.modalSubtitle}>New password generated for {passwordModal.name}</Text>
            {passwordModal.clubName && <Text style={styles.modalClub}>{passwordModal.clubName}</Text>}
            
            <View style={styles.credentialsBox}>
              <Text style={styles.credLabel}>Email:</Text>
              <Text style={styles.credValue}>{passwordModal.email}</Text>
              
              <Text style={styles.credLabel}>New Password:</Text>
              <View style={styles.passwordBox}>
                <Text style={styles.passwordValue}>{passwordModal.password}</Text>
              </View>
            </View>
            
            <Text style={styles.warningText}>Copy and share these credentials securely.</Text>
            
            <TouchableOpacity 
              style={styles.copyButton}
              onPress={() => {
                if (Platform.OS === 'web') {
                  const clubInfo = passwordModal.clubName ? `\nClub: ${passwordModal.clubName}` : '';
                  navigator.clipboard.writeText(
                    `Password Reset Credentials\n\nUser: ${passwordModal.name}${clubInfo}\nEmail: ${passwordModal.email}\nNew Password: ${passwordModal.password}\n\nPlease change this password after first login.`
                  );
                  alert('Credentials copied to clipboard!');
                } else {
                  Alert.alert('Credentials', `Email: ${passwordModal.email}\nPassword: ${passwordModal.password}`);
                }
              }}
            >
              <Text style={styles.copyButtonText}>Copy to Clipboard</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.closeModalButton}
              onPress={() => setPasswordModal({ visible: false, password: '', email: '', name: '', clubName: '' })}
            >
              <Text style={styles.closeModalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff'
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff'
  },
  loadingText: {
    color: '#666666',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '400'
  },
  header: {
    backgroundColor: '#ffffff',
    padding: 30,
    paddingTop: 40,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  headerTitle: {
    fontSize: Platform.OS === 'web' ? 28 : 24,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
    letterSpacing: 0.3
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#666666',
    fontWeight: '400'
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    padding: 20
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#666666',
    marginBottom: 5
  },
  requestCard: {
    backgroundColor: '#ffffff',
    borderRadius: 0,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  approvedCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#1a1a1a'
  },
  rejectedCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#666666'
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16
  },
  userInfo: {
    flex: 1
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 6,
    letterSpacing: 0.3
  },
  userEmail: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 4,
    fontWeight: '400'
  },
  clubName: {
    fontSize: 13,
    color: '#1a1a1a',
    fontWeight: '500',
    marginBottom: 4
  },
  userRole: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '400'
  },
  statusBadge: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  approvedBadge: {
    backgroundColor: '#ffffff',
    borderColor: '#1a1a1a'
  },
  rejectedBadge: {
    backgroundColor: '#f5f5f5',
    borderColor: '#666666'
  },
  statusText: {
    color: '#1a1a1a',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5
  },
  requestDetails: {
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0'
  },
  detailLabel: {
    fontSize: 11,
    color: '#666666',
    marginBottom: 4,
    fontWeight: '400'
  },
  detailValue: {
    fontSize: 13,
    color: '#1a1a1a',
    fontWeight: '400'
  },
  reasonBox: {
    backgroundColor: '#f5f5f5',
    padding: 14,
    borderRadius: 0,
    marginTop: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#1a1a1a'
  },
  reasonLabel: {
    fontSize: 12,
    color: '#1a1a1a',
    marginBottom: 8,
    fontWeight: '500',
    letterSpacing: 0.3
  },
  reasonText: {
    fontSize: 13,
    color: '#1a1a1a',
    lineHeight: 20,
    fontWeight: '400'
  },
  adminCommentsBox: {
    backgroundColor: '#f5f5f5',
    padding: 14,
    borderRadius: 0,
    marginTop: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#666666'
  },
  processedByBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0'
  },
  processedByText: {
    fontSize: 11,
    color: '#666666',
    fontStyle: 'normal',
    fontWeight: '400'
  },
  historyButton: {
    backgroundColor: '#f5f5f5',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 0,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  historyButtonText: {
    color: '#1a1a1a',
    fontWeight: '500',
    fontSize: 14,
    letterSpacing: 0.3
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12
  },
  approveButton: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 14,
    borderRadius: 0,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a'
  },
  approveButtonText: {
    color: '#ffffff',
    fontWeight: '500',
    fontSize: 13,
    letterSpacing: 0.3
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 0,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a'
  },
  rejectButtonText: {
    color: '#1a1a1a',
    fontWeight: '500',
    fontSize: 13,
    letterSpacing: 0.3
  },
  backButton: {
    backgroundColor: '#f5f5f5',
    margin: 20,
    padding: 14,
    borderRadius: 0,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  backButtonText: {
    color: '#1a1a1a',
    fontWeight: '500',
    fontSize: 14,
    letterSpacing: 0.3
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 0,
    padding: 30,
    width: Platform.OS === 'web' ? 500 : '100%',
    maxWidth: 500,
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.3
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 6,
    fontWeight: '400'
  },
  modalClub: {
    fontSize: 13,
    color: '#1a1a1a',
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: 24
  },
  credentialsBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 0,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  credLabel: {
    fontSize: 11,
    color: '#666666',
    marginBottom: 6,
    marginTop: 12,
    fontWeight: '500',
    letterSpacing: 0.3
  },
  credValue: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '400',
    marginBottom: 12
  },
  passwordBox: {
    backgroundColor: '#ffffff',
    borderRadius: 0,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1a1a1a'
  },
  passwordValue: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  warningText: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '400',
    lineHeight: 18
  },
  copyButton: {
    backgroundColor: '#1a1a1a',
    padding: 14,
    borderRadius: 0,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1a1a1a'
  },
  copyButtonText: {
    color: '#ffffff',
    fontWeight: '500',
    fontSize: 14,
    letterSpacing: 0.3
  },
  closeModalButton: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 0,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d0d0'
  },
  closeModalButtonText: {
    color: '#1a1a1a',
    fontWeight: '400',
    fontSize: 13
  }
});

export default AdminPasswordRequestsScreen;