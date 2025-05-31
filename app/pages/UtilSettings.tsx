import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Alert,
  Dimensions,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { CharacterImporter } from '@/utils/CharacterImporter';
import { NodeSTCore } from '@/NodeST/nodest/core/node-st-core';
import { getApiSettings } from '@/utils/settings-helper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { unifiedGenerateContent } from '@/services/unified-api';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

const screenWidth = Dimensions.get('window').width;

interface AutoMessagePromptConfig {
  inputText: string;
  presetJson: string;
  worldBookJson: string;
  adapterType: 'gemini' | 'openrouter' | 'openai-compatible';
  messageArray: any[];
  autoMessageInterval?: number;
}

interface MemorySummaryPromptConfig {
  inputText: string;
  presetJson: string;
  worldBookJson: string;
  adapterType: 'gemini' | 'openrouter' | 'openai-compatible';
  messageArray: any[];
}

interface MemoryServiceConfig {
  summaryThreshold: number;
  summaryLength: number;
  summaryRange: { start: number; end: number } | null;
}

const AUTO_MESSAGE_STORAGE_KEY = 'auto_message_prompt_config';
const MEMORY_SUMMARY_STORAGE_KEY = 'memory_summary_prompt_config';
const MEMORY_SERVICE_STORAGE_KEY = 'memory_service_config';
const IMAGEGEN_STORAGE_KEY = 'imagegen_prompt_config';

export default function UtilSettings() {
  const [activeTab, setActiveTab] = useState('autoMessage');
  
  // Auto Message states
  const [inputText, setInputText] = useState('[AUTO_MESSAGE] 用户已经一段时间没有回复了。请基于上下文和你的角色设定，主动发起一条合适的消息。这条消息应该自然，不要直接提及用户长时间未回复的事实。');
  const [presetJson, setPresetJson] = useState<string>('');
  const [worldBookJson, setWorldBookJson] = useState<string>('');
  const [adapterType, setAdapterType] = useState<'gemini' | 'openrouter' | 'openai-compatible'>('gemini');
  const [messageArray, setMessageArray] = useState<any[]>([]);
  const [autoMessageInterval, setAutoMessageInterval] = useState<number>(5);
  
  // Memory Summary states
  const [memoryInputText, setMemoryInputText] = useState('请对以下对话内容进行总结。你的总结应该：1. 提取关键信息、事件、讨论的话题和重要细节 2. 保持叙述的连续性，不使用模糊的引用 3. 保留角色意图、情感和提到的重要承诺或计划 4. 专注于事实和内容，而不是对话的元描述 5. 使总结对继续对话有帮助');
  const [memoryPresetJson, setMemoryPresetJson] = useState<string>('');
  const [memoryWorldBookJson, setMemoryWorldBookJson] = useState<string>('');
  const [memoryAdapterType, setMemoryAdapterType] = useState<'gemini' | 'openrouter' | 'openai-compatible'>('gemini');
  const [memoryMessageArray, setMemoryMessageArray] = useState<any[]>([]);
  
  // Image Generation states
  const [imagegenInputText, setImagegenInputText] = useState('[IMAGEGEN] 请根据recentMessages变量（最近10条对话）生成一句不超过15个英文单词的连贯语句，描述角色当前的表情、动作、场景（时间、地点、画面），不要描述外观、服饰。输出英文短句。');
  const [imagegenPresetJson, setImagegenPresetJson] = useState<string>('');
  const [imagegenWorldBookJson, setImagegenWorldBookJson] = useState<string>('');
  const [imagegenAdapterType, setImagegenAdapterType] = useState<'gemini' | 'openrouter' | 'openai-compatible'>('gemini');
  const [imagegenMessageArray, setImagegenMessageArray] = useState<any[]>([]);

  // Memory Service settings states
  const [memorySummaryThreshold, setMemorySummaryThreshold] = useState<number>(6000);
  const [memorySummaryLength, setMemorySummaryLength] = useState<number>(1000);
  const [memorySummaryRangeEnabled, setMemorySummaryRangeEnabled] = useState<boolean>(false);
  const [memorySummaryRangeStart, setMemorySummaryRangeStart] = useState<number>(3);
  const [memorySummaryRangeEnd, setMemorySummaryRangeEnd] = useState<number>(10);
  
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState<string>('');
  const [apiLoading, setApiLoading] = useState(false);
  
  // Modal states
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewModalContent, setViewModalContent] = useState('');
  const [viewModalTitle, setViewModalTitle] = useState('');

  // 加载保存的配置
  useEffect(() => {
    loadSavedConfig();
    loadAdapterFromSettings();
  }, []);

  const loadSavedConfig = async () => {
    try {
      // Load auto message config
      const savedAuto = await AsyncStorage.getItem(AUTO_MESSAGE_STORAGE_KEY);
      if (savedAuto) {
        const config: AutoMessagePromptConfig = JSON.parse(savedAuto);
        setInputText(config.inputText || inputText);
        setPresetJson(config.presetJson || '');
        setWorldBookJson(config.worldBookJson || '');
        setAdapterType(config.adapterType || 'gemini');
        setMessageArray(config.messageArray || []);
        setAutoMessageInterval(config.autoMessageInterval ?? 5);
      }
      
      // Load memory summary config
      const savedMemory = await AsyncStorage.getItem(MEMORY_SUMMARY_STORAGE_KEY);
      if (savedMemory) {
        const config: MemorySummaryPromptConfig = JSON.parse(savedMemory);
        setMemoryInputText(config.inputText || memoryInputText);
        setMemoryPresetJson(config.presetJson || '');
        setMemoryWorldBookJson(config.worldBookJson || '');
        setMemoryAdapterType(config.adapterType || 'gemini');
        setMemoryMessageArray(config.messageArray || []);
      }
      
      // Load imagegen config
      const savedImagegen = await AsyncStorage.getItem(IMAGEGEN_STORAGE_KEY);
      if (savedImagegen) {
        const config: AutoMessagePromptConfig = JSON.parse(savedImagegen);
        setImagegenInputText(config.inputText || imagegenInputText);
        setImagegenPresetJson(config.presetJson || '');
        setImagegenWorldBookJson(config.worldBookJson || '');
        setImagegenAdapterType(config.adapterType || 'gemini');
        setImagegenMessageArray(config.messageArray || []);
      }
      
      // Load memory service config
      const savedMemoryService = await AsyncStorage.getItem(MEMORY_SERVICE_STORAGE_KEY);
      if (savedMemoryService) {
        const config: MemoryServiceConfig = JSON.parse(savedMemoryService);
        setMemorySummaryThreshold(config.summaryThreshold || 6000);
        setMemorySummaryLength(config.summaryLength || 1000);
        if (config.summaryRange) {
          setMemorySummaryRangeEnabled(true);
          setMemorySummaryRangeStart(config.summaryRange.start);
          setMemorySummaryRangeEnd(config.summaryRange.end);
        } else {
          setMemorySummaryRangeEnabled(false);
        }
      }
    } catch (e) {
      console.error('加载配置失败:', e);
    }
  };

  const loadAdapterFromSettings = async () => {
    try {
      const settings = getApiSettings();
      if (settings?.apiProvider) {
        const provider = settings.apiProvider.toLowerCase();
        let newAdapterType: 'gemini' | 'openrouter' | 'openai-compatible' = 'gemini';
        if (provider.includes('gemini')) {
          newAdapterType = 'gemini';
        } else if (provider.includes('openrouter')) {
          newAdapterType = 'openrouter';
        } else if (provider.includes('openai')) {
          newAdapterType = 'openai-compatible';
        }
        setAdapterType(newAdapterType);
        setMemoryAdapterType(newAdapterType);
        setImagegenAdapterType(newAdapterType);
      }
    } catch (e) {
      console.error('读取适配器设置失败:', e);
    }
  };

  const saveConfig = async () => {
    try {
      if (activeTab === 'autoMessage') {
        const config: AutoMessagePromptConfig = {
          inputText,
          presetJson,
          worldBookJson,
          adapterType,
          messageArray,
          autoMessageInterval
        };
        await AsyncStorage.setItem(AUTO_MESSAGE_STORAGE_KEY, JSON.stringify(config));
        Alert.alert('保存成功', '自动消息提示词配置已保存');
      } else if (activeTab === 'memorySummary') {
        const config: MemorySummaryPromptConfig = {
          inputText: memoryInputText,
          presetJson: memoryPresetJson,
          worldBookJson: memoryWorldBookJson,
          adapterType: memoryAdapterType,
          messageArray: memoryMessageArray
        };
        await AsyncStorage.setItem(MEMORY_SUMMARY_STORAGE_KEY, JSON.stringify(config));
        
        // Save memory service config
        const memoryServiceConfig: MemoryServiceConfig = {
          summaryThreshold: memorySummaryThreshold,
          summaryLength: memorySummaryLength,
          summaryRange: memorySummaryRangeEnabled ? {
            start: memorySummaryRangeStart,
            end: memorySummaryRangeEnd
          } : null
        };
        await AsyncStorage.setItem(MEMORY_SERVICE_STORAGE_KEY, JSON.stringify(memoryServiceConfig));
        
        Alert.alert('保存成功', '记忆总结提示词配置已保存');
      } else if (activeTab === 'imagegen') {
        const config: AutoMessagePromptConfig = {
          inputText: imagegenInputText,
          presetJson: imagegenPresetJson,
          worldBookJson: imagegenWorldBookJson,
          adapterType: imagegenAdapterType,
          messageArray: imagegenMessageArray
        };
        await AsyncStorage.setItem(IMAGEGEN_STORAGE_KEY, JSON.stringify(config));
        Alert.alert('保存成功', '图像生成提示词配置已保存');
      }
    } catch (e) {
      console.error('保存配置失败:', e);
      Alert.alert('保存失败', '无法保存配置');
    }
  };

  const handleImportPreset = async () => {
    setError('');
    try {
      const file = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (file.canceled || !file.assets?.[0]?.uri) return;
      const preset = await CharacterImporter.importPresetForCharacter(file.assets[0].uri, 'test');
      const presetStr = JSON.stringify(preset, null, 2);
      if (activeTab === 'autoMessage') {
        setPresetJson(presetStr);
      } else if (activeTab === 'memorySummary') {
        setMemoryPresetJson(presetStr);
      } else if (activeTab === 'imagegen') {
        setImagegenPresetJson(presetStr);
      }
    } catch (e: any) {
      setError('导入preset失败: ' + (e?.message || e));
    }
  };

  const handleImportWorldBook = async () => {
    setError('');
    try {
      const file = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (file.canceled || !file.assets?.[0]?.uri) return;
      const worldBook = await CharacterImporter.importWorldBookOnlyFromJson(file.assets[0].uri);
      const worldBookStr = JSON.stringify(worldBook, null, 2);
      if (activeTab === 'autoMessage') {
        setWorldBookJson(worldBookStr);
      } else if (activeTab === 'memorySummary') {
        setMemoryWorldBookJson(worldBookStr);
      } else if (activeTab === 'imagegen') {
        setImagegenWorldBookJson(worldBookStr);
      }
    } catch (e: any) {
      setError('导入worldbook失败: ' + (e?.message || e));
    }
  };

  const handleClearPreset = () => {
    setError('');
    if (activeTab === 'autoMessage') {
      setPresetJson('');
    } else if (activeTab === 'memorySummary') {
      setMemoryPresetJson('');
    } else if (activeTab === 'imagegen') {
      setImagegenPresetJson('');
    }
    Alert.alert('已清空', 'Preset已清空，现在可以只使用输入文本生成消息数组');
  };

  const handleClearWorldBook = () => {
    setError('');
    if (activeTab === 'autoMessage') {
      setWorldBookJson('');
    } else if (activeTab === 'memorySummary') {
      setMemoryWorldBookJson('');
    } else if (activeTab === 'imagegen') {
      setImagegenWorldBookJson('');
    }
    Alert.alert('已清空', 'WorldBook已清空，现在可以只使用输入文本生成消息数组');
  };

  const handleGenerateMessageArray = async () => {
    setError('');
    setIsLoading(true);
    try {
      let currentPreset = '', currentInput = '', currentAdapter: 'gemini' | 'openrouter' | 'openai-compatible' = 'gemini', currentWorldBook = '';
      if (activeTab === 'autoMessage') {
        currentPreset = presetJson;
        currentInput = inputText;
        currentAdapter = adapterType;
        currentWorldBook = worldBookJson;
      } else if (activeTab === 'memorySummary') {
        currentPreset = memoryPresetJson;
        currentInput = memoryInputText;
        currentAdapter = memoryAdapterType;
        currentWorldBook = memoryWorldBookJson;
      } else if (activeTab === 'imagegen') {
        currentPreset = imagegenPresetJson;
        currentInput = imagegenInputText;
        currentAdapter = imagegenAdapterType;
        currentWorldBook = imagegenWorldBookJson;
      }

      // If we only have inputText, create a simple message array with just the input
      if (!currentPreset) {
        const simpleArray = [{
          role: currentAdapter === 'gemini' ? 'user' : 'user',
          ...(currentAdapter === 'gemini' || currentAdapter === 'openrouter' 
            ? { parts: [{ text: currentInput }] } 
            : { content: currentInput })
        }];
        
        if (activeTab === 'autoMessage') {
          setMessageArray(simpleArray);
        } else if (activeTab === 'memorySummary') {
          setMemoryMessageArray(simpleArray);
        } else if (activeTab === 'imagegen') {
          setImagegenMessageArray(simpleArray);
        }
        setIsLoading(false);
        return;
      }

      // If we have preset, use NodeSTCore.buildRFrameworkWithChatHistory
      const arr = await NodeSTCore.buildRFrameworkWithChatHistory(
        currentInput,
        currentPreset,
        currentAdapter,
        currentWorldBook || undefined
      );
      
      if (activeTab === 'autoMessage') {
        setMessageArray(arr);
      } else if (activeTab === 'memorySummary') {
        setMemoryMessageArray(arr);
      } else if (activeTab === 'imagegen') {
        setImagegenMessageArray(arr);
      }
    } catch (e: any) {
      setError('生成消息数组失败: ' + (e?.message || e));
    } finally {
      setIsLoading(false);
    }
  };

  const handleApiTest = async () => {
    setError('');
    setApiResponse('');
    setApiLoading(true);
    try {
      let currentMessageArray;
      if (activeTab === 'autoMessage') {
        currentMessageArray = messageArray;
      } else if (activeTab === 'memorySummary') {
        currentMessageArray = memoryMessageArray;
      } else if (activeTab === 'imagegen') {
        currentMessageArray = imagegenMessageArray;
      }
      if (!currentMessageArray || currentMessageArray.length === 0) {
        setError('请先生成消息数组');
        setApiLoading(false);
        return;
      }
      
      // 不再手动指定adapter，让unifiedGenerateContent从设置中自动确定
      const options = {}; // 空对象，让函数自动从设置获取所有配置
      const resp = await unifiedGenerateContent(currentMessageArray, options);
      setApiResponse(typeof resp === 'string' ? resp : JSON.stringify(resp));
    } catch (e: any) {
      setError('API测试失败: ' + (e?.message || e));
    }
    setApiLoading(false);
  };

  const showViewModal = useCallback((content: string, title: string) => {
    setViewModalContent(content);
    setViewModalTitle(title);
    setViewModalVisible(true);
  }, []);

  const renderAutoMessageTab = () => {
    const hasMessageArray = messageArray && messageArray.length > 0;
    const hasPreset = !!presetJson;
    const hasWorldBook = !!worldBookJson;
    
    return (
      <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>自动消息提示词</Text>
            <View style={styles.sectionButtonBar}>
              <TouchableOpacity 
                style={styles.sectionButton} 
                onPress={handleImportPreset}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="document-outline" size={18} color={theme.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.sectionButton} 
                onPress={handleImportWorldBook}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="book-outline" size={18} color={theme.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.sectionButton, !presetJson && styles.disabledButton]} 
                onPress={handleClearPreset}
                disabled={!presetJson}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={18} color={!presetJson ? '#666' : '#e74c3c'} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.sectionButton, !worldBookJson && styles.disabledButton]} 
                onPress={handleClearWorldBook}
                disabled={!worldBookJson}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle-outline" size={18} color={!worldBookJson ? '#666' : '#e74c3c'} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.sectionButton, isLoading && styles.disabledButton]} 
                onPress={handleGenerateMessageArray}
                disabled={isLoading}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="code-outline" size={18} color={isLoading ? '#666' : '#27ae60'} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sectionButton, (apiLoading || !hasMessageArray) && styles.disabledButton]}
                onPress={handleApiTest}
                disabled={apiLoading || !hasMessageArray}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="flash-outline" size={18} color={(apiLoading || !hasMessageArray) ? '#666' : '#e67e22'} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.contentSection}>
            <Text style={styles.inputLabel}>指令</Text>
            <Text style={styles.helperText}>
              此指令将作为隐藏的用户消息发送给AI，不会在聊天界面显示
            </Text>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="请输入自动消息生成指令"
              placeholderTextColor="#999"
              multiline
            />

            <Text style={styles.helperText}>
              你可以只输入指令文本生成简单消息数组，或导入preset和worldbook生成完整消息数组
            </Text>

            <Text style={styles.inputLabel}>自动消息发送间隔（分钟）</Text>
            <TextInput
              style={[styles.input, { minHeight: 50 }]}
              value={autoMessageInterval.toString()}
              onChangeText={text => {
                const num = parseInt(text) || 1;
                setAutoMessageInterval(num);
              }}
              placeholder="5"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />

            {/* <View style={styles.statusSection}>
              <View style={styles.statusItem}>
                <Text style={styles.statusLabel}>当前适配器</Text>
                <View style={styles.adapterBadge}>
                  <Text style={styles.adapterBadgeText}>{adapterType}</Text>
                </View>
              </View>

              <View style={styles.row}>
                <TouchableOpacity 
                  style={[styles.viewButton, !hasPreset && styles.disabledButton]} 
                  onPress={() => hasPreset && showViewModal(presetJson, 'Preset内容')}
                  disabled={!hasPreset}
                >
                  <Ionicons name="eye-outline" size={18} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.viewButtonText}>查看Preset{!hasPreset ? ' (可选)' : ''}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.viewButton, !hasWorldBook && styles.disabledButton]} 
                  onPress={() => hasWorldBook && showViewModal(worldBookJson, 'WorldBook内容')}
                  disabled={!hasWorldBook}
                >
                  <Ionicons name="eye-outline" size={18} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.viewButtonText}>查看WorldBook{!hasWorldBook ? ' (可选)' : ''}</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.row}>
                <TouchableOpacity 
                  style={[styles.viewButton, !hasMessageArray && styles.disabledButton]} 
                  onPress={() => hasMessageArray && showViewModal(JSON.stringify(messageArray, null, 2), '消息数组内容')}
                  disabled={!hasMessageArray}
                >
                  <Ionicons name="list-outline" size={18} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.viewButtonText}>查看消息数组</Text>
                </TouchableOpacity>
              </View>
            </View> */}

            <TouchableOpacity style={styles.saveButton} onPress={saveConfig}>
              <Ionicons name="save-outline" size={18} color="black" style={styles.buttonIcon} />
              <Text style={styles.saveButtonText}>保存配置</Text>
            </TouchableOpacity>

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={18} color="#f44336" style={styles.buttonIcon} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {apiResponse ? (
              <View style={styles.apiResponseContainer}>
                <Text style={styles.apiResponseTitle}>API响应</Text>
                <ScrollView style={styles.apiResponseContent}>
                  <Text selectable style={styles.apiResponseText}>{apiResponse}</Text>
                </ScrollView>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderMemorySummaryTab = () => {
    const hasMessageArray = memoryMessageArray && memoryMessageArray.length > 0;
    const hasPreset = !!memoryPresetJson;
    const hasWorldBook = !!memoryWorldBookJson;
    
    return (
      <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>记忆总结提示词</Text>
            <View style={styles.sectionButtonBar}>
              <TouchableOpacity 
                style={styles.sectionButton} 
                onPress={handleImportPreset}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="document-outline" size={18} color={theme.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.sectionButton} 
                onPress={handleImportWorldBook}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="book-outline" size={18} color={theme.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.sectionButton, !memoryPresetJson && styles.disabledButton]} 
                onPress={handleClearPreset}
                disabled={!memoryPresetJson}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={18} color={!memoryPresetJson ? '#666' : '#e74c3c'} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.sectionButton, !memoryWorldBookJson && styles.disabledButton]} 
                onPress={handleClearWorldBook}
                disabled={!memoryWorldBookJson}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle-outline" size={18} color={!memoryWorldBookJson ? '#666' : '#e74c3c'} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.sectionButton, isLoading && styles.disabledButton]} 
                onPress={handleGenerateMessageArray}
                disabled={isLoading}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="code-outline" size={18} color={isLoading ? '#666' : '#27ae60'} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sectionButton, (apiLoading || !hasMessageArray) && styles.disabledButton]}
                onPress={handleApiTest}
                disabled={apiLoading || !hasMessageArray}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="flash-outline" size={18} color={(apiLoading || !hasMessageArray) ? '#666' : '#e67e22'} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.contentSection}>
            <Text style={styles.inputLabel}>指令</Text>
            <TextInput
              style={styles.input}
              value={memoryInputText}
              onChangeText={setMemoryInputText}
              placeholder="请输入记忆总结生成指令"
              placeholderTextColor="#999"
              multiline
            />

            <Text style={styles.helperText}>
              你可以只输入指令文本生成简单消息数组，或导入preset和worldbook生成完整消息数组
            </Text>

            <Text style={styles.sectionSubtitle}>记忆服务设置</Text>
            
            <Text style={styles.inputLabel}>总结阈值（字符数）</Text>
            <TextInput
              style={[styles.input, { minHeight: 50 }]}
              value={memorySummaryThreshold.toString()}
              onChangeText={(text) => {
                const num = parseInt(text) || 0;
                setMemorySummaryThreshold(num);
              }}
              placeholder="6000"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>总结长度（字符数）</Text>
            <TextInput
              style={[styles.input, { minHeight: 50 }]}
              value={memorySummaryLength.toString()}
              onChangeText={(text) => {
                const num = parseInt(text) || 0;
                setMemorySummaryLength(num);
              }}
              placeholder="1000"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />

            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>启用自定义总结区间</Text>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  memorySummaryRangeEnabled && styles.toggleButtonActive
                ]}
                onPress={() => setMemorySummaryRangeEnabled(!memorySummaryRangeEnabled)}
              >
                <Text style={[
                  styles.toggleButtonText,
                  memorySummaryRangeEnabled && styles.toggleButtonTextActive
                ]}>
                  {memorySummaryRangeEnabled ? "已启用" : "未启用"}
                </Text>
              </TouchableOpacity>
            </View>

            {memorySummaryRangeEnabled && (
              <View>
                <Text style={styles.inputLabel}>总结区间起始索引</Text>
                <TextInput
                  style={[styles.input, { minHeight: 50 }]}
                  value={memorySummaryRangeStart.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 0;
                    setMemorySummaryRangeStart(num);
                  }}
                  placeholder="3"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />

                <Text style={styles.inputLabel}>总结区间结束索引</Text>
                <TextInput
                  style={[styles.input, { minHeight: 50 }]}
                  value={memorySummaryRangeEnd.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 0;
                    setMemorySummaryRangeEnd(num);
                  }}
                  placeholder="10"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
                
                <Text style={styles.helperText}>
                  区间为 [{memorySummaryRangeStart}, {memorySummaryRangeEnd}]，将总结第{memorySummaryRangeStart + 1}到第{memorySummaryRangeEnd + 1}条消息
                </Text>
              </View>
            )}

            {/* <View style={styles.statusSection}>
              <View style={styles.statusItem}>
                <Text style={styles.statusLabel}>当前适配器</Text>
                <View style={styles.adapterBadge}>
                  <Text style={styles.adapterBadgeText}>{memoryAdapterType}</Text>
                </View>
              </View>

              <View style={styles.row}>
                <TouchableOpacity 
                  style={[styles.viewButton, !hasPreset && styles.disabledButton]} 
                  onPress={() => hasPreset && showViewModal(memoryPresetJson, 'Preset内容')}
                  disabled={!hasPreset}
                >
                  <Ionicons name="eye-outline" size={18} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.viewButtonText}>查看Preset{!hasPreset ? ' (可选)' : ''}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.viewButton, !hasWorldBook && styles.disabledButton]} 
                  onPress={() => hasWorldBook && showViewModal(memoryWorldBookJson, 'WorldBook内容')}
                  disabled={!hasWorldBook}
                >
                  <Ionicons name="eye-outline" size={18} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.viewButtonText}>查看WorldBook{!hasWorldBook ? ' (可选)' : ''}</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.row}>
                <TouchableOpacity 
                  style={[styles.viewButton, !hasMessageArray && styles.disabledButton]} 
                  onPress={() => hasMessageArray && showViewModal(JSON.stringify(memoryMessageArray, null, 2), '消息数组内容')}
                  disabled={!hasMessageArray}
                >
                  <Ionicons name="list-outline" size={18} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.viewButtonText}>查看消息数组</Text>
                </TouchableOpacity>
              </View>
            </View> */}

            <TouchableOpacity style={styles.saveButton} onPress={saveConfig}>
              <Ionicons name="save-outline" size={18} color="black" style={styles.buttonIcon} />
              <Text style={styles.saveButtonText}>保存配置</Text>
            </TouchableOpacity>

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={18} color="#f44336" style={styles.buttonIcon} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {apiResponse ? (
              <View style={styles.apiResponseContainer}>
                <Text style={styles.apiResponseTitle}>API响应</Text>
                <ScrollView style={styles.apiResponseContent}>
                  <Text selectable style={styles.apiResponseText}>{apiResponse}</Text>
                </ScrollView>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderImagegenTab = () => {
    const hasMessageArray = imagegenMessageArray && imagegenMessageArray.length > 0;
    const hasPreset = !!imagegenPresetJson;
    const hasWorldBook = !!imagegenWorldBookJson;
    
    return (
      <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>图像生成提示词</Text>
            <View style={styles.sectionButtonBar}>
              <TouchableOpacity 
                style={styles.sectionButton} 
                onPress={handleImportPreset}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="document-outline" size={18} color={theme.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.sectionButton} 
                onPress={handleImportWorldBook}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="book-outline" size={18} color={theme.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.sectionButton, !imagegenPresetJson && styles.disabledButton]} 
                onPress={handleClearPreset}
                disabled={!imagegenPresetJson}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={18} color={!imagegenPresetJson ? '#666' : '#e74c3c'} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.sectionButton, !imagegenWorldBookJson && styles.disabledButton]} 
                onPress={handleClearWorldBook}
                disabled={!imagegenWorldBookJson}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle-outline" size={18} color={!imagegenWorldBookJson ? '#666' : '#e74c3c'} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.sectionButton, isLoading && styles.disabledButton]} 
                onPress={handleGenerateMessageArray}
                disabled={isLoading}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="code-outline" size={18} color={isLoading ? '#666' : '#27ae60'} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sectionButton, (apiLoading || !hasMessageArray) && styles.disabledButton]}
                onPress={handleApiTest}
                disabled={apiLoading || !hasMessageArray}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="flash-outline" size={18} color={(apiLoading || !hasMessageArray) ? '#666' : '#e67e22'} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.contentSection}>
            <Text style={styles.inputLabel}>指令</Text>
            <TextInput
              style={styles.input}
              value={imagegenInputText}
              onChangeText={setImagegenInputText}
              placeholder="请输入图像生成提示词指令"
              placeholderTextColor="#999"
              multiline
            />

            <Text style={styles.helperText}>
              你可以只输入指令文本生成简单消息数组，或导入preset和worldbook生成完整消息数组
            </Text>
{/* 
            <View style={styles.statusSection}>
              <View style={styles.statusItem}>
                <Text style={styles.statusLabel}>当前适配器</Text>
                <View style={styles.adapterBadge}>
                  <Text style={styles.adapterBadgeText}>{imagegenAdapterType}</Text>
                </View>
              </View>

              <View style={styles.row}>
                <TouchableOpacity 
                  style={[styles.viewButton, !hasPreset && styles.disabledButton]} 
                  onPress={() => hasPreset && showViewModal(imagegenPresetJson, 'Preset内容')}
                  disabled={!hasPreset}
                >
                  <Ionicons name="eye-outline" size={18} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.viewButtonText}>查看Preset{!hasPreset ? ' (可选)' : ''}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.viewButton, !hasWorldBook && styles.disabledButton]} 
                  onPress={() => hasWorldBook && showViewModal(imagegenWorldBookJson, 'WorldBook内容')}
                  disabled={!hasWorldBook}
                >
                  <Ionicons name="eye-outline" size={18} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.viewButtonText}>查看WorldBook{!hasWorldBook ? ' (可选)' : ''}</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.row}>
                <TouchableOpacity 
                  style={[styles.viewButton, !hasMessageArray && styles.disabledButton]} 
                  onPress={() => hasMessageArray && showViewModal(JSON.stringify(imagegenMessageArray, null, 2), '消息数组内容')}
                  disabled={!hasMessageArray}
                >
                  <Ionicons name="list-outline" size={18} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.viewButtonText}>查看消息数组</Text>
                </TouchableOpacity>
              </View>
            </View> */}

            <TouchableOpacity style={styles.saveButton} onPress={saveConfig}>
              <Ionicons name="save-outline" size={18} color="black" style={styles.buttonIcon} />
              <Text style={styles.saveButtonText}>保存配置</Text>
            </TouchableOpacity>

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={18} color="#f44336" style={styles.buttonIcon} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {apiResponse ? (
              <View style={styles.apiResponseContainer}>
                <Text style={styles.apiResponseTitle}>API响应</Text>
                <ScrollView style={styles.apiResponseContent}>
                  <Text selectable style={styles.apiResponseText}>{apiResponse}</Text>
                </ScrollView>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>工具提示词设置</Text>
      </View>
      
      {/* Tab Navigation */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'autoMessage' && styles.activeTab]}
          onPress={() => setActiveTab('autoMessage')}
        >
          <Text style={[styles.tabText, activeTab === 'autoMessage' && styles.activeTabText]}>
            自动消息
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'memorySummary' && styles.activeTab]}
          onPress={() => setActiveTab('memorySummary')}
        >
          <Text style={[styles.tabText, activeTab === 'memorySummary' && styles.activeTabText]}>
            记忆总结
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'imagegen' && styles.activeTab]}
          onPress={() => setActiveTab('imagegen')}
        >
          <Text style={[styles.tabText, activeTab === 'imagegen' && styles.activeTabText]}>
            图像生成
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <View style={styles.container}>
        {activeTab === 'autoMessage' && renderAutoMessageTab()}
        {activeTab === 'memorySummary' && renderMemorySummaryTab()}
        {activeTab === 'imagegen' && renderImagegenTab()}
      </View>
      
      {/* View Modal */}
      <Modal
        visible={viewModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setViewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{viewModalTitle}</Text>
              <TouchableOpacity onPress={() => setViewModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <Text selectable style={styles.modalContentText}>{viewModalContent}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(40, 40, 40, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  headerTitle: {
    fontSize: Math.max(16, screenWidth * 0.045),
    fontWeight: 'bold',
    color: '#fff',
  },
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(50, 50, 50, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 14,
    color: '#aaa',
  },
  activeTabText: {
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
  tabContent: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
    backgroundColor: 'rgba(60, 60, 60, 0.5)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  sectionHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionButtonBar: {
    flexDirection: 'row',
    flexWrap: 'wrap', // 支持自动换行
    alignItems: 'center',
    gap: 2, // 更紧凑
    maxWidth: 220, // 限制最大宽度，防止溢出
  },
  sectionButton: {
    width: 28, // 更小
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    marginHorizontal: 2,
    marginVertical: 2,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ddd',
    marginTop: 24,
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  contentSection: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#ddd',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: 'rgba(40, 40, 40, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    width: '100%',
    minHeight: 100,
  },
  helperText: {
    fontSize: 12,
    color: '#aaa',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  importButton: {
    backgroundColor: 'rgba(74, 144, 226, 0.8)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    marginBottom: 10,
  },
  importButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  adapterBadge: {
    backgroundColor: 'rgba(255, 158, 205, 0.3)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  adapterBadgeText: {
    color: theme.colors.primary,
    fontWeight: 'bold',
    fontSize: 13,
  },
  statusSection: {
    marginTop: 20,
    padding: 12,
    backgroundColor: 'rgba(40, 40, 40, 0.5)',
    borderRadius: 8,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusLabel: {
    color: '#bbb',
    fontSize: 14,
  },
  viewButton: {
    backgroundColor: 'rgba(100, 100, 100, 0.7)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    marginBottom: 10,
    flex: 1,
    justifyContent: 'center',
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 13,
  },
  actionButton: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  generateButton: {
    backgroundColor: '#27ae60',
    marginRight: 8,
  },
  testButton: {
    backgroundColor: '#e67e22',
    marginLeft: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: 'black',
    fontWeight: 'bold',
    fontSize: 15,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  errorText: {
    color: '#f44336',
    flex: 1,
  },
  apiResponseContainer: {
    marginTop: 20,
    backgroundColor: 'rgba(40, 40, 40, 0.7)',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  apiResponseTitle: {
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  apiResponseContent: {
    maxHeight: 150,
  },
  apiResponseText: {
    color: '#ddd',
    fontSize: 13,
  },
  buttonIcon: {
    marginRight: 6,
  },
  disabledButton: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: 'rgba(40, 40, 40, 0.95)',
    width: '100%',
    maxHeight: '80%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'rgba(60, 60, 60, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalContent: {
    padding: 16,
  },
  modalContentText: {
    color: '#ddd',
    fontSize: 14,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  switchLabel: {
    fontSize: 14,
    color: '#ddd',
  },
  toggleButton: {
    backgroundColor: 'rgba(40, 40, 40, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  toggleButtonActive: {
    backgroundColor: 'rgba(255, 158, 205, 0.3)',
    borderColor: theme.colors.primary,
  },
  toggleButtonText: {
    color: '#aaa',
    fontSize: 13,
  },
  toggleButtonTextActive: {
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
  clearButton: {
    backgroundColor: 'rgba(231, 76, 60, 0.8)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    marginBottom: 10,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 13,
  },
});
