import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import api, { API_BASE_URL, getDefaultHeaders } from '../services/api';

const getDocumentId = (document) => document.id || document.documentId || document.adminDocumentId;

const getDocumentFileName = (document) =>
  document.fileName ||
  document.originalFileName ||
  document.name ||
  document.blobName ||
  `${document.title || 'document'}.pdf`;

const getDownloadFileName = (document) => {
  const fileName = getDocumentFileName(document);
  return fileName.replace(/[^\w.\-() ]+/g, '_');
};

const getMimeType = (fileName) => {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (lower.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (lower.endsWith('.ppt')) return 'application/vnd.ms-powerpoint';
  if (lower.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  return 'application/octet-stream';
};

const BrochuresScreen = ({ navigation }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin-documents');
      setDocuments(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error loading documents:', error);
      Alert.alert('Error', 'Failed to load documents. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (document) => {
    const documentId = getDocumentId(document);
    const fileName = getDocumentFileName(document);

    if (!documentId || !fileName) {
      Alert.alert('Download failed', 'Document download details are missing.');
      return;
    }

    setDownloadingId(documentId);
    try {
      const headers = await getDefaultHeaders();
      const safeFileName = getDownloadFileName(document);
      const targetUri = `${FileSystem.documentDirectory}${safeFileName}`;
      const downloadUrl = `${API_BASE_URL}/admin-documents/${documentId}/download/${encodeURIComponent(fileName)}`;
      const result = await FileSystem.downloadAsync(downloadUrl, targetUri, { headers });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, {
          mimeType: getMimeType(safeFileName),
          dialogTitle: 'Save Document',
        });
      } else {
        Alert.alert('Downloaded', `Document saved as ${safeFileName}`);
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      Alert.alert('Download failed', 'Unable to download this document right now.');
    } finally {
      setDownloadingId(null);
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-text-outline" size={56} color="#9CA3AF" />
      <Text style={styles.emptyTitle}>No documents available</Text>
      <Text style={styles.emptyText}>Uploaded admin documents will appear here.</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#4F46E5" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Documents</Text>
        <TouchableOpacity style={styles.backButton} onPress={loadDocuments}>
          <Ionicons name="refresh" size={22} color="#4F46E5" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Loading documents...</Text>
        </View>
      ) : documents.length === 0 ? (
        renderEmptyState()
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {documents.map((document) => {
            const documentId = getDocumentId(document);
            const fileName = getDocumentFileName(document);
            const isDownloading = downloadingId === documentId;

            return (
              <View key={documentId || fileName} style={styles.documentCard}>
                <View style={styles.documentIcon}>
                  <Ionicons name="document-text-outline" size={28} color="#4F46E5" />
                </View>
                <View style={styles.documentContent}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.category}>{document.category || 'Document'}</Text>
                  </View>
                  <Text style={styles.title}>{document.title || fileName}</Text>
                  {!!document.description && <Text style={styles.description}>{document.description}</Text>}
                  <TouchableOpacity
                    style={[styles.downloadButton, isDownloading && styles.downloadButtonDisabled]}
                    onPress={() => handleDownload(document)}
                    disabled={isDownloading}
                  >
                    {isDownloading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Ionicons name="download-outline" size={18} color="#FFFFFF" />
                    )}
                    <Text style={styles.downloadButtonText}>
                      {isDownloading ? 'Downloading...' : 'Download'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
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
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 16,
    paddingHorizontal: 20,
    paddingTop: 54,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#1F2937',
    fontSize: 20,
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
  content: {
    padding: 16,
  },
  documentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 2,
    flexDirection: 'row',
    marginBottom: 14,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  documentIcon: {
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    height: 52,
    justifyContent: 'center',
    marginRight: 14,
    width: 52,
  },
  documentContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  category: {
    backgroundColor: '#E0E7FF',
    borderRadius: 8,
    color: '#4338CA',
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  title: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  description: {
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  downloadButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  downloadButtonDisabled: {
    opacity: 0.7,
  },
  downloadButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: '#1F2937',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default BrochuresScreen;
