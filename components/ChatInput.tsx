import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  Animated,
  Platform,
  Alert,
  Image,
  Modal,
  Text,
  ScrollView,
  TouchableWithoutFeedback,
  Switch,
  ActivityIndicator
} from 'react-native';
import { MaterialIcons, Ionicons, } from '@expo/vector-icons';
import { Character } from '@/shared/types';
import { useUser } from '@/constants/UserContext';
import { useCharacters } from '@/constants/CharactersContext';
import { NodeSTManager } from '@/utils/NodeSTManager';
import { theme } from '@/constants/theme';
import { useRegex } from '@/constants/RegexContext';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { GeminiAdapter } from '@/NodeST/nodest/utils/gemini-adapter';
import Mem0Service from '@/src/memory/services/Mem0Service';
import ImageManager from '@/utils/ImageManager';
import { StorageAdapter } from '@/NodeST/nodest/utils/storage-adapter';
import { updateAuthorNoteDataForCharacter } from '@/app/pages/character-detail'; 
import { InputImagen } from '@/services/InputImagen'; 
import { CloudServiceProvider } from '@/services/cloud-service-provider'; 
import { getApiSettings } from '@/utils/settings-helper'; 
import { TableMemoryService } from '@/services/table-memory-service'; // 新增
import { TableMemory } from '@/src/memory';
import MemoOverlay from './MemoOverlay'; // 新增：引入MemoOverlay
import PostChatService from '@/services/PostChat-service'; // 修正：使用正确的导入路径
import AutoImageService from '@/services/AutoImageService';

interface ChatInputProps {
  onSendMessage: (text: string, sender: 'user' | 'bot', isLoading?: boolean, metadata?: Record<string, any>) => void;
  selectedConversationId: string | null;
  conversationId: string;
  onResetConversation: () => void;
  selectedCharacter: Character;
  braveSearchEnabled?: boolean;
  toggleBraveSearch?: () => void;
  isTtsEnhancerEnabled?: boolean;
  onTtsEnhancerToggle?: () => void;
  onShowNovelAI?: () => void;
  onShowVNDB?: () => void;
  onShowMemoryPanel?: () => void;
  onShowFullHistory?: () => void; // 新增
  onGenerateImage?: (imageId: string, prompt: string) => void; // 新增：生成图片回调
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  selectedConversationId,
  conversationId,
  onResetConversation,
  selectedCharacter,
  braveSearchEnabled = false,
  toggleBraveSearch,
  isTtsEnhancerEnabled = false,
  onTtsEnhancerToggle,
  onShowFullHistory, // 新增
  onGenerateImage, // 新增：生成图片回调
}) => {
  const autoImageService = AutoImageService.getInstance();
  const [text, setText] = useState('');
  const [inputHeight, setInputHeight] = useState(40); // Initial height
  const [isLoading, setIsLoading] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const { user } = useUser();
  const inputRef = useRef<TextInput>(null);
  const { applyRegexTools } = useRegex();
  
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [showImageUrlModal, setShowImageUrlModal] = useState(false);
  const [showImagePreviewModal, setShowImagePreviewModal] = useState(false);
  const [selectedImageType, setSelectedImageType] = useState<string | null>(null);
  
  const [imagePrompt, setImagePrompt] = useState<string>('');
  const [showImageGenModal, setShowImageGenModal] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceImageType, setReferenceImageType] = useState<string | null>(null);
  const [showImageEditGenModal, setShowImageEditGenModal] = useState(false);

  const [showAuthorNoteModal, setShowAuthorNoteModal] = useState(false);
  const [authorNoteInput, setAuthorNoteInput] = useState('');
  const [authorNoteDepth, setAuthorNoteDepth] = useState(0); // 新增
  const [isAuthorNoteSaving, setIsAuthorNoteSaving] = useState(false);
  
  const actionMenuHeight = useRef(new Animated.Value(0)).current;
  const actionMenuOpacity = useRef(new Animated.Value(0)).current;
 // 添加新的状态管理AI场景描述和自定义seed
 const [aiGeneratedPrompt, setAiGeneratedPrompt] = useState<string>('');
 const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
 const [customSeed, setCustomSeed] = useState<string>('');
 const [useSeed, setUseSeed] = useState<boolean>(false);
 const [novelAIConfig, setNovelAIConfig] = useState<any>(null);
 const [allPositiveTags, setAllPositiveTags] = useState<string[]>([]);
 const [isContinuing, setIsContinuing] = useState(false); // 新增：继续说按钮loading状态
 
  // 新增：获取 CharactersContext 方法
  const { clearGeneratedImages, clearAllGeneratedImages } = useCharacters();
 
  // Add this state for custom prompt input
  const [customImagePrompt, setCustomImagePrompt] = useState<string>('');
  const [showCustomImagePromptModal, setShowCustomImagePromptModal] = useState<boolean>(false);
 
  useEffect(() => {
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setShowActions(false);
      }
    );

    return () => {
      keyboardDidHideListener.remove();
    };
  }, []);

  useEffect(() => {
    if (showActions) {
      Animated.parallel([
        Animated.timing(actionMenuHeight, {
          toValue: 350, // Fixed height for all menu items
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(actionMenuOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(actionMenuHeight, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(actionMenuOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [showActions]);

  useEffect(() => {
    // Always set NodeSTManager's search state to match the prop
    NodeSTManager.setSearchEnabled(braveSearchEnabled);
  }, [braveSearchEnabled]);

  const handleEditAuthorNote = () => {
    // 预填当前authorNote内容
    let authorNote = '';
    let injectionDepth = 0;
    try {
      if (selectedCharacter?.jsonData) {
        const json = JSON.parse(selectedCharacter.jsonData);
        authorNote = json.authorNote?.content || '';
        injectionDepth = json.authorNote?.injection_depth || 0;
      }
    } catch {}
    setAuthorNoteInput(authorNote);
    setAuthorNoteDepth(injectionDepth); // 新增
    setShowActions(false);
    setShowAuthorNoteModal(true);
  };

  const handleSaveAuthorNote = async () => {
    if (!selectedCharacter) return;
    setIsAuthorNoteSaving(true);
    try {
      const userNickname = user?.settings?.self.nickname || 'User';
      const result = await updateAuthorNoteDataForCharacter(
        selectedCharacter,
        { content: authorNoteInput, injection_depth: authorNoteDepth }, // 传递 injection_depth
        userNickname
      );
      if (result.success) {
        Alert.alert('成功', '作者注释已更新');
        setShowAuthorNoteModal(false);
      } else {
        Alert.alert('失败', result.error || '更新失败');
      }
    } finally {
      setIsAuthorNoteSaving(false);
    }
  };

  const handleSendPress = async () => {
    if (text.trim() === '') return;
    if (!selectedConversationId) {
      Alert.alert('错误', '请先选择一个角色');
      return;
    }

    const messageToSend = text.trim();
    setText('');
    setIsLoading(true);

    // 立即插入用户消息和 isLoading 消息
    const processedMessage = applyRegexTools(messageToSend, 'user');
    
    try {
      // 先发送用户消息，确保立即显示
      console.log('[ChatInput] 发送用户消息:', processedMessage);
      await onSendMessage(processedMessage, 'user');
      

    } catch (error) {
      console.error('Error sending user message:', error);
    }

    // 新增：获取记忆系统开关状态
    let tableMemoryEnabled = false;
    let vectorMemoryEnabled = false;
    try {
      const settings = await (MemoOverlay as any).getSettings?.();
      if (settings) {
        tableMemoryEnabled = !!settings.tableMemoryEnabled;
        vectorMemoryEnabled = !!settings.vectorMemoryEnabled;
      }
    } catch (e) {
      // 默认不开启
    }

    // 新增：判断 useZhipuEmbedding
    const apiSettings = getApiSettings();
    const useZhipuEmbedding = !!apiSettings.useZhipuEmbedding;

    try {
      const isImageRelated = processedMessage.includes('![') && processedMessage.includes(')');
      // === 记忆系统分支 ===
      let userMemoryAdded = false;
      if (
        selectedCharacter?.id &&
        !isImageRelated &&
        vectorMemoryEnabled &&
        useZhipuEmbedding
      ) {
        // 仅在向量记忆开关和zhipu api都开启时调用Mem0Service
        try {
          console.log('[ChatInput] 尝试检索与用户消息相关的记忆');
          const mem0Service = Mem0Service.getInstance();
          const memoryResults = await mem0Service.searchMemories(
            processedMessage,
            selectedCharacter.id,
            selectedConversationId,
            5
          );
          
          const resultCount = memoryResults?.results?.length || 0;
          if (resultCount > 0) {
            console.log(`[ChatInput] 为用户消息找到 ${resultCount} 条相关记忆:`);
            (memoryResults as any).results.forEach((item: any, index: number) => {
              console.log(`[ChatInput] 记忆 #${index + 1}:`);
              console.log(`  内容: ${item.memory}`);
              console.log(`  相似度: ${item.score}`);
              if (item.metadata?.aiResponse) {
                console.log(`  AI响应: ${item.metadata.aiResponse.substring(0, 100)}${item.metadata.aiResponse.length > 100 ? '...' : ''}`);
              }
            });
          } else {
            console.log('[ChatInput] 未找到相关记忆');
          }
        } catch (searchError) {
          console.warn('[ChatInput] 搜索相关记忆失败:', searchError);
        }
      }

      // === 用户消息添加到向量记忆 ===
      if (
        selectedCharacter?.id &&
        !isImageRelated &&
        vectorMemoryEnabled &&
        useZhipuEmbedding
      ) {
        try {
          const mem0Service = Mem0Service.getInstance();
          await mem0Service.addChatMemory(
            processedMessage,
            'user',
            selectedCharacter.id,
            selectedConversationId
          );
          userMemoryAdded = true;
          console.log('[ChatInput] 用户消息已成功添加到记忆系统的消息缓存');
        } catch (memoryError) {
          console.error('[ChatInput] 添加用户消息到记忆系统失败:', memoryError);
        }
      }
      
      console.log('[ChatInput] 开始同一角色继续对话处理...');
      console.log(`[ChatInput] 用户消息: "${messageToSend}"`);
      console.log(`[ChatInput] 会话ID: ${conversationId}`);
      console.log(`[ChatInput] 角色ID: ${selectedCharacter?.id}`);
      console.log(`[ChatInput] 角色名称: ${selectedCharacter?.name}`);
      console.log(`[ChatInput] API提供商: ${user?.settings?.chat.apiProvider || 'gemini'}`);
      
      const result = await NodeSTManager.processChatMessage({
        userMessage: messageToSend,
        status: '同一角色继续对话',
        conversationId: conversationId,
        apiKey: user?.settings?.chat.characterApiKey || '',
        apiSettings: apiSettings,
        geminiOptions: {
          geminiPrimaryModel: user?.settings?.chat.geminiPrimaryModel,
          geminiBackupModel: user?.settings?.chat.geminiBackupModel,
          retryDelay: user?.settings?.chat.retryDelay,
        },
        character: selectedCharacter,
        characterId: selectedCharacter?.id,
      });

      setIsLoading(false);

      if (result.success) {
        const processedResponse = applyRegexTools(result.text || '抱歉，未收到有效回复。', 'ai');
        console.log('[ChatInput] NodeST处理成功，发送AI回复:', processedResponse.substring(0, 100) + '...');
        await onSendMessage(processedResponse, 'bot'); // 只调用一次

        // === 新增：AI回复后触发自动图片生成 ===
        if (
          selectedCharacter &&
          (selectedCharacter.autoImageEnabled || selectedCharacter.customImageEnabled) &&
          typeof onGenerateImage === 'function'
        ) {
          // 获取当前会话所有消息（假设父组件会同步最新消息）
          // 这里我们只关心最后一条AI回复
          const messages = [
            // 用户消息
            { id: `user-${Date.now()}`, text: processedMessage, sender: 'user', isLoading: false, timestamp: Date.now() },
            // AI回复
            { id: `bot-${Date.now()}`, text: processedResponse, sender: 'bot', isLoading: false, timestamp: Date.now() }
          ];
          // 触发自动图片生成（只针对AI回复）
          await autoImageService.triggerAutoImageGeneration(
            selectedCharacter,
            messages,
            onGenerateImage
          );
        }

        // === 表格记忆服务，仅在表格记忆开关开启时调用 ===
        if (
          selectedCharacter?.id &&
          !isImageRelated &&
          tableMemoryEnabled
        ) {
          (async () => {
            try {
              // 获取最近10条消息
              const recentMessages = await StorageAdapter.getRecentMessages(selectedConversationId, 10);
              // 转换为 TableMemoryService 需要的格式
              const messages = recentMessages
                .map(msg => {
                  let role: 'user' | 'assistant' | undefined;
                  if (msg.role === 'user') role = 'user';
                  else if (msg.role === 'model' || msg.role === 'assistant') role = 'assistant';
                  else return undefined;
                  return {
                    role,
                    content: msg.parts?.[0]?.text || ''
                  };
                })
                .filter(Boolean) as { role: 'user' | 'assistant'; content: string }[];

            // 获取所有表格，构建名称到sheetId映射
            const tableDataResult = await TableMemory.getCharacterTablesData(selectedCharacter.id, selectedConversationId);
            const tableNameToId: Record<string, string> = {};
            if (tableDataResult?.tables?.length) {
              tableDataResult.tables.forEach(tbl => {
                tableNameToId[tbl.name] = tbl.id;
              });
            }

            // 调用表格记忆服务，传递表名到ID映射
            await TableMemoryService.process({
              characterId: selectedCharacter.id,
              conversationId: selectedConversationId,
              messages,
              tableNameToId
            });
            console.log('[ChatInput] 表格记忆服务已异步处理完成');
          } catch (e) {
            console.warn('[ChatInput] 表格记忆服务处理失败:', e);
          }
        })();
        }

        // === AI回复添加到向量记忆 ===
        if (
          userMemoryAdded &&
          selectedCharacter?.id &&
          !isImageRelated &&
          vectorMemoryEnabled &&
          useZhipuEmbedding
        ) {
          try {
            const mem0Service = Mem0Service.getInstance();
            
            if (processedResponse && processedResponse.trim() !== '') {
              await mem0Service.addChatMemory(
                processedResponse,
                'bot',
                selectedCharacter.id,
                selectedConversationId
              );
              console.log('[ChatInput] 成功将AI回复添加到记忆系统缓存');
            } else {
              console.warn('[ChatInput] AI回复为空，跳过添加到记忆系统');
            }
          } catch (memoryError) {
            console.error('[ChatInput] 添加AI回复到记忆系统失败:', memoryError);
          }
        } else if (!userMemoryAdded && vectorMemoryEnabled && useZhipuEmbedding) {
          console.log('[ChatInput] 由于用户消息未成功添加到记忆，跳过添加AI回复');
        }
      } else {
        const errorMessage = '抱歉，处理消息时出现了错误，请重试。';
        onSendMessage(errorMessage, 'bot', false, { 
          isErrorMessage: true, 
          error: result.error || 'Unknown NodeST error' 
        });
        console.error('NodeST error:', result.error);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      onSendMessage('抱歉，发送消息时出现了错误，请重试。', 'bot', false, { 
        isErrorMessage: true, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!selectedConversationId) {
      Alert.alert('错误', '请先选择一个角色');
      return;
    }
    setIsContinuing(true);
    try {
      // 发送"继续"消息，带特殊标记
      await onSendMessage('继续', 'user', false, { isContinue: true });
      

      // 直接复用主流程
      const result = await NodeSTManager.processChatMessage({
        userMessage: '继续',
        status: '同一角色继续对话',
        conversationId: conversationId,
        apiKey: user?.settings?.chat.characterApiKey || '',
        apiSettings: getApiSettings(),
        geminiOptions: {
          geminiPrimaryModel: user?.settings?.chat.geminiPrimaryModel,
          geminiBackupModel: user?.settings?.chat.geminiBackupModel,
          retryDelay: user?.settings?.chat.retryDelay,
        },
        character: selectedCharacter,
        characterId: selectedCharacter?.id,
      });
      if (result.success) {
        const processedResponse = applyRegexTools(result.text || '抱歉，未收到有效回复。', 'ai');
        onSendMessage(processedResponse, 'bot');
      } else {
        onSendMessage('抱歉，处理消息时出现了错误，请重试。', 'bot', false, { 
          isErrorMessage: true, 
          error: result.error || 'Unknown NodeST error' 
        });
      }
    } catch (error) {
      setIsContinuing(false);
      onSendMessage('抱歉，发送消息时出现了错误，请重试。', 'bot', false, { 
        isErrorMessage: true, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    } finally {
      setIsContinuing(false);
    }
  };

  const handleSendImage = async () => {
    if (!selectedConversationId || !selectedImage) {
      return;
    }

    try {
      setIsLoading(true);
      setShowImagePreviewModal(false);
      
      
      const apiKey = user?.settings?.chat.characterApiKey || '';
      
      const geminiAdapter = new GeminiAdapter(apiKey);
      
      // Extract character personality and description from jsonData
      let characterPersonality = '';
      let characterDescription = '';
      
      if (selectedCharacter?.jsonData) {
        try {
          const characterData = JSON.parse(selectedCharacter.jsonData);
          characterPersonality = characterData.roleCard?.personality || '';
          characterDescription = characterData.roleCard?.description || '';
        } catch (e) {
          console.error('[ChatInput] Error parsing character JSON data:', e);
        }
      }
      
      // Get recent messages using StorageAdapter
      let recentMessagesContext = '';
      try {
        if (conversationId) {
          const recentMessages = await StorageAdapter.getRecentMessages(conversationId, 5);
          
          if (recentMessages && recentMessages.length > 0) {
            recentMessagesContext = recentMessages.map(msg => {
              const role = msg.role === 'user' ? '用户' : selectedCharacter.name;
              return `${role}: ${msg.parts?.[0]?.text || ''}`;
            }).join('\n');
          }
        }
      } catch (e) {
        console.error('[ChatInput] Error getting recent messages:', e);
      }
      
      // Build enhanced prompt with character info and recent messages
      const enhancedPrompt = `
这是用户发送的一张图片。请以${selectedCharacter.name}的身份分析并回应这张图片。

角色信息:
姓名: ${selectedCharacter.name}
性格: ${characterPersonality}
简介: ${characterDescription}

${recentMessagesContext ? `最近的对话记录:\n${recentMessagesContext}\n` : ''}

根据以上角色设定和对话历史，分析这张图片并保持角色的语气、性格特点做出回应。
如果图片内容涉及到与角色背景、关系或对话历史相关的内容，请基于角色视角做出更具针对性的回应。
回应应该展现角色的独特风格，就像角色真的在看到并评论这张图片一样。`;
      
      let response: string;
      let imageCacheId: string;
      
      if (selectedImageType === 'url') {
        response = await geminiAdapter.analyzeImage(
          { url: selectedImage },
          enhancedPrompt
        );
        
        try {
          const imageData = await geminiAdapter.fetchImageAsBase64(selectedImage);
          const cacheResult = await ImageManager.cacheImage(imageData.data, imageData.mimeType);
          imageCacheId = cacheResult.id;
        } catch (error) {
          console.error('[ChatInput] Error caching URL image:', error);
          imageCacheId = selectedImage;
        }
      } else {
        let base64Data = selectedImage;
        let mimeType = selectedImageType || 'image/jpeg';
        
        if (selectedImage.includes('base64,')) {
          base64Data = selectedImage.split('base64,')[1];
          mimeType = selectedImage.split(';')[0].replace('data:', '');
        }
        
        const cacheResult = await ImageManager.cacheImage(base64Data, mimeType);
        imageCacheId = cacheResult.id;
        
        response = await geminiAdapter.analyzeImage(
          { 
            data: base64Data,
            mimeType: mimeType
          },
          enhancedPrompt
        );
      }
      
      // 构造图片消息内容
      const imageMessage = `![用户图片](image:${imageCacheId})`;
      
      // 发送用户图片消息到UI
      console.log(`[ChatInput] Sending image message with ID: ${imageCacheId}`);
      await onSendMessage(imageMessage, "user");
      
      // 同时保存到NodeST存储以确保持久化
      try {
        await StorageAdapter.addUserMessage(selectedConversationId, imageMessage);
        console.log(`[ChatInput] Image message saved to NodeST storage`);
      } catch (error) {
        console.error('[ChatInput] Failed to save image message to NodeST:', error);
      }
      
      // 发送loading消息
      setTimeout(() => {
        onSendMessage('正在分析图片...', 'bot', true);
      }, 100);
      
      // 等待一小段时间确保loading消息已显示
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (response) {
        const processedResponse = applyRegexTools(response, 'ai');
        
        // 发送AI回复到UI
        onSendMessage(processedResponse, 'bot');
        
        // 同时保存到NodeST存储以确保持久化
        try {
          await StorageAdapter.addAiMessage(selectedConversationId, processedResponse);
          console.log(`[ChatInput] AI response saved to NodeST storage`);
        } catch (error) {
          console.error('[ChatInput] Failed to save AI response to NodeST:', error);
        }
      } else {
        const errorMessage = '抱歉，无法解析这张图片。';
        onSendMessage(errorMessage, 'bot');
        
        // 保存错误消息到NodeST存储
        try {
          await StorageAdapter.addAiMessage(selectedConversationId, errorMessage);
        } catch (error) {
          console.error('[ChatInput] Failed to save error message to NodeST:', error);
        }
      }
      
      setSelectedImage(null);
      setSelectedImageType(null);
      
    } catch (error) {
      console.error('Error sending image:', error);
      const errorMessage = '抱歉，处理图片时出现了错误，请重试。';
      onSendMessage(errorMessage, 'bot');
      
      // 保存错误消息到NodeST存储
      try {
        await StorageAdapter.addAiMessage(selectedConversationId, errorMessage);
      } catch (storageError) {
        console.error('[ChatInput] Failed to save error message to NodeST:', storageError);
      }
    } finally {
      setIsLoading(false);
      setShowActions(false);
    }
  };



  const handleImageEditOperation = async () => {
    if (!imagePrompt.trim() || !selectedConversationId || !referenceImage) {
      Alert.alert('错误', '请输入有效的编辑指令和提供参考图片');
      return;
    }

    try {
      setIsGeneratingImage(true);
      
      const apiKey = user?.settings?.chat.characterApiKey || '';
      if (!apiKey) {
        throw new Error("API密钥未设置");
      }
      
      const geminiAdapter = new GeminiAdapter(apiKey);
      
      const userMessage = `请将这张图片${imagePrompt}`;
      
      // 发送用户请求到UI
      await onSendMessage(userMessage, "user");
      
      // 同时保存到NodeST存储
      try {
        await StorageAdapter.addUserMessage(selectedConversationId, userMessage);
        console.log(`[ChatInput] Edit request saved to NodeST storage`);
      } catch (error) {
        console.error('[ChatInput] Failed to save edit request to NodeST:', error);
      }
      
      // 发送loading消息
      setTimeout(() => {
        onSendMessage('正在编辑图片...', "bot", true);
      }, 100);
      
      let imageInput;
      if (referenceImageType === 'url') {
        imageInput = { url: referenceImage };
      } else {
        const base64Data = referenceImage!.includes('base64,') 
          ? referenceImage!.split('base64,')[1] 
          : referenceImage;
        
        imageInput = {
          data: base64Data,
          mimeType: referenceImageType || 'image/jpeg'
        };
      }
      
      const editedImage = await geminiAdapter.editImage(imageInput, imagePrompt, {
        temperature: 0.8
      });
      
      if (editedImage) {
        try {
          const cacheResult = await ImageManager.cacheImage(
            editedImage,
            'image/png'
          );
          
          const imageMessage = `![编辑后的图片](image:${cacheResult.id})`;
          
          // 发送AI响应到UI
          onSendMessage(imageMessage, 'bot');
          
          // 同时保存到NodeST存储
          try {
            await StorageAdapter.addAiMessage(selectedConversationId, imageMessage);
            console.log(`[ChatInput] Edited image message saved to NodeST storage`);
          } catch (error) {
            console.error('[ChatInput] Failed to save edited image message to NodeST:', error);
          }
          
          setTimeout(() => {
            Alert.alert(
              '图片已编辑完成',
              '是否保存编辑后的图片到相册？',
              [
                { text: '取消', style: 'cancel' },
                { 
                  text: '保存', 
                  onPress: async () => {
                    const result = await ImageManager.saveToGallery(cacheResult.id);
                    Alert.alert(result.success ? '成功' : '错误', result.message);
                  }
                },
                {
                  text: '分享',
                  onPress: async () => {
                    const shared = await ImageManager.shareImage(cacheResult.id);
                    if (!shared) {
                      Alert.alert('错误', '分享功能不可用');
                    }
                  }
                }
              ]
            );
          }, 500);
        } catch (cacheError) {
          console.error('[ChatInput] Error caching edited image:', cacheError);
          const errorMessage = '图像已编辑，但保存过程中出现错误。';
          onSendMessage(errorMessage, 'bot');
          
          // 保存错误消息到NodeST存储
          try {
            await StorageAdapter.addAiMessage(selectedConversationId, errorMessage);
          } catch (error) {
            console.error('[ChatInput] Failed to save error message to NodeST:', error);
          }
        }
      } else {
        const errorMessage = '抱歉，我无法编辑这张图片。可能是因为编辑指令不够明确，或者模型暂不支持这种编辑操作。';
        onSendMessage(errorMessage, 'bot');
        
        // 保存错误消息到NodeST存储
        try {
          await StorageAdapter.addAiMessage(selectedConversationId, errorMessage);
        } catch (error) {
          console.error('[ChatInput] Failed to save error message to NodeST:', error);
        }
      }
    } catch (error) {
      console.error('Error editing image:', error);
      const errorMessage = '抱歉，编辑图片时出现了错误，请重试。';
      onSendMessage(errorMessage, 'bot');
      
      // 保存错误消息到NodeST存储
      try {
        await StorageAdapter.addAiMessage(selectedConversationId, errorMessage);
      } catch (storageError) {
        console.error('[ChatInput] Failed to save error message to NodeST:', storageError);
      }
    } finally {
      setIsGeneratingImage(false);
      setShowImageEditGenModal(false);
      setImagePrompt('');
      setReferenceImage(null);
      setReferenceImageType(null);
    }
  };

  const handleManageImageCache = async () => {
    try {
      const cacheInfo = await ImageManager.getCacheInfo();
      
      const sizeMB = (cacheInfo.totalSize / (1024 * 1024)).toFixed(2);
      
      Alert.alert(
        '图片缓存管理',
        `当前缓存了 ${cacheInfo.count} 张图片，占用 ${sizeMB} MB 存储空间。${
          cacheInfo.oldestImage ? `\n最早的图片缓存于 ${cacheInfo.oldestImage.toLocaleDateString()}` : ''
        }`,
        [
          { text: '取消', style: 'cancel' },
          { 
            text: '清空当前会话图片', 
            onPress: async () => {
              if (selectedConversationId) {
                // 清空当前会话的生成图片缓存
                await clearGeneratedImages(selectedConversationId);
                Alert.alert('成功', '已清空当前会话的生成图片缓存');
              } else {
                Alert.alert('错误', '没有选择会话');
              }
            }
          },
          { 
            text: '清空所有缓存', 
            style: 'destructive',
            onPress: async () => {
              // 清空图片文件缓存
              const result = await ImageManager.clearCache();
              
              // 清空生成图片记录缓存
              await clearAllGeneratedImages();
              
              Alert.alert(
                result.success ? '成功' : '错误', 
                result.success ? '已清空所有图片缓存和生成图片记录' : result.message
              );
            }
          }
        ]
      );
    } catch (error) {
      console.error('[ChatInput] Error managing cache:', error);
      Alert.alert('错误', '获取缓存信息失败');
    }
  };

  const toggleActionMenu = () => {
    Keyboard.dismiss();
    setShowActions(!showActions);
  };

  const handleResetConversation = () => {
    Alert.alert(
      '确定要重置对话吗？',
      '这将清除所有对话历史记录、生成的图片和图片缓存，但保留角色的开场白。',
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '重置', 
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              
              if (!selectedConversationId) {
                Alert.alert('错误', '请先选择一个角色');
                return;
              }
              
              const apiKey = user?.settings?.chat.characterApiKey || '';

              console.log('[ChatInput] Resetting conversation:', selectedConversationId);

              // 清空当前会话的生成图片缓存
              await clearGeneratedImages(selectedConversationId);
              
              // 清空图片文件缓存
              await ImageManager.clearCache();
              
              console.log('[ChatInput] Cleared generated images and image cache');

              const success = await NodeSTManager.resetChatHistory(conversationId);
              
              if (success) {
                console.log('[ChatInput] Chat history reset successful');
                // Call parent's reset function to handle message cleanup
                onResetConversation();
              } else {
                console.error('[ChatInput] Failed to reset chat history');
                Alert.alert('错误', '重置对话失败，请重试');
              }
              
              setShowActions(false);
            } catch (error) {
              console.error('[ChatInput] Error during conversation reset:', error);
              Alert.alert('错误', '重置对话时出现错误');
            } finally {
              setIsLoading(false);
            }
          }
        },
      ]
    );
  };

  const openImageOptions = () => {
    setShowActions(false);
    Alert.alert(
      '选择图片来源',
      '请选择如何添加图片',
      [
        {
          text: '拍摄照片',
          onPress: captureImage
        },
        {
          text: '从相册选择',
          onPress: pickImage
        },
        {
          text: '输入图片URL',
          onPress: () => setShowImageUrlModal(true)
        },
        {
          text: '取消',
          style: 'cancel'
        }
      ]
    );
  };

  const captureImage = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('需要权限', '需要相机访问权限才能拍摄照片。');
      return;
    }
    
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        
        const manipResult = await manipulateAsync(
          selectedAsset.uri,
          [{ resize: { width: 1024 } }],
          { compress: 0.8, format: SaveFormat.JPEG, base64: true }
        );
        
        setSelectedImage(`data:image/jpeg;base64,${manipResult.base64}`);
        setSelectedImageType('image/jpeg');
        setShowImagePreviewModal(true);
      }
    } catch (error) {
      console.error('Error capturing image:', error);
      Alert.alert('错误', '拍摄照片时出现错误，请重试。');
    }
  };

  const pickImage = async () => {
    setShowActions(false);
    
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('需要权限', '需要照片库访问权限才能选择图片。');
      return;
    }
    
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        
        const manipResult = await manipulateAsync(
          selectedAsset.uri,
          [{ resize: { width: 1024 } }],
          { compress: 0.8, format: SaveFormat.JPEG, base64: true }
        );
        
        setSelectedImage(`data:image/jpeg;base64,${manipResult.base64}`);
        setSelectedImageType('image/jpeg');
        setShowImagePreviewModal(true);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('错误', '选择图片时出现错误，请重试。');
    }
  };


  const handleImageUrlSubmit = () => {
    if (imageUrl.trim()) {
      setSelectedImage(imageUrl.trim());
      setSelectedImageType('url');
      setShowImageUrlModal(false);
      setShowImagePreviewModal(true);
    } else {
      Alert.alert('错误', '请输入有效的图片URL');
    }
  };

  const openImageGenModal = () => {
    setShowActions(false);
    
    // 从角色读取NovelAI配置
    if (selectedCharacter) {
      const config = InputImagen.getNovelAIConfig(selectedCharacter);
      setNovelAIConfig(config);
      
      // 展示所有正向提示词
      // InputImagen.getNovelAIConfig 已合并所有正向提示词
      setAllPositiveTags(config.positiveTags);

      // 设置初始seed值
      if (config.seed !== undefined) {
        setCustomSeed(config.seed.toString());
        setUseSeed(true);
      } else {
        setCustomSeed(Math.floor(Math.random() * 2 ** 32).toString());
        setUseSeed(false);
      }
    }
    
    // 重置其他状态
    setAiGeneratedPrompt('');
    setImagePrompt('');
    setShowImageGenModal(true);
  };

  // 添加新函数：生成AI场景描述
  const handleGenerateAIPrompt = async () => {
    if (!selectedCharacter?.id) {
      Alert.alert('错误', '请先选择一个角色');
      return;
    }
    
    try {
      setIsGeneratingPrompt(true);
      const sceneDescription = await InputImagen.generateSceneDescription(selectedCharacter.id);
      
      if (sceneDescription) {
        setAiGeneratedPrompt(sceneDescription);
        // 将AI生成的提示词添加到当前提示词的末尾，而不是替换
        setImagePrompt(prev => {
          const currentPrompt = prev.trim();
          if (currentPrompt) {
            return currentPrompt + ', ' + sceneDescription;
          } else {
            return sceneDescription;
          }
        });
      } else {
        Alert.alert('提示', '无法生成场景描述，请手动输入提示词');
      }
    } catch (e) {
      console.error('[ChatInput] Error generating scene description:', e);
      Alert.alert('错误', '生成场景描述失败，请手动输入提示词');
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  // 生成随机种子
  const generateRandomSeed = () => {
    const randomSeed = Math.floor(Math.random() * 2 ** 32);
    setCustomSeed(randomSeed.toString());
  };



  // 修改图片生成方法，使用专门的回调而不是消息流
  const handleImageGeneration = async () => {
    if (!selectedConversationId) {
      Alert.alert('错误', '请先选择一个角色');
      return;
    }

    try {
      setIsGeneratingImage(true);
      
      // 准备生成参数
      const userCustomSeed = useSeed && customSeed ? parseInt(customSeed, 10) : undefined;
      console.log('[ChatInput] Generating image with seed:', userCustomSeed);

      const result = await InputImagen.generateImage(
        novelAIConfig,
        imagePrompt,
        userCustomSeed
      );

      if (result.success && result.imageId) {
        try {
          console.log(`[ChatInput] Image generated successfully with ID: ${result.imageId}`);

          // 使用新的回调函数而不是发送消息
          if (onGenerateImage) {
            onGenerateImage(result.imageId, imagePrompt);
          }

          setTimeout(() => {
            setShowImageGenModal(false);
            setImagePrompt('');
            setAiGeneratedPrompt('');
          }, 500);
        } catch (displayError) {
          console.error('[ChatInput] Error displaying generated image:', displayError);
          Alert.alert('错误', '图像已生成，但显示过程中出现错误。');
        }
      } else {
        Alert.alert('错误', `生成图片失败: ${result.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('Error generating image:', error);
      Alert.alert('错误', '生成图片时出现了错误，请重试。');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const pickReferenceImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('需要权限', '需要照片库访问权限才能选择图片。');
      return;
    }
    
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        
        const manipResult = await manipulateAsync(
          selectedAsset.uri,
          [{ resize: { width: 1024 } }],
          { compress: 0.8, format: SaveFormat.JPEG, base64: true }
        );
        
        setReferenceImage(`data:image/jpeg;base64,${manipResult.base64}`);
        setReferenceImageType('image/jpeg');
      }
    } catch (error) {
      console.error('Error picking reference image:', error);
      Alert.alert('错误', '选择参考图片时出现错误，请重试。');
    }
  };
  
  const handleBraveSearchToggle = () => {
    setShowActions(false);
    if (toggleBraveSearch) {
      toggleBraveSearch();
    }
  };
  
  const handleTtsEnhancerToggle = () => {
    setShowActions(false);
    if (onTtsEnhancerToggle) {
      onTtsEnhancerToggle();
    }
  };

  const handleShowFullHistory = () => {
    setShowActions(false);
    if (onShowFullHistory) onShowFullHistory();
  };

  // Add function to handle content size change
  const handleContentSizeChange = (event: any) => {
    const { height } = event.nativeEvent.contentSize;
    // Calculate the new height, capped at approximately 5 lines of text
    // Line height is roughly 20-24px, so 5 lines would be ~100-120px
    const newHeight = Math.min(Math.max(40, height), 120);
    setInputHeight(newHeight);
  };

  // Add the new method after handleImageGeneration
  const handleAutoGenerateImage = async () => {
    if (!selectedConversationId || !selectedCharacter) {
      Alert.alert('错误', '请先选择一个角色');
      return;
    }

    try {
      setShowActions(false);
      setIsGeneratingImage(true);
      
      // Show generating indicator to the user
      Alert.alert('提示', '正在自动生成场景图片，请稍候...');
      
      // Options for auto generation
      const hasNovelAIBackground = selectedCharacter.backgroundImageConfig?.isNovelAI === true;
      const options = {
        // Use background config if available, otherwise use flexible mode
        useBackgroundConfig: hasNovelAIBackground,
        // We don't pass custom prompt or seed here since we're using completely automatic generation
      };
      
      console.log('[ChatInput] Auto generating image for character:', selectedCharacter.name);
      console.log('[ChatInput] Using background config:', hasNovelAIBackground);
      
      // Call the autoGenerateImage method with options
      const result = await PostChatService.getInstance().autoGenerateImage(
        selectedCharacter.id,
        conversationId,
        options,
        // The callback will be called if image generation is successful
        (imageId: string, prompt: string) => {
          if (onGenerateImage) {
            onGenerateImage(imageId, prompt);
          }
        }
      );

      if (result.success) {
        console.log(`[ChatInput] Auto image generated successfully with ID: ${result.imageId}`);
        Alert.alert('成功', '已自动生成场景图片');
      } else {
        Alert.alert('错误', `生成图片失败: ${result.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('Error auto generating image:', error);
      Alert.alert('错误', '生成图片时出现了错误，请重试。');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Add new method for custom prompt auto generation
  const handleCustomAutoGenerateImage = async () => {
    setShowActions(false);
    setShowCustomImagePromptModal(true);
  };

  // Method to execute custom prompt generation
  const executeCustomAutoGeneration = async () => {
    if (!selectedConversationId || !selectedCharacter) {
      Alert.alert('错误', '请先选择一个角色');
      return;
    }

    try {
      setIsGeneratingImage(true);
      setShowCustomImagePromptModal(false);
      
      // Show generating indicator to the user
      Alert.alert('提示', '正在生成自定义场景图片，请稍候...');
      
      const options = {
        customPrompt: customImagePrompt,
        useBackgroundConfig: false // Use flexible mode for custom prompts
      };
      
      console.log('[ChatInput] Custom auto generating image with prompt:', customImagePrompt);
      
      const result = await PostChatService.getInstance().autoGenerateImage(
        selectedCharacter.id,
        conversationId,
        options,
        (imageId: string, prompt: string) => {
          if (onGenerateImage) {
            onGenerateImage(imageId, prompt);
          }
        }
      );

      if (result.success) {
        console.log(`[ChatInput] Custom auto image generated successfully with ID: ${result.imageId}`);
        Alert.alert('成功', '已生成自定义场景图片');
        // Clear the prompt for next time
        setCustomImagePrompt('');
      } else {
        Alert.alert('错误', `生成图片失败: ${result.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('Error custom auto generating image:', error);
      Alert.alert('错误', '生成图片时出现了错误，请重试。');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <View style={styles.container}>
      {showActions && (
        <View style={styles.actionMenuOverlay}>
          {/* Outer touchable area - closes menu when tapped outside */}
          <TouchableWithoutFeedback onPress={() => setShowActions(false)}>
            <View style={styles.actionMenuBackground} />
          </TouchableWithoutFeedback>
          
          {/* Position the menu directly above the input */}
          <View style={[styles.actionMenuContainer, { minWidth: 180, maxWidth: 260 }]}>
            
            <ScrollView style={styles.actionMenuScroll}>
              <TouchableOpacity 
                style={styles.actionMenuItem}
                activeOpacity={0.7}
                onPress={handleResetConversation}>
                <View style={styles.actionMenuItemInner}>
                  <Ionicons name="refresh" size={18} color="#d9534f" />
                  <Text style={styles.actionMenuItemText}>重置对话</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionMenuItem}
                activeOpacity={0.7}
                onPress={openImageOptions}>
                <View style={styles.actionMenuItemInner}>
                  <Ionicons name="images" size={18} color="#3498db" />
                  <Text style={styles.sendimgText}>发送图片</Text>
                </View>
              </TouchableOpacity>

              {/* Add a section title for image generation
              <View style={styles.actionMenuSectionTitle}>
                <Text style={styles.actionMenuSectionText}>图片生成</Text>
              </View> */}

              <TouchableOpacity 
                style={styles.actionMenuItem}
                activeOpacity={0.7}
                onPress={openImageGenModal}>
                <View style={styles.actionMenuItemInner}>
                  <Ionicons name="brush" size={18} color="#9b59b6" />
                  <Text style={styles.actionMenuItemText}>生成图片</Text>
                </View>
              </TouchableOpacity>

              {/* <TouchableOpacity 
                style={styles.actionMenuItem}
                activeOpacity={0.7}
                onPress={handleAutoGenerateImage}>
                <View style={styles.actionMenuItemInner}>
                  <Ionicons name="image" size={18} color="#2ecc71" />
                  <Text style={styles.actionMenuItemText}>自动生成场景图</Text>
                </View>
              </TouchableOpacity> */}
              
              <TouchableOpacity 
                style={styles.actionMenuItem}
                activeOpacity={0.7}
                onPress={handleCustomAutoGenerateImage}>
                <View style={styles.actionMenuItemInner}>
                  <Ionicons name="create" size={18} color="#2ecc71" />
                  <Text style={styles.actionMenuItemText}>自定义生成场景图</Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionMenuItem}
                activeOpacity={0.7}
                onPress={handleManageImageCache}>
                <View style={styles.actionMenuItemInner}>
                  <Ionicons name="trash-bin" size={18} color="#e74c3c" />
                  <Text style={styles.actionMenuItemText}>图片缓存</Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionMenuItem}
                activeOpacity={0.7}
                onPress={handleBraveSearchToggle}>
                <View style={styles.actionMenuItemInner}>
                  <Ionicons name="search" size={18} color="#3498db" />
                  <Text style={styles.actionMenuItemText}>
                    {braveSearchEnabled ? "搜索: 已开启" : "搜索: 已关闭"}
                  </Text>
                  {braveSearchEnabled && <View style={styles.activeIndicator} />}
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionMenuItem}
                activeOpacity={0.7}
                onPress={handleTtsEnhancerToggle}>
                <View style={styles.actionMenuItemInner}>
                  <Ionicons name="mic" size={18} color="#9b59b6" />
                  <Text style={styles.actionMenuItemText}>
                    {isTtsEnhancerEnabled ? "语音增强: 已开启" : "语音增强: 已关闭"}
                  </Text>
                  {isTtsEnhancerEnabled && <View style={styles.activeIndicator} />}
                </View>
              </TouchableOpacity>  

              <TouchableOpacity 
                style={styles.actionMenuItem}
                activeOpacity={0.7}
                onPress={handleEditAuthorNote}>
                <View style={styles.actionMenuItemInner}>
                  <Ionicons name="document-text-outline" size={18} color="#f39c12" />
                  <Text style={styles.actionMenuItemText}>作者注释</Text>
                </View>
              </TouchableOpacity>  

              <TouchableOpacity
                style={styles.actionMenuItem}
                activeOpacity={0.7}
                onPress={handleShowFullHistory}
              >
                <View style={styles.actionMenuItemInner}>
                  <Ionicons name="list" size={18} color="#27ae60" />
                  <Text style={styles.actionMenuItemText}>查看全部聊天历史</Text>
                </View>
              </TouchableOpacity>        
            </ScrollView>
          </View>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TouchableOpacity
          style={[styles.button, styles.plusButton, showActions && styles.activeButton, styles.smallButton]}
          onPress={toggleActionMenu}
        >
          <MaterialIcons
            name={showActions ? "add" : "add"}
            size={20}
            color={showActions ? theme.colors.primary : theme.colors.primary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.continueButton, styles.smallButton, isContinuing && styles.disabledButton]}
          onPress={handleContinue}
          disabled={isLoading || isContinuing}
        >
          {isContinuing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="play-forward" size={18} color={theme.colors.primary} />
          )}
        </TouchableOpacity>

        <TextInput
          ref={inputRef}
          style={[
            styles.input, 
            { height: inputHeight } // Dynamic height based on content
          ]}
          placeholder="输入消息..."
          placeholderTextColor="#999"
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
          onContentSizeChange={handleContentSizeChange} // Add this handler
          onFocus={() => setShowActions(false)}
        />

        <TouchableOpacity
          style={[styles.button, styles.sendButton, styles.smallButton]}
          onPress={handleSendPress}
          disabled={isLoading || text.trim() === ''}
        >
          {isLoading ? (
            <Ionicons name="ellipsis-horizontal" size={20} color="#777" />
          ) : (
            <MaterialIcons
              name="send"
              size={20}
              color={text.trim() === '' ? '#777' : theme.colors.primary}
            />
          )}
        </TouchableOpacity>
      </View>

      <Modal
        visible={showImageGenModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageGenModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>生成图片</Text>
            
            {novelAIConfig && (
              <View style={styles.configInfoContainer}>
                <Text style={styles.configInfoText}>
                  使用角色设置: {novelAIConfig.model}, {novelAIConfig.sizePreset?.width}x{novelAIConfig.sizePreset?.height}
                </Text>
                {/* 展示正向提示词 */}
                {allPositiveTags && allPositiveTags.length > 0 && (
                  <Text style={[styles.configInfoText, { marginTop: 4, color: '#b3e5fc', fontSize: 12 }]}>
                    正向提示词: {allPositiveTags.join(', ')}
                  </Text>
                )}
              </View>
            )}
            
            <TextInput
              style={[styles.urlInput, {height: 100}]}
              placeholder="描述你想要生成的图片..."
              placeholderTextColor="#999"
              value={imagePrompt}
              onChangeText={setImagePrompt}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            
            <View style={styles.promptActionsContainer}>
              <TouchableOpacity 
                style={[
                  styles.autoPromptButton,
                  isGeneratingPrompt && styles.disabledButton
                ]}
                onPress={handleGenerateAIPrompt}
                disabled={isGeneratingPrompt}
              >
                {isGeneratingPrompt ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={16} color="#fff" style={{marginRight: 5}} />
                    <Text style={styles.autoPromptText}>自动提示词</Text>
                  </>
                )}
              </TouchableOpacity>
              
              {aiGeneratedPrompt ? (
                <Text style={styles.aiPromptText}>
                  AI提示: {aiGeneratedPrompt}
                </Text>
              ) : null}
            </View>
            
            <View style={styles.seedContainer}>
              <View style={styles.seedToggleRow}>
                <Text style={styles.seedLabel}>Seed:</Text>
                <Switch
                  value={useSeed}
                  onValueChange={setUseSeed}
                  trackColor={{ false: "#5a5a5a", true: "#81b0ff" }}
                  thumbColor={useSeed ? "#2196F3" : "#c4c4c4"}
                />
              </View>
              
              {useSeed && (
                <View style={styles.seedInputRow}>
                  <TextInput
                    style={styles.seedInput}
                    placeholder="输入种子值"
                    placeholderTextColor="#999"
                    value={customSeed}
                    onChangeText={setCustomSeed}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity style={styles.randomSeedButton} onPress={generateRandomSeed}>
                    <Ionicons name="dice" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButton} 
                onPress={() => setShowImageGenModal(false)}
              >
                <Text style={styles.modalButtonText}>取消</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.modalButton, 
                  styles.modalButtonPrimary,
                  isGeneratingImage && styles.disabledButton
                ]}
                onPress={handleImageGeneration}
                disabled={isGeneratingImage}
              >
                {isGeneratingImage ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.submitButtonText, { color: 'black' }]}>
                    生成
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showImagePreviewModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImagePreviewModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.imagePreviewContent}>
            <Text style={styles.modalTitle}>预览图片</Text>
            <View style={styles.imagePreviewWrapper}>
              {selectedImage && (
                <Image 
                  source={{ uri: selectedImage }} 
                  style={styles.imagePreview}
                  resizeMode="contain"
                />
              )}
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => setShowImagePreviewModal(false)}
              >
                <Text style={styles.modalButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleSendImage}
                disabled={isLoading}
              >
                <Text style={[styles.modalButtonText, {color: '#fff'}]}>
                  {isLoading ? '处理中...' : '发送图片'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showImageEditGenModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageEditGenModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.imageEditModalContent}>
            <Text style={styles.modalTitle}>图片编辑</Text>
            
            <View style={styles.referenceImageSection}>
              <Text style={styles.modalSubtitle}>参考图片:</Text>
              <View style={styles.referenceImageContainer}>
                {referenceImage ? (
                  <Image 
                    source={{ uri: referenceImage }} 
                    style={styles.referenceImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.noImagePlaceholder}>
                    <Ionicons name="image-outline" size={40} color="#777" />
                    <Text style={styles.placeholderText}>未选择图片</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={[styles.button, styles.selectImageButton]}
                onPress={pickReferenceImage}
              >
                <Ionicons name="add" size={22} color="#fff" />
                <Text style={styles.selectImageButtonText}>
                  {referenceImage ? '更换参考图片' : '选择参考图片'}
                </Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>修改指令:</Text>
            <TextInput
              style={[styles.urlInput, {height: 100}]}
              placeholder="输入编辑指令 (例如：'转换成卡通风格', '改成黄色背景')"
              placeholderTextColor="#999"
              value={imagePrompt}
              onChangeText={setImagePrompt}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => setShowImageEditGenModal(false)}
              >
                <Text style={styles.modalButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.modalButton, 
                  styles.modalButtonPrimary,
                  (!referenceImage || !imagePrompt.trim()) && styles.disabledButton
                ]}
                onPress={handleImageEditOperation}
                disabled={isGeneratingImage || !referenceImage || !imagePrompt.trim()}
              >
                <Text style={[styles.modalButtonText, {color: '#fff'}]}>
                  {isGeneratingImage ? '处理中...' : '开始编辑'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAuthorNoteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAuthorNoteModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>编辑作者注释</Text>
            <TextInput
              style={[styles.urlInput, {height: 100}]}
              placeholder="输入作者注释..."
              placeholderTextColor="#999"
              value={authorNoteInput}
              onChangeText={setAuthorNoteInput}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            {/* 新增 injection_depth 参数选择 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: '#fff', marginRight: 8 }}>插入深度:</Text>
              <TouchableOpacity
                style={{
                  backgroundColor: '#444',
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  marginRight: 8,
                }}
                onPress={() => setAuthorNoteDepth(Math.max(0, authorNoteDepth - 1))}
                disabled={isAuthorNoteSaving || authorNoteDepth <= 0}
              >
                <Text style={{ color: '#fff', fontSize: 18 }}>-</Text>
              </TouchableOpacity>
              <Text style={{ color: '#fff', minWidth: 24, textAlign: 'center' }}>{authorNoteDepth}</Text>
              <TouchableOpacity
                style={{
                  backgroundColor: '#444',
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  marginLeft: 8,
                }}
                onPress={() => setAuthorNoteDepth(authorNoteDepth + 1)}
                disabled={isAuthorNoteSaving}
              >
                <Text style={{ color: '#fff', fontSize: 18 }}>+</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => setShowAuthorNoteModal(false)}
                disabled={isAuthorNoteSaving}
              >
                <Text style={styles.modalButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleSaveAuthorNote}
                disabled={isAuthorNoteSaving}
              >
                <Text style={[styles.modalButtonText, {color: '#fff'}]}>
                  {isAuthorNoteSaving ? '保存中...' : '保存'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCustomImagePromptModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCustomImagePromptModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>自定义生成提示词</Text>
            <TextInput
              style={[styles.urlInput, {height: 100}]}
              placeholder="输入自定义生成提示词..."
              placeholderTextColor="#999"
              value={customImagePrompt}
              onChangeText={setCustomImagePrompt}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => setShowCustomImagePromptModal(false)}
              >
                <Text style={styles.modalButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={executeCustomAutoGeneration}
                disabled={isGeneratingImage}
              >
                <Text style={[styles.modalButtonText, {color: '#fff'}]}>
                  {isGeneratingImage ? '生成中...' : '生成自定义场景图片'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 'auto', // Allow container to size to content
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(40, 40, 40, 0.9)',
    borderRadius: 24,
    padding: 2, // 缩小padding
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    textAlignVertical: 'center', // Helps with alignment in multi-line mode
  },
  button: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  smallButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    minWidth: 32,
    minHeight: 32,
  },
  plusButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  activeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  sendButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  continueButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 2,
  },
  
  // Redesigned compact action menu styles
  actionMenuOverlay: {
    position: 'absolute',
    bottom: '100%', // Position right above the container
    left: 0,
    right: 0,
    zIndex: 100,
  },
  actionMenuBackground: {
    position: 'absolute',
    top: -1000, // Extend far up to capture taps anywhere above
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  actionMenuContainer: {
    backgroundColor: 'rgba(40, 40, 40, 0.95)',
    borderRadius: 12,
    marginHorizontal: 10,
    marginBottom: 4, // Reduced gap between menu and input
    paddingBottom: 6,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    maxHeight: 250, // Made slightly smaller to save space
    // 新增宽度适配
    minWidth: 180,
    maxWidth: 260,
  },
  actionMenuScroll: {
    paddingHorizontal: 8,
  },
  actionMenuItem: {
    paddingVertical: 8, // Reduced padding to make menu more compact
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionMenuItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionMenuItemText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '400',
    marginLeft: 12,
    flex: 1,
  },
    sendimgText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '400',
    marginLeft: 12,
    flex: 1,
  },
  activeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CD964',
    marginRight: 4,
  },
  
  // Keep existing modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#333',
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  imagePreviewContent: {
    backgroundColor: '#333',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  urlInput: {
    backgroundColor: '#444',
    borderRadius: 8,
    padding: 10,
    color: '#fff',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#555',
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: theme.colors.primary,
  },
  modalButtonText: {
    color: '#ddd',
    fontWeight: 'bold',
  },
  submitButtonText: {
    color: 'black',
    fontWeight: 'bold',
  },
  imagePreviewWrapper: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 8,
    marginBottom: 20,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imageEditModalContent: {
    backgroundColor: '#333',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  modalSubtitle: {
    color: '#ddd',
    fontSize: 16,
    marginBottom: 8,
  },
  referenceImageSection: {
    marginBottom: 16,
  },
  referenceImageContainer: {
    height: 200,
    backgroundColor: '#222',
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  referenceImage: {
    width: '100%',
    height: '100%',
  },
  noImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#777',
    marginTop: 8,
  },
  selectImageButton: {
    flexDirection: 'row',
    backgroundColor: '#444',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectImageButtonText: {
    color: '#fff',
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  editImageIcon: {
    backgroundColor: '#8e44ad',
  },
  cacheIcon: {
    backgroundColor: '#e74c3c',
  },
    // 添加新的样式
    configInfoContainer: {
      backgroundColor: 'rgba(60, 60, 60, 0.8)',
      padding: 8,
      borderRadius: 6,
      marginBottom: 12,
    },
    configInfoText: {
      color: '#ddd',
      fontSize: 13,
    },
    promptActionsContainer: {
      marginBottom: 12,
    },
    autoPromptButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#8e44ad',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      marginBottom: 8,
    },
    autoPromptText: {
      color: '#fff',
      fontWeight: '500',
    },
    aiPromptText: {
      color: '#ddd',
      fontSize: 13,
      fontStyle: 'italic',
      marginTop: 5,
      padding: 6,
      backgroundColor: 'rgba(40, 40, 40, 0.6)',
      borderRadius: 4,
    },
    seedContainer: {
      marginBottom: 20,
    },
    seedToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    seedLabel: {
      color: '#ddd',
      fontSize: 14,
    },
    seedInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    seedInput: {
      backgroundColor: '#444',
      color: '#fff',
      flex: 1,
      borderRadius: 6,
      padding: 8,
      marginRight: 8,
    },
    randomSeedButton: {
      backgroundColor: '#555',
      padding: 9,
      borderRadius: 6,
      justifyContent: 'center',
      alignItems: 'center',
    },
    novelaiImageContainer: {
      width: '100%',
      height: 400,
      backgroundColor: '#222',
      borderRadius: 8,
      overflow: 'hidden',
      marginBottom: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    novelaiGeneratedImage: {
      width: '100%',
      height: '100%',
    },
    imageActionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
    },
    imageActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      flex: 1,
      marginHorizontal: 4,
    },
    imageActionButtonText: {
      color: '#fff',
      fontWeight: 'bold',
      marginLeft: 6,
    },
    imageError: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    imageErrorText: {
      color: '#e74c3c',
      marginTop: 8,
    },
    // Add new styles for the section title
    actionMenuSectionTitle: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginTop: 4,
      backgroundColor: 'rgba(0, 0, 0, 0.2)',
      borderRadius: 4,
    },
    actionMenuSectionText: {
      color: '#ccc',
      fontSize: 12,
      fontWeight: 'bold',
    },
});

export default ChatInput;
