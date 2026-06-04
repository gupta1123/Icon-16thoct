import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import moment from 'moment';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import api from '../services/api';

const getNotificationId = (notification) => notification.id || notification.notificationId;

const getNotificationTitle = (notification) =>
  notification.title ||
  notification.heading ||
  notification.subject ||
  notification.type ||
  'Notification';

const getNotificationMessage = (notification) =>
  notification.message ||
  notification.body ||
  notification.description ||
  notification.content ||
  '';

const getNotificationDate = (notification) =>
  notification.createdAt ||
  notification.createdDate ||
  notification.updatedAt ||
  notification.date ||
  notification.notificationDate;

const getVisitId = (notification) =>
  notification.visitId ||
  notification.visit?.id ||
  notification.data?.visitId ||
  notification.referenceId;

const isNotificationRead = (notification) =>
  notification.read === true || notification.isRead === true || notification.readAt;

const Notifications1 = ({ route, authToken: propAuthToken }) => {
  const navigation = useNavigation();
  const authToken = route?.params?.authToken || propAuthToken;
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    fetchNotifications();
  }, [showUnreadOnly]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const employeeId = await AsyncStorage.getItem('employeeId');
      const readFilter = showUnreadOnly ? '&read=false' : '';
      const response = await api.get(`/notifications?employeeId=${employeeId}${readFilter}`);
      setNotifications(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      Alert.alert('Error', 'Failed to load notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const markNotificationRead = async (notification) => {
    const employeeId = await AsyncStorage.getItem('employeeId');
    const notificationId = getNotificationId(notification);
    if (!notificationId || isNotificationRead(notification)) return;

    setUpdatingId(notificationId);
    try {
      await api.put(`/notifications/${notificationId}/read?employeeId=${employeeId}`, {});
      setNotifications((prev) =>
        prev.map((item) =>
          getNotificationId(item) === notificationId
            ? { ...item, read: true, isRead: true, readAt: new Date().toISOString() }
            : item
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
      Alert.alert('Error', 'Failed to mark notification as read.');
    } finally {
      setUpdatingId(null);
    }
  };

  const markAllRead = async () => {
    try {
      const employeeId = await AsyncStorage.getItem('employeeId');
      await api.put(`/notifications/read-all?employeeId=${employeeId}`, {});
      setNotifications((prev) =>
        showUnreadOnly
          ? []
          : prev.map((item) => ({ ...item, read: true, isRead: true, readAt: new Date().toISOString() }))
      );
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      Alert.alert('Error', 'Failed to mark all notifications as read.');
    }
  };

  const handleNotificationPress = async (notification) => {
    await markNotificationRead(notification);
    const visitId = getVisitId(notification);
    if (visitId) {
      navigation.navigate('VisitScreen', { visitId, authToken });
    }
  };

  const renderNotification = (notification) => {
    const notificationId = getNotificationId(notification);
    const read = isNotificationRead(notification);
    const title = getNotificationTitle(notification);
    const message = getNotificationMessage(notification);
    const createdAt = getNotificationDate(notification);
    const isUpdating = updatingId === notificationId;

    return (
      <TouchableOpacity
        key={notificationId || `${title}-${createdAt}`}
        style={[styles.notificationCard, !read && styles.unreadCard]}
        onPress={() => handleNotificationPress(notification)}
      >
        <View style={[styles.iconContainer, { backgroundColor: read ? '#6B7280' : '#4F46E5' }]}>
          <Ionicons name={read ? 'notifications-outline' : 'notifications'} size={24} color="#FFF" />
        </View>
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text style={styles.storeName}>{title}</Text>
            {!read && (
              <View style={styles.unreadPill}>
                <Text style={styles.unreadPillText}>Unread</Text>
              </View>
            )}
          </View>
          {!!message && <Text style={styles.visitPurpose}>{message}</Text>}
          <Text style={styles.notificationTime}>
            {createdAt ? moment(createdAt).format('MMMM D, YYYY h:mm A') : 'No time specified'}
          </Text>
          {!read && (
            <TouchableOpacity
              style={styles.markReadButton}
              onPress={() => markNotificationRead(notification)}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color="#4F46E5" />
              ) : (
                <Text style={styles.markReadButtonText}>Mark as read</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F3F4F6" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity onPress={fetchNotifications} style={styles.backButton}>
          <Ionicons name="refresh" size={22} color="#4F46E5" />
        </TouchableOpacity>
      </View>

      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.filterButton, !showUnreadOnly && styles.filterButtonActive]}
          onPress={() => setShowUnreadOnly(false)}
        >
          <Text style={[styles.filterButtonText, !showUnreadOnly && styles.filterButtonTextActive]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, showUnreadOnly && styles.filterButtonActive]}
          onPress={() => setShowUnreadOnly(true)}
        >
          <Text style={[styles.filterButtonText, showUnreadOnly && styles.filterButtonTextActive]}>Unread</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.markAllButton} onPress={markAllRead}>
          <Text style={styles.markAllButtonText}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {notifications.map(renderNotification)}
          {notifications.length === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={56} color="#9CA3AF" />
              <Text style={styles.emptyText}>No notifications</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  toolbar: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  filterButton: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterButtonActive: {
    backgroundColor: '#EEF2FF',
  },
  filterButtonText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '700',
  },
  filterButtonTextActive: {
    color: '#4F46E5',
  },
  markAllButton: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  markAllButtonText: {
    color: '#4F46E5',
    fontSize: 13,
    fontWeight: '700',
  },
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  loadingText: {
    color: '#6B7280',
    marginTop: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  notificationCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    elevation: 3,
    flexDirection: 'row',
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  unreadCard: {
    borderColor: '#C7D2FE',
    borderWidth: 1,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
  },
  notificationContent: {
    flex: 1,
    padding: 16,
  },
  notificationHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  storeName: {
    color: '#1F2937',
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
  },
  unreadPill: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  unreadPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  visitPurpose: {
    color: '#4B5563',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationTime: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  markReadButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  markReadButtonText: {
    color: '#4F46E5',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
});

export default Notifications1;
