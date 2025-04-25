import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  Image,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { chatSaveService } from '@/services/ChatSaveService';
import { chatExportService } from '@/services/ChatExportService';
import { ChatSave, Message } from '@/shared/types';
import { BlurView } from 'expo-blur';
import { theme } from '@/constants/theme';
import { formatDate } from '@/utils/dateUtils';
import { NodeSTManager } from '@/utils/NodeSTManager';

interface SaveManagerProps {
  visible: boolean;
  onClose: () => void;
  conversationId: string;
  characterId: string;
  characterName: string;
  characterAvatar?: string;
  messages: Message[];
  onSaveCreated?: (save: ChatSave) => void;
  onLoadSave?: (save: ChatSave) => void;
  onPreviewSave?: (save: ChatSave) => void;
}

const SaveManager: React.FC<SaveManagerProps> = ({
  visible,
  onClose,
  conversationId,
  characterId,
  characterName,
  characterAvatar,
  messages,
  onSaveCreated,
  onLoadSave,
  onPreviewSave
}) => {
  const [tab, setTab] = useState<'load' | 'save' | 'import'>('load');
  const [saveDescription, setSaveDescription] = useState('');
  const [saves, setSaves] = useState<ChatSave[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSave, setSelectedSave] = useState<ChatSave | null>(null);
  const [importInProgress, setImportInProgress] = useState(false);

  // Load saves for this conversation
  useEffect(() => {
    if (visible) {
      loadSaves();
    }
  }, [visible, conversationId]);

  const loadSaves = async () => {
    if (!conversationId) return;
    
    setLoading(true);
    try {
      const conversationSaves = await chatSaveService.getSavesForConversation(conversationId);
      setSaves(conversationSaves);
    } catch (error) {
      console.error('Error loading saves:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSave = async () => {
    if (!conversationId || messages.length === 0) {
      Alert.alert('Error', 'Cannot create save point - no messages.');
      return;
    }
    
    if (!saveDescription.trim()) {
      Alert.alert('Error', 'Please enter a description.');
      return;
    }
    
    setLoading(true);
    try {
      const newSave = await chatSaveService.saveChat(
        conversationId,
        characterId,
        characterName,
        messages,
        saveDescription,
        characterAvatar
      );
      
      setSaveDescription('');
      setSaves(prev => [newSave, ...prev]);
      
      if (onSaveCreated) {
        onSaveCreated(newSave);
      }
      
      Alert.alert('Success', 'Chat state saved successfully!');
    } catch (error) {
      console.error('Error creating save:', error);
      Alert.alert('Error', 'Failed to save chat state.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSave = async (save: ChatSave) => {
    Alert.alert(
      'Delete Save',
      `Are you sure you want to delete this save point: "${save.description}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await chatSaveService.deleteSave(save.id);
              setSaves(prev => prev.filter(s => s.id !== save.id));
            } catch (error) {
              console.error('Error deleting save:', error);
              Alert.alert('Error', 'Failed to delete save point.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleLoadSave = async (save: ChatSave) => {
    if (onLoadSave) {
      Alert.alert(
        'Load Save',
        `Are you sure you want to restore chat to: "${save.description}"?\n\nThis will replace your current chat state.`,
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Load',
            onPress: async () => {
              setLoading(true);
              try {
                // First restore the NodeST chat history directly with AsyncStorage
                if (save.nodestChatHistory) {
                  console.log('[SaveManager] Restoring NodeST chat history before UI update');
                  
                  // First use NodeSTManager to restore
                  const restored = await NodeSTManager.restoreChatHistory({
                    conversationId: conversationId,
                    chatHistory: save.nodestChatHistory
                  });
                  
                  // Fall back to ChatSaveService if needed
                  if (!restored) {
                    console.log('[SaveManager] Falling back to ChatSaveService for history restoration');
                    await chatSaveService.restoreNodeSTChatHistory(
                      conversationId,
                      save
                    );
                  }
                  
                  console.log('[SaveManager] NodeST chat history restoration complete');
                } else {
                  console.warn('[SaveManager] Save does not contain NodeST chat history');
                }
                
                // Now call the onLoadSave callback to update UI
                onLoadSave(save);
                
                setLoading(false);
              } catch (error) {
                console.error('[SaveManager] Error restoring chat state:', error);
                Alert.alert('Error', 'Failed to restore chat state.');
                setLoading(false);
              }
            }
          }
        ]
      );
    }
  };

  const handlePreviewSave = async (save: ChatSave) => {
    setSelectedSave(save);
    if (onPreviewSave) {
      onPreviewSave(save);
    }
  };

  const handleExportSave = async (save: ChatSave) => {
    try {
      setLoading(true);
      
      // Show confirmation dialog
      Alert.alert(
        'Export Save',
        `Export "${save.description}" to a file?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setLoading(false)
          },
          {
            text: 'Export',
            onPress: async () => {
              const success = await chatExportService.exportChatSave(save);
              setLoading(false);
              
              if (!success) {
                Alert.alert(
                  'Export Failed',
                  'Unable to export chat save. Please check app permissions.'
                );
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error exporting save:', error);
      Alert.alert('Error', 'Failed to export save.');
      setLoading(false);
    }
  };

  const handleImportSave = async () => {
    try {
      setImportInProgress(true);
      
      const importedSave = await chatExportService.importChatSave();
      
      if (!importedSave) {
        setImportInProgress(false);
        return;
      }
      
      // Check if the imported save is for this conversation
      const isValidForThisConversation = chatSaveService.isValidSaveForConversation(
        importedSave,
        conversationId
      );
      
      if (!isValidForThisConversation) {
        Alert.alert(
          'Import Warning',
          'The imported save is for a different conversation or character. ' +
          'It will be available in your saves, but can only be used with the correct character.'
        );
      } else {
        // Refresh the saves list
        await loadSaves();
        
        Alert.alert(
          'Import Successful',
          'Chat save imported successfully.'
        );
      }
      
      setImportInProgress(false);
    } catch (error) {
      console.error('Error importing save:', error);
      Alert.alert('Error', 'Failed to import save.');
      setImportInProgress(false);
    }
  };

  const renderSaveItem = ({ item }: { item: ChatSave }) => (
    <View style={[
      styles.saveItem,
      selectedSave?.id === item.id && styles.selectedSaveItem,
      item.importedAt ? styles.importedSaveItem : null
    ]}>
      <TouchableOpacity 
        style={styles.savePreviewButton}
        onPress={() => handlePreviewSave(item)}
      >
        <View style={styles.saveHeader}>
          <Image 
            source={characterAvatar ? { uri: characterAvatar } : require('@/assets/images/default-avatar.png')} 
            style={styles.saveAvatar}
          />
          <View style={styles.saveInfo}>
            <Text style={styles.saveDescription}>
              {item.description}
              {item.importedAt && (
                <Text style={styles.importedBadge}> (Imported)</Text>
              )}
            </Text>
            <Text style={styles.saveTimestamp}>{formatDate(item.timestamp)}</Text>
            <Text style={styles.savePreviewText}>{item.previewText}</Text>
          </View>
        </View>
      </TouchableOpacity>
      
      <View style={styles.saveActions}>
        <TouchableOpacity 
          style={styles.saveActionButton}
          onPress={() => handleExportSave(item)}
        >
          <Ionicons name="share-outline" size={22} color="#fff" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.saveActionButton}
          onPress={() => handleLoadSave(item)}
        >
          <Ionicons name="refresh-outline" size={22} color="#fff" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.saveActionButton, styles.deleteButton]}
          onPress={() => handleDeleteSave(item)}
        >
          <Ionicons name="trash-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <BlurView intensity={30} style={styles.container} tint="dark">
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>存档管理</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.tabs}>
            <TouchableOpacity 
              style={[styles.tab, tab === 'load' && styles.activeTab]} 
              onPress={() => setTab('load')}
            >
              <Text style={[styles.tabText, tab === 'load' && styles.activeTabText]}>读取存档</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.tab, tab === 'save' && styles.activeTab]} 
              onPress={() => setTab('save')}
            >
              <Text style={[styles.tabText, tab === 'save' && styles.activeTabText]}>新建存档</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.tab, tab === 'import' && styles.activeTab]} 
              onPress={() => setTab('import')}
            >
              <Text style={[styles.tabText, tab === 'import' && styles.activeTabText]}>导入/导出</Text>
            </TouchableOpacity>
          </View>

          {tab === 'load' ? (
            <>
              <Text style={styles.sectionTitle}>当前存档</Text>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                  <Text style={styles.loadingText}>正在加载存档...</Text>
                </View>
              ) : saves.length > 0 ? (
                <FlatList
                  data={saves}
                  renderItem={renderSaveItem}
                  keyExtractor={item => item.id}
                  style={styles.savesList}
                  contentContainerStyle={styles.savesListContent}
                />
              ) : (
                <View style={styles.emptySaves}>
                  <Ionicons name="save-outline" size={40} color="#555" />
                  <Text style={styles.emptySavesText}>暂无存档</Text>
                </View>
              )}
            </>
          ) : tab === 'save' ? (
            <View style={styles.saveForm}>
              <Text style={styles.sectionTitle}>新存档</Text>
              <Text style={styles.label}>描述</Text>
              <TextInput
                style={styles.input}
                placeholder="输入描述..."
                placeholderTextColor="#999"
                value={saveDescription}
                onChangeText={setSaveDescription}
                maxLength={50}
              />
              <TouchableOpacity 
                style={[styles.saveButton, !saveDescription.trim() && styles.disabledButton]}
                onPress={handleCreateSave}
                disabled={!saveDescription.trim() || loading}
              >
                <Text style={styles.saveButtonText}>
                  {loading ? '存档中...' : '保存当前对话进度'}
                </Text>
              </TouchableOpacity>
              
              <View style={styles.saveInfo}>
                <Text style={styles.saveInfoText}>
                  将保存当前对话进度，当前消息数量： {messages.length}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.importExportContainer}>
              <Text style={styles.sectionTitle}>导入/导出</Text>
              
              <View style={styles.featureCard}>
                <View style={styles.featureHeader}>
                  <Ionicons name="download-outline" size={24} color="#fff" />
                  <Text style={styles.featureTitle}>导入存档</Text>
                </View>
                <Text style={styles.featureDescription}>
                  从设备中导入之前导出的对话存档文件。
                </Text>
                <TouchableOpacity 
                  style={styles.featureButton}
                  onPress={handleImportSave}
                  disabled={importInProgress}
                >
                  {importInProgress ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.featureButtonText}>导入存档文件</Text>
                  )}
                </TouchableOpacity>
              </View>
              
              <View style={styles.featureCard}>
                <View style={styles.featureHeader}>
                  <Ionicons name="share-outline" size={24} color="#fff" />
                  <Text style={styles.featureTitle}>导出存档</Text>
                </View>
                <Text style={styles.featureDescription}>
                  将对话存档导出为文件，方便备份或在不同设备上使用。
                </Text>
                <Text style={styles.featureSubtext}>
                  你可以在"读取存档"标签页中选择一个存档，然后点击分享按钮导出。
                </Text>
              </View>
              
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => setTab('load')}
              >
                <Ionicons name="arrow-back" size={20} color="#fff" />
                <Text style={styles.backButtonText}>返回到存档列表</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)'
  },
  modal: {
    width: '90%',
    maxWidth: 500,
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 20,
    maxHeight: '80%'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff'
  },
  closeButton: {
    padding: 4
  },
  tabs: {
    flexDirection: 'row',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#444'
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center'
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary
  },
  tabText: {
    fontSize: 16,
    color: '#aaa'
  },
  activeTabText: {
    color: theme.colors.primary,
    fontWeight: 'bold'
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12
  },
  savesList: {
    maxHeight: 400
  },
  savesListContent: {
    paddingBottom: 16
  },
  saveItem: {
    backgroundColor: '#333',
    borderRadius: 8,
    marginBottom: 12,
    padding: 12,
    flexDirection: 'column'
  },
  selectedSaveItem: {
    backgroundColor: '#3a4a5a',
    borderColor: theme.colors.primary,
    borderWidth: 1
  },
  importedSaveItem: {
    borderLeftColor: '#4caf50',
    borderLeftWidth: 4
  },
  saveHeader: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  saveAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12
  },
  saveInfo: {
    flex: 1
  },
  saveDescription: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4
  },
  importedBadge: {
    fontSize: 12,
    color: '#4caf50',
    fontWeight: 'normal'
  },
  saveTimestamp: {
    fontSize: 12,
    color: '#aaa',
    marginBottom: 4
  },
  savePreviewText: {
    fontSize: 14,
    color: '#ccc'
  },
  savePreviewButton: {
    flex: 1
  },
  saveActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12
  },
  saveActionButton: {
    backgroundColor: theme.colors.primary,
    padding: 8,
    borderRadius: 20,
    marginLeft: 8
  },
  deleteButton: {
    backgroundColor: '#e74c3c'
  },
  emptySaves: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40
  },
  emptySavesText: {
    fontSize: 16,
    color: '#aaa',
    marginVertical: 8
  },
  emptySavesSubtext: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center'
  },
  saveForm: {
    padding: 12
  },
  label: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 8
  },
  input: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    marginBottom: 16,
    fontSize: 16
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16
  },
  disabledButton: {
    opacity: 0.5
  },
  saveInfoText: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16
  },
  importExportContainer: {
    padding: 12
  },
  featureCard: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 10
  },
  featureDescription: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 16
  },
  featureSubtext: {
    fontSize: 12,
    color: '#aaa',
    marginBottom: 12,
    fontStyle: 'italic'
  },
  featureButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start'
  },
  featureButtonText: {
    color: '#fff',
    fontWeight: 'bold'
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12
  },
  backButtonText: {
    color: '#fff',
    marginLeft: 8
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30
  },
  loadingText: {
    color: '#aaa',
    marginTop: 12,
    fontSize: 16
  }
});

export default SaveManager;
