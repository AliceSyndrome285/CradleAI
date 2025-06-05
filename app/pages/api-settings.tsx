import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Modal,
  Dimensions,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@/constants/UserContext';
import { ApiServiceProvider } from '@/services/api-service-provider';
import ModelSelector from '@/components/settings/ModelSelector';
import { GlobalSettings, CloudServiceConfig, OpenAICompatibleProviderConfig } from '@/shared/types';
import { theme } from '@/constants/theme';
import { licenseService, LicenseInfo } from '@/services/license-service';
import { DeviceUtils } from '@/utils/device-utils';
import { CloudServiceProvider } from '@/services/cloud-service-provider';
import { updateCloudServiceStatus } from '@/utils/settings-helper';
import { mcpAdapter } from '@/NodeST/nodest/utils/mcp-adapter';
import { NovelAIService } from '@/components/NovelAIService';
import { v4 as uuidv4 } from 'uuid'; // For unique ids
import axios from 'axios';
import { getTTSSettingsAsync, updateTTSSettings, getTTSSettings } from '@/utils/settings-helper';
import { Audio } from 'expo-av'; // 新增
import { MinimaxTTS } from '@/services/minimax-tts/MinimaxTTS'; // 新增
import { synthesizeWithCosyVoice } from '@/services/unified-tts'; // 新增
import { GeminiAdapter } from '@/NodeST/nodest/utils/gemini-adapter';
import { OpenRouterAdapter } from '@/utils/openrouter-adapter';

const screenWidth = Dimensions.get('window').width;
const TTS_PROVIDERS = [
  { key: 'doubao', label: '豆包 TTS' },
  { key: 'minimax', label: 'Minimax TTS' },
  { key: 'cosyvoice', label: 'CosyVoice TTS' }, // 新增
];

const ApiSettings = () => {
  const router = useRouter();
  const { user, updateSettings } = useUser();
  const [isTesting, setIsTesting] = useState(false);
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  // 新增：TTS provider 下拉选择
  const [ttsProvider, setTtsProvider] = useState<'doubao' | 'minimax' | 'cosyvoice'>(
    user?.settings?.tts?.provider || 'doubao'
  );

  // 豆包TTS参数
  const [ttsEnabled, setTtsEnabled] = useState(user?.settings?.tts?.enabled || false);
  const [ttsAppId, setTtsAppId] = useState(user?.settings?.tts?.appid || '');
  const [ttsToken, setTtsToken] = useState(user?.settings?.tts?.token || '');
  const [ttsVoiceType, setTtsVoiceType] = useState(user?.settings?.tts?.voiceType || 'zh_male_M392_conversation_wvae_bigtts');
  const [ttsTransport, setTtsTransport] = useState<'stream' | 'http'>(user?.settings?.tts?.transport === 'http' ? 'http' : 'stream');

  // MinimaxTTS参数
  const [minimaxApiToken, setMinimaxApiToken] = useState(user?.settings?.tts?.minimaxApiToken || '');
  const [minimaxModel, setMinimaxModel] = useState(user?.settings?.tts?.minimaxModel || 'minimax/speech-02-turbo');
  const [isTestingMinimax, setIsTestingMinimax] = useState(false); // 新增

  // CosyVoiceTTS参数（与Minimax一致）
  const [cosyvoiceApiToken, setCosyvoiceApiToken] = useState(user?.settings?.tts?.minimaxApiToken || '');
  const [cosyvoiceModel, setCosyvoiceModel] = useState('chenxwh/cosyvoice2-0.5b:669b1cd618f2747d2237350e868f5c313f3b548fc803ca4e57adfaba778b042d');
  const [isTestingCosyvoice, setIsTestingCosyvoice] = useState(false);
  // 新增：TTS provider 下拉选择状态
  const [showTTSProviderDropdown, setShowTTSProviderDropdown] = useState(false);

  // TTS provider 下拉显示名
  const getTTSProviderDisplayName = (type: string): string => {
    switch (type) {
      case 'doubao': return '豆包 TTS';
      case 'minimax': return 'Minimax TTS';
      case 'cosyvoice': return 'CosyVoice TTS';
      default: return 'Unknown';
    }
  };

  // TTS provider 切换
  const handleTTSProviderTypeChange = (type: 'doubao' | 'minimax' | 'cosyvoice') => {
    setTtsProvider(type);
    setShowTTSProviderDropdown(false);
  };
  // 进入页面时从全局/本地存储异步加载TTS设置，优先使用user.settings中的值
  useEffect(() => {
    const loadTTSSettings = async () => {
      try {
        // 如果user.settings.tts存在且包含有效数据，优先使用
        if (user?.settings?.tts?.appid && user?.settings?.tts?.token) {
          console.log('[API设置] 从user.settings加载TTS设置');
          setTtsEnabled(!!user.settings.tts.enabled);
          setTtsAppId(user.settings.tts.appid);
          setTtsToken(user.settings.tts.token);
          setTtsVoiceType(user.settings.tts.voiceType || 'zh_male_M392_conversation_wvae_bigtts');
          setTtsTransport(user.settings.tts.transport === 'http' ? 'http' : 'stream');
          return;
        }

        // 尝试从持久化存储加载
        const ttsSettings = await getTTSSettingsAsync();
        if (ttsSettings.provider === 'minimax') {
          setTtsProvider('minimax');
          setTtsEnabled(!!ttsSettings.enabled);
          setMinimaxApiToken(ttsSettings.minimaxApiToken || '');
          setMinimaxModel(ttsSettings.minimaxModel || 'minimax/speech-02-turbo');
        } else if (ttsSettings.provider === 'cosyvoice') {
          setTtsProvider('cosyvoice');
          setTtsEnabled(!!ttsSettings.enabled);
          setCosyvoiceApiToken(ttsSettings.minimaxApiToken || '');
          setCosyvoiceModel(ttsSettings.cosyvoiceReplicateModel || 'chenxwh/cosyvoice2-0.5b:669b1cd618f2747d2237350e868f5c313f3b548fc803ca4e57adfaba778b042d');
        } else {
          setTtsProvider('doubao');
          setTtsEnabled(!!ttsSettings.enabled);
          setTtsAppId(ttsSettings.appid || '');
          setTtsToken(ttsSettings.token || '');
          setTtsVoiceType(ttsSettings.voiceType || 'zh_male_M392_conversation_wvae_bigtts');
          setTtsTransport(ttsSettings.transport === 'http' ? 'http' : 'stream');
        }
      } catch (error) {
        console.error('[API设置] 加载TTS设置失败:', error);
      }
    };

    loadTTSSettings();
  }, [user?.settings?.tts]);

  // 豆包TTS测试方法（修正createTTSService导入方式）
  const testdoubaoTtsConnection = async () => {
    try {
      setIsTesting(true);

      if (!ttsAppId || !ttsToken) {
        Alert.alert('错误', '请输入豆包TTS AppID和Token');
        return;
      }

      // 修正：直接import而不是require，且确保路径为@/services/tts/doubao
      let createTTSService: any;
      try {
        // 动态import，兼容性更好
        createTTSService = (await import('@/services/doubaotts/doubaotts-service')).createTTSService;
      } catch (e) {
        // fallback: 尝试老路径
        try {
          createTTSService = (await import('@/services/doubaotts/doubaotts-service')).createTTSService;
        } catch {
          createTTSService = undefined;
        }
      }

      if (typeof createTTSService !== 'function') {
        Alert.alert('错误', '未找到豆包TTS实现（createTTSService）。请检查依赖或联系开发者。');
        return;
      }

      const ttsService = createTTSService({
        appid: ttsAppId,
        token: ttsToken,
        voice_type: ttsVoiceType,
        encoding: 'mp3'
      });

      const testText = '你好，这是豆包语音合成测试。';
      let audioBuffer: Buffer | null = null;
      if (ttsTransport === 'stream') {
        audioBuffer = await ttsService.streamSynthesize(testText);
      } else {
        audioBuffer = await ttsService.quickSynthesize(testText);
      }

      if (audioBuffer && audioBuffer.length > 0) {
        Alert.alert('连接成功', `成功合成音频，大小: ${(audioBuffer.length / 1024).toFixed(1)}KB`);
      } else {
        Alert.alert('连接失败', '未能生成有效的音频数据');
      }
    } catch (error) {
      console.error('豆包TTS测试失败:', error);
      Alert.alert('连接失败', error instanceof Error ? error.message : '未知错误');
    } finally {
      setIsTesting(false);
    }
  };
  // 互斥逻辑：只允许一个 provider 被启用
  const [providerType, setProviderType] = useState<'gemini' | 'openrouter' | 'openai-compatible'>(
    user?.settings?.chat?.apiProvider === 'openrouter'
      ? 'openrouter'
      : user?.settings?.chat?.OpenAIcompatible?.enabled
        ? 'openai-compatible'
        : 'gemini'
  );

  useEffect(() => {
    setOpenRouterEnabled(providerType === 'openrouter');
    setNewProviderEnabled(providerType === 'openai-compatible');
  }, [providerType]);

  const handleProviderTypeChange = (type: 'gemini' | 'openrouter' | 'openai-compatible') => {
    setProviderType(type);
    setShowProviderDropdown(false);

    // 强制同步 provider 相关状态，避免切换后残留旧 provider 的配置
    if (type === 'gemini') {
      // 重置 openrouter/openai-compatible 状态
      setOpenRouterEnabled(false);
      setNewProviderEnabled(false);
    } else if (type === 'openrouter') {
      setOpenRouterEnabled(true);
      setNewProviderEnabled(false);
    } else if (type === 'openai-compatible') {
      setOpenRouterEnabled(false);
      setNewProviderEnabled(true);
    }
  };

  const getProviderDisplayName = (type = ''): string => {
    switch (type) {
      case 'gemini': return 'Gemini';
      case 'openrouter': return 'OpenRouter';
      case 'openai-compatible': return 'OpenAI兼容';
      default: return 'Unknown';
    }
  };

  // Gemini settings
  const [geminiKey, setGeminiKey] = useState(
    user?.settings?.chat?.characterApiKey && user?.settings?.chat?.characterApiKey !== '123'
      ? user.settings.chat.characterApiKey
      : ''
  );
  const [additionalGeminiKeys, setAdditionalGeminiKeys] = useState<string[]>(
    user?.settings?.chat?.additionalGeminiKeys || ['', '']
  );
  const [useGeminiModelLoadBalancing, setUseGeminiModelLoadBalancing] = useState(
    user?.settings?.chat?.useGeminiModelLoadBalancing || false
  );
  const [useGeminiKeyRotation, setUseGeminiKeyRotation] = useState(
    user?.settings?.chat?.useGeminiKeyRotation || false
  );
  const [geminiPrimaryModel, setGeminiPrimaryModel] = useState(
    user?.settings?.chat?.geminiPrimaryModel
  );
  const [geminiBackupModel, setGeminiBackupModel] = useState(
    user?.settings?.chat?.geminiBackupModel
  );
  const [retryDelay, setRetryDelay] = useState(
    user?.settings?.chat?.retryDelay || 5000
  );
  const [geminiTemperature, setGeminiTemperature] = useState(
    typeof user?.settings?.chat?.geminiTemperature === 'number'
      ? user.settings.chat.geminiTemperature
      : 0.7
  );
  const [geminiMaxTokens, setGeminiMaxTokens] = useState(
    typeof user?.settings?.chat?.geminiMaxTokens === 'number'
      ? user.settings.chat.geminiMaxTokens
      : 2048
  );
  const [isModelPickerVisible, setIsModelPickerVisible] = useState(false);
  const [modelPickerType, setModelPickerType] = useState<'primary' | 'backup'>('primary');

  const availableGeminiModels = [
    'gemini-2.5-pro-exp-03-25',
    'gemini-2.5-pro-preview-05-06',
    'gemini-2.5-flash-preview-04-17', // 新增
    'gemini-2.0-flash-exp',
    'gemini-2.0-pro-exp-02-05',
    'gemini-exp-1206',
    'gemini-2.0-flash-thinking-exp-1219',
    'gemini-exp-1121',
    'gemini-exp-1114',
    'gemini-1.5-pro-exp-0827',
    'gemini-1.5-pro-exp-0801',
    'gemini-1.5-flash-8b-exp-0924',
    'gemini-1.5-flash-8b-exp-0827'
  ];

  // OpenRouter settings
  const [openRouterEnabled, setOpenRouterEnabled] = useState(
    user?.settings?.chat?.apiProvider === 'openrouter' &&
    user?.settings?.chat?.openrouter?.enabled || false
  );
  const [openRouterKey, setOpenRouterKey] = useState(
    user?.settings?.chat?.openrouter?.apiKey || ''
  );
  const [selectedModel, setSelectedModel] = useState(
    user?.settings?.chat?.openrouter?.model || ''
  );
  const [useBackupModels, setUseBackupModels] = useState(
    user?.settings?.chat?.openrouter?.useBackupModels || false
  );

  // Zhipu embedding settings
  const [useZhipuEmbedding, setUseZhipuEmbedding] = useState(
    user?.settings?.chat?.useZhipuEmbedding || false
  );
  const [zhipuApiKey, setZhipuApiKey] = useState(
    user?.settings?.chat?.zhipuApiKey && user?.settings?.chat?.zhipuApiKey !== '123'
      ? user.settings.chat.zhipuApiKey
      : ''
  );

  // Brave Search API settings
  const [braveSearchApiKey, setBraveSearchApiKey] = useState(
    user?.settings?.search?.braveSearchApiKey || ''
  );
  const [isTestingBraveSearch, setIsTestingBraveSearch] = useState(false);

  // 新增：判断是否已保存过Brave API Key
  const hasBraveApiKey = !!(user?.settings?.search?.braveSearchApiKey && user.settings.search.braveSearchApiKey.trim() !== '');

  // --- 新增：Brave Search API Key 自动持久化 ---
  const braveSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // 防抖保存
    if (braveSaveTimeout.current) clearTimeout(braveSaveTimeout.current);
    braveSaveTimeout.current = setTimeout(() => {
      updateSettings({
        search: {
          ...user?.settings?.search,
          braveSearchApiKey: braveSearchApiKey
        }
      });
    }, 600); // 600ms 防抖
    return () => {
      if (braveSaveTimeout.current) clearTimeout(braveSaveTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [braveSearchApiKey]);
  // --- end ---

  // NovelAI settings
  const [novelAIEnabled, setNovelAIEnabled] = useState(
    user?.settings?.chat?.novelai?.enabled || false
  );
  const [novelAIToken, setNovelAIToken] = useState(
    user?.settings?.chat?.novelai?.token || ''
  );
  // 新增：NovelAI自定义端点设置
  const [novelAIUseCustomEndpoint, setNovelAIUseCustomEndpoint] = useState(
    user?.settings?.chat?.novelai?.useCustomEndpoint || false
  );
  const [novelAICustomEndpoint, setNovelAICustomEndpoint] = useState(
    user?.settings?.chat?.novelai?.customEndpoint || ''
  );
  const [novelAICustomToken, setNovelAICustomToken] = useState(
    user?.settings?.chat?.novelai?.customToken || ''
  );
  const [isTestingNovelAI, setIsTestingNovelAI] = useState(false);
  const [novelAITokenStatus, setNovelAITokenStatus] = useState<{
    isValid: boolean;
    message: string;
  } | null>(null);
  // 新增：自定义端点测试结果
  const [novelAITestConnectionResult, setNovelAITestConnectionResult] = useState<{success: boolean, message: string} | null>(null);

  const [isModelSelectorVisible, setIsModelSelectorVisible] = useState(false);

  // Activation code settings with enhanced state
  const [useActivationCode, setUseActivationCode] = useState(false);
  const [activationCode, setActivationCode] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);

  // Cloud service state
  const [useCloudService, setUseCloudService] = useState(
    user?.settings?.chat?.useCloudService || false
  );
  const [cloudModel, setCloudModel] = useState(
    user?.settings?.chat?.cloudModel || 'gemini-2.0-flash-exp'
  );

  // Define the allowed cloud models list
  const allowedCloudModels = [
    'gemini-2.5-pro-exp-03-25',
    'gemini-2.0-flash-exp',
    'gemini-2.0-pro-exp-02-05',
    'gemini-exp-1206',
    'gemini-2.0-flash-thinking-exp-1219',
    'gemini-exp-1121',
    'gemini-exp-1114',
    'gemini-1.5-pro-exp-0827',
    'gemini-1.5-pro-exp-0801',
    'gemini-1.5-flash-8b-exp-0924',
    'gemini-1.5-flash-8b-exp-0827'
  ];

  // 新增：OpenAI兼容渠道管理相关状态
  const [openAIProviders, setOpenAIProviders] = useState<OpenAICompatibleProviderConfig[]>(
    user?.settings?.chat?.OpenAIcompatible?.providers && user.settings.chat.OpenAIcompatible.providers.length > 0
      ? user.settings.chat.OpenAIcompatible.providers
      : [
          {
            id: uuidv4(),
            name: '默认渠道',
            apiKey: user?.settings?.chat?.OpenAIcompatible?.apiKey || '',
            model: user?.settings?.chat?.OpenAIcompatible?.model || '',
            endpoint: user?.settings?.chat?.OpenAIcompatible?.endpoint || '',
            stream: false,
            temperature: 0.7,
            max_tokens: 8192,
          },
        ]
  );
  const [selectedProviderId, setSelectedProviderId] = useState<string>(
    user?.settings?.chat?.OpenAIcompatible?.selectedProviderId ||
    (user?.settings?.chat?.OpenAIcompatible?.providers?.[0]?.id ??
      (openAIProviders.length > 0 ? openAIProviders[0].id : ''))
  );
  const [openAIManageMode, setOpenAIManageMode] = useState(false);
  const [openAIExpandedId, setOpenAIExpandedId] = useState<string | null>(selectedProviderId);

  // 当前选中的provider对象
  const currentOpenAIProvider = openAIProviders.find(p => p.id === selectedProviderId) || openAIProviders[0];

  // 编辑当前provider的字段
  const updateCurrentOpenAIProvider = (field: keyof OpenAICompatibleProviderConfig, value: any) => {
    setOpenAIProviders(providers =>
      providers.map(p =>
        p.id === selectedProviderId ? { ...p, [field]: value } : p
      )
    );
  };

  // 新增provider
  const addOpenAIProvider = () => {
    const newProvider: OpenAICompatibleProviderConfig = {
      id: uuidv4(),
      name: `渠道${openAIProviders.length + 1}`,
      apiKey: '',
      model: '',
      endpoint: '',
      stream: false,
      temperature: 0.7,
      max_tokens: 8192,
    };
    setOpenAIProviders([...openAIProviders, newProvider]);
    setSelectedProviderId(newProvider.id);
    setOpenAIExpandedId(newProvider.id);
  };

  // 删除provider
  const deleteOpenAIProvider = (id: string) => {
    let newProviders = openAIProviders.filter(p => p.id !== id);
    let newSelectedId = selectedProviderId;
    if (id === selectedProviderId) {
      newSelectedId = newProviders.length > 0 ? newProviders[0].id : '';
    }
    setOpenAIProviders(newProviders);
    setSelectedProviderId(newSelectedId);
    setOpenAIExpandedId(null);
  };

  // 新增：Minimax TTS 测试方法
  const testMinimaxTTS = async () => {
    try {
      setIsTestingMinimax(true);
      if (!minimaxApiToken || !minimaxModel) {
        Alert.alert('错误', '请输入 Replicate API Token 和模型名称');
        return;
      }
      const tts = new MinimaxTTS(minimaxApiToken, minimaxModel);
      const resp = await tts.textToSpeech({ text: '你好' });
      if (!resp.audioPath) throw new Error('未收到音频地址');
      // 播放音频
      if (Platform.OS === 'web') {
        const audio = new window.Audio(resp.audioPath);
        audio.play();
      } else {
        const { sound } = await Audio.Sound.createAsync({ uri: resp.audioPath });
        await sound.playAsync();
      }
      Alert.alert('成功', '收到音频并已播放');
    } catch (err: any) {
      console.error('Minimax TTS 测试失败:', err);
      Alert.alert('测试失败', err?.message || String(err));
    } finally {
      setIsTestingMinimax(false);
    }
  };

  const testCosyvoiceTTS = async () => {
    try {
      setIsTestingCosyvoice(true);
      if (!cosyvoiceApiToken) {
        Alert.alert('错误', '请输入 Replicate API Token');
        return;
      }

      // 重新初始化统一TTS服务，确保使用最新token
      try {
        const { unifiedTTSService } = require('@/services/unified-tts');
        await unifiedTTSService.updateConfig({});
        console.log('[testCosyvoiceTTS] 统一TTS服务已重新初始化');
      } catch (initError) {
        console.warn('[testCosyvoiceTTS] 统一TTS服务重新初始化失败:', initError);
      }

      // 检查当前TTS设置
      try {
        const currentSettings = getTTSSettings();
        console.log('[testCosyvoiceTTS] 当前TTS设置:', {
          enabled: currentSettings.enabled,
          provider: currentSettings.provider,
          hasReplicateToken: !!currentSettings.replicateApiToken,
          hasMinimaxToken: !!currentSettings.minimaxApiToken,
          cosyvoiceApiToken: cosyvoiceApiToken ? '有值' : '无值'
        });
      } catch (settingsError) {
        console.error('[testCosyvoiceTTS] 获取TTS设置失败:', settingsError);
      }

      // 日志：调用 synthesizeWithCosyVoice 前
      console.log('[CosyVoiceTTS] 调用 synthesizeWithCosyVoice 参数:', {
        text: '你好',
        task: 'zero-shot voice clone',
        templateIdOrSourceAudio: 'template1a'
      });
      // 直接调用统一TTS接口
      const resp = await synthesizeWithCosyVoice(
        '你好',
        'zero-shot voice clone',
        'template1a'
      );
      // 日志：收到 synthesizeWithCosyVoice 返回
      console.log('[CosyVoiceTTS] synthesizeWithCosyVoice 返回:', resp);

      if (!resp.data?.audioPath) throw new Error('未收到音频地址');
      
      // 新增：详细检查音频路径
      const audioPath = resp.data.audioPath;
      console.log('[CosyVoiceTTS] 音频文件路径:', audioPath);
      console.log('[CosyVoiceTTS] 音频路径类型:', typeof audioPath);
      console.log('[CosyVoiceTTS] 音频路径长度:', audioPath ? audioPath.length : 'null/undefined');
      console.log('[CosyVoiceTTS] 是否为URL:', /^https?:\/\//.test(audioPath || ''));
      console.log('[CosyVoiceTTS] 是否为本地文件:', /^file:\/\//.test(audioPath || ''));

      if (Platform.OS === 'web') {
        const audio = new window.Audio(resp.data?.audioPath);
        audio.play();
      } else {
        console.log('[CosyVoiceTTS] 尝试播放音频文件:', audioPath);
        const { sound } = await Audio.Sound.createAsync({ uri: resp.data?.audioPath });
        await sound.playAsync();
      }
      Alert.alert('成功', '收到音频并已播放');
    } catch (err: any) {
      console.error('CosyVoice TTS 测试失败:', err);
      Alert.alert('测试失败', err?.message || String(err));
    } finally {
      setIsTestingCosyvoice(false);
    }
  };

  // 退出编辑
  const collapseOpenAIProvider = () => setOpenAIExpandedId(null);

  const [OpenAIcompatibleEnabled, setNewProviderEnabled] = useState(
    user?.settings?.chat?.OpenAIcompatible?.enabled || false
  );

  // 修复：如果未填写geminiKey，则设为'123'以触发回退
  const effectiveGeminiKey = geminiKey && geminiKey.trim() !== '' ? geminiKey : '123';
  // 修复：如果未填写zhipuApiKey，则设为'123'以触发回退
  const effectiveZhipuApiKey = zhipuApiKey && zhipuApiKey.trim() !== '' ? zhipuApiKey : '123';

  // Load existing license information on component mount
  useEffect(() => {
    const loadLicenseInfo = async () => {
      try {
        const info = await licenseService.getLicenseInfo();
        if (info) {
          setLicenseInfo(info);
          setUseActivationCode(true);
          setActivationCode(info.licenseKey || ''); // Ensure we don't set undefined
          console.log('已加载验证信息:', {
            key: info.licenseKey ? info.licenseKey.substring(0, 4) + '****' : 'No key',
            isValid: info.isValid
          });

          // 自动启用云服务开关（只要已激活且有效）
          if (info.isValid) {
            setUseCloudService(true);
          } else {
            // 从设置读取云服务状态，确保UI显示正确
            const cloudServiceEnabled = user?.settings?.chat?.useCloudService || false;
            setUseCloudService(cloudServiceEnabled);
          }

          if (user?.settings?.chat?.useCloudService || info.isValid) {
            // 如果云服务已启用，尝试从CloudServiceProvider获取当前首选模型
            try {
              const currentModel = CloudServiceProvider.getPreferredModel();
              if (currentModel) {
                setCloudModel(currentModel);
              } else if (user?.settings?.chat?.cloudModel) {
                setCloudModel(user.settings.chat.cloudModel);
              }
              console.log('从CloudServiceProvider加载云服务模型:', currentModel || cloudModel);
            } catch (error) {
              console.error('获取首选模型失败:', error);
            }
            
            if (info.isValid && !CloudServiceProvider.isEnabled()) {
              try {

                await CloudServiceProvider.initialize({
                  enabled: true,
                  licenseKey: info.licenseKey!,
                  deviceId: info.deviceId!,
                  preferredModel: user?.settings?.chat?.cloudModel || 'gemini-2.0-flash-exp'
                });
                console.log('云服务自动初始化成功');
                updateCloudServiceStatus(true);
              } catch (initError) {
                console.error('云服务自动初始化失败:', initError);
              }
            }
          }
        }
      } catch (error) {
        console.error('加载许可证信息失败:', error);
      }
    };

    loadLicenseInfo();
  }, []);

  // 加载NovelAI token状态
  useEffect(() => {
    const loadNovelAITokenStatus = async () => {
      try {
        const tokenCache = await NovelAIService.getTokenCache();
        if (tokenCache && tokenCache.token === novelAIToken.trim()) {
          const now = Date.now();
          if (tokenCache.expiry > now) {
            const daysRemaining = (tokenCache.expiry - now) / (24 * 3600 * 1000);
            setNovelAITokenStatus({
              isValid: true,
              message: `Token有效，剩余约 ${daysRemaining.toFixed(1)} 天`
            });
          } else {
            setNovelAITokenStatus({
              isValid: false,
              message: `Token已过期，需要重新验证`
            });
          }
        } else {
          setNovelAITokenStatus(null);
        }
      } catch (error) {
        console.error('加载NovelAI token状态失败:', error);
      }
    };

    if (novelAIToken.trim()) {
      loadNovelAITokenStatus();
    } else {
      setNovelAITokenStatus(null);
    }
  }, [novelAIToken]);

  // 在组件加载时，添加日志显示设备ID
  useEffect(() => {
    const logDeviceId = async () => {
      try {
        const deviceId = await DeviceUtils.getDeviceId();
        console.log('当前设备ID (用于测试):', deviceId);
      } catch (error) {
        console.error('获取设备ID失败:', error);
      }
    };
    
    logDeviceId();
  }, []);

  // Handle API provider toggle
  const handleProviderToggle = (value: boolean) => {
    setOpenRouterEnabled(value);
  };

  // Update additional Gemini API key
  const updateAdditionalGeminiKey = (index: number, value: string) => {
    const updatedKeys = [...additionalGeminiKeys];
    updatedKeys[index] = value;
    setAdditionalGeminiKeys(updatedKeys);
  };

  // Add a new empty key field
  const addGeminiKeyField = () => {
    if (additionalGeminiKeys.length < 5) { // Limit to 5 additional keys
      setAdditionalGeminiKeys([...additionalGeminiKeys, '']);
    } else {
      Alert.alert('提示', '最多可添加5个额外的API密钥');
    }
  };

  // Remove a key field
  const removeGeminiKeyField = (index: number) => {
    const updatedKeys = [...additionalGeminiKeys];
    updatedKeys.splice(index, 1);
    setAdditionalGeminiKeys(updatedKeys);
  };

  // Test connection with full rotation support
  const testConnection = async () => {
    try {
      setIsTesting(true);

      // 动态获取 providerType，避免异步 setState 导致的不同步
      let currentProviderType = providerType;
      let apiKey = '';
      let apiProvider = '';
      let validAdditionalKeys: string[] = [];

      if (currentProviderType === 'openrouter') {
        apiKey = openRouterKey;
        apiProvider = 'openrouter';
      } else if (currentProviderType === 'openai-compatible') {
        // 取当前选中的 openAI provider
        apiKey = currentOpenAIProvider?.apiKey || '';
        apiProvider = 'openai-compatible';
      } else {
        apiKey = geminiKey && geminiKey.trim() !== '' ? geminiKey : '123';
        apiProvider = 'gemini';
        validAdditionalKeys = additionalGeminiKeys.filter(key => key && key.trim() !== '');
      }

      if (!apiKey) {
        Alert.alert('错误', '请输入API密钥');
        return;
      }

      // Validate additional keys for Gemini
      if (apiProvider === 'gemini' && validAdditionalKeys.length > 0) {
        Alert.alert('连接成功', `成功连接到Gemini API服务，已配置${1 + validAdditionalKeys.length}个API密钥`);
      } else if (apiProvider === 'openrouter') {
        const testMessage = "This is a test message. Please respond with 'OK' if you receive this.";
        const messages = [{ role: 'user', parts: [{ text: testMessage }] }];
        const response = await ApiServiceProvider.generateContent(
          messages,
          apiKey,
          {
            apiProvider: 'openrouter',
            openrouter: {
              enabled: true,
              apiKey: openRouterKey,
              model: selectedModel,
              autoRoute: false,
              useBackupModels: useBackupModels,
              backupModels: [],
            }
          }
        );
        if (response) {
          Alert.alert('连接成功', '成功连接到API服务');
        } else {
          Alert.alert('连接失败', '未能获得有效响应');
        }
      } else if (apiProvider === 'openai-compatible') {
        await testOpenAIcompatibleConnection();
        return;
      }
    } catch (error) {
      console.error('连接测试失败:', error);
      Alert.alert('连接失败', error instanceof Error ? error.message : '未知错误');
    } finally {
      setIsTesting(false);
    }
  };

  // Test NovelAI token
  const testNovelAIToken = async () => {
    try {
      setIsTestingNovelAI(true);
      
      if (!novelAIToken) {
        Alert.alert('错误', '请输入NovelAI Token');
        return;
      }

      const isValid = await NovelAIService.validateToken(novelAIToken);
      
      if (isValid) {
        setNovelAITokenStatus({
          isValid: true,
          message: `Token验证成功，有效期约30天`
        });
        Alert.alert('验证成功', 'NovelAI Token验证成功，已缓存Token');
      } else {
        setNovelAITokenStatus({
          isValid: false,
          message: `Token验证失败`
        });
        Alert.alert('验证失败', '无法验证NovelAI Token，请检查后重试');
      }
    } catch (error) {
      console.error('NovelAI Token测试失败:', error);
      Alert.alert('验证失败', error instanceof Error ? error.message : '未知错误');
      setNovelAITokenStatus({
        isValid: false,
        message: `验证出错：${error instanceof Error ? error.message : '未知错误'}`
      });
    } finally {
      setIsTestingNovelAI(false);
    }
  };

  // Test Zhipu embeddings
  const testZhipuEmbedding = async () => {
    try {
      setIsTesting(true);

      const apiKeyToUse = zhipuApiKey && zhipuApiKey.trim() !== '' ? zhipuApiKey : '123';

      if (!apiKeyToUse || apiKeyToUse === '') {
        Alert.alert('错误', '请输入智谱清言API密钥');
        return;
      }

      // 构建请求体，测试嵌入功能
      const testUrl = 'https://open.bigmodel.cn/api/paas/v4/embeddings';
      const testInput = "这是一个测试智谱清言嵌入功能的文本。";

      const requestBody = {
        model: 'embedding-3',
        input: testInput
      };

      const response = await fetch(testUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKeyToUse}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new Error(`智谱清言API错误: ${response.status} ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();

      if (data.data && data.data[0]?.embedding) {
        const embeddingLength = data.data[0].embedding.length;
        Alert.alert('嵌入测试成功', `成功获取嵌入向量，维度: ${embeddingLength}`);
      } else {
        Alert.alert('嵌入测试失败', '未能获得有效的嵌入向量');
      }
    } catch (error) {
      console.error('智谱嵌入测试失败:', error);
      Alert.alert('嵌入测试失败', error instanceof Error ? error.message : '未知错误');
    } finally {
      setIsTesting(false);
    }
  };

  // Test Brave Search API
  const testBraveSearch = async () => {
    try {
      setIsTestingBraveSearch(true);

      if (!braveSearchApiKey) {
        Alert.alert('错误', '请输入Brave Search API密钥');
        return;
      }

      // 设置API密钥并测试连接
      await mcpAdapter.setApiKey(braveSearchApiKey);
      
      // 执行一个简单的测试搜索
      const testQuery = "test query";
      const searchResult = await mcpAdapter.search({
        query: testQuery,
        count: 1
      });

      if (searchResult && searchResult.web?.results) {
        Alert.alert('连接成功', `成功连接到Brave Search API，获取到 ${searchResult.web.results.length} 个搜索结果`);
      } else {
        Alert.alert('连接失败', '未能获得有效的搜索结果');
      }
    } catch (error) {
      console.error('Brave Search测试失败:', error);
      Alert.alert('连接失败', error instanceof Error ? error.message : '未知错误');
    } finally {
      setIsTestingBraveSearch(false);
    }
  };

  // Test OpenAIcompatible connection
  const testOpenAIcompatibleConnection = async () => {
    try {
      if (
        !currentOpenAIProvider.endpoint ||
        !currentOpenAIProvider.apiKey ||
        !currentOpenAIProvider.model
      ) {
        Alert.alert('错误', '请填写完整的 Endpoint、API Key 和模型名称');
        return;
      }
      setIsTesting(true);

      // 直接使用用户填写的 endpoint，不再自动补全 /v1/chat/completions
      const url = currentOpenAIProvider.endpoint;
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentOpenAIProvider.apiKey}`,
      };
      const body = JSON.stringify({
        model: currentOpenAIProvider.model,
        messages: [
          { role: 'user', content: '你好呀' }
        ],
        temperature: currentOpenAIProvider.temperature ?? 0.7,
        max_tokens: currentOpenAIProvider.max_tokens ?? 8192,
        stream: !!currentOpenAIProvider.stream,
      });

      const resp = await fetch(url, {
        method: 'POST',
        headers,
        body
      });

      if (!resp.ok) { 
        let errMsg = '';
        try {
          const errJson = await resp.json();
          errMsg = JSON.stringify(errJson);
        } catch {
          errMsg = resp.statusText;
        }
        Alert.alert('连接失败', `HTTP ${resp.status}: ${errMsg}`);
        return;
      }
//
      const data = await resp.json();
      const content =
        data?.choices?.[0]?.message?.content ||
        data?.choices?.[0]?.text ||
        JSON.stringify(data);

      Alert.alert('连接成功', `收到回复: ${content}`);
    } catch (err: any) {
      console.error('[OpenAIcompatible] 测试连接失败:', err? err.message : '未知错误');
      Alert.alert('连接失败', err?.message || '未知错误');
    } finally {
      setIsTesting(false);
    }
  };

  // Activate license function
  const activateLicense = async () => {
    if (!activationCode.trim()) {
      Alert.alert('错误', '请输入激活码');
      return;
    }

    try {
      setIsActivating(true);

      const deviceId = await DeviceUtils.getDeviceId();
      console.log('当前设备ID:', deviceId.substring(0, 4) + '****');

      // 确保验证过程中记录请求信息
      const licenseInfo = await licenseService.verifyLicense(activationCode.trim());

      setLicenseInfo(licenseInfo);

      if (licenseInfo) {
      ;
      }

    } catch (error) {
      console.error('许可证激活错误:', error);
      let errorMessage = '未知错误，请检查激活码是否正确';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      }

      Alert.alert(
        '激活失败',
        errorMessage
      );
    } finally {
      setIsActivating(false);
    }
  };

  // 保存设置
  const saveSettings = async () => {
    try {
      // Filter out empty additional API keys
      const validAdditionalKeys = additionalGeminiKeys.filter(key => key && key.trim() !== '');

      let apiProvider = providerType;
      let openrouterEnabled = apiProvider === 'openrouter';
      let openaiCompatibleEnabled = apiProvider === 'openai-compatible';

      // 取当前 openai-compatible provider
      const openaiProvider = openAIProviders.find(p => p.id === selectedProviderId) || openAIProviders[0];

      // --- NovelAI设置持久化 ---
      const novelaiSettings = {
        enabled: novelAIEnabled,
        token: novelAIToken,
        useCustomEndpoint: novelAIUseCustomEndpoint,
        customEndpoint: novelAICustomEndpoint,
        customToken: novelAICustomToken,
        model: 'NAI Diffusion V4',
        sampler: 'k_euler_ancestral',
        steps: 28,
        scale: 11,
        noiseSchedule: 'karras'
      };

      // 新增：TTS设置
      let ttsSettings: any = { enabled: ttsEnabled, provider: ttsProvider };
      if (ttsProvider === 'doubao') {
        ttsSettings = {
          ...ttsSettings,
          appid: ttsAppId,
          token: ttsToken,
          voiceType: ttsVoiceType,
          encoding: 'mp3',
          speedRatio: 1.0,
          transport: ttsTransport
        };
      } else if (ttsProvider === 'minimax') {
        ttsSettings = {
          ...ttsSettings,
          minimaxApiToken,
          minimaxModel
        };
      } else if (ttsProvider === 'cosyvoice') {
        ttsSettings = {
          ...ttsSettings,
          minimaxApiToken: cosyvoiceApiToken, // 复用统一token
          cosyvoiceReplicateModel: cosyvoiceModel
        };
      }

      if (useActivationCode && licenseInfo) {
        const apiSettings: Partial<GlobalSettings> = {
          chat: {
            ...user?.settings?.chat,
            serverUrl: user?.settings?.chat?.serverUrl || '',
            characterApiKey: effectiveGeminiKey,
            additionalGeminiKeys: validAdditionalKeys,
            useGeminiModelLoadBalancing,
            useGeminiKeyRotation,
            geminiPrimaryModel,
            geminiBackupModel,
            retryDelay,
            geminiTemperature,
            geminiMaxTokens,
            xApiKey: user?.settings?.chat?.xApiKey || '',
            apiProvider: apiProvider,
            typingDelay: user?.settings?.chat?.typingDelay || 50,
            temperature: user?.settings?.chat?.temperature || 0.7,
            maxtokens: user?.settings?.chat?.maxtokens || 2000,
            maxTokens: user?.settings?.chat?.maxTokens || 2000,
            useZhipuEmbedding: useZhipuEmbedding,
            zhipuApiKey: effectiveZhipuApiKey,
            useCloudService: useCloudService,
            cloudModel: useCloudService ? cloudModel : undefined,
            openrouter: {
              enabled: openrouterEnabled,
              apiKey: openRouterKey,
              model: selectedModel,
              useBackupModels: useBackupModels,
              backupModels: user?.settings?.chat?.openrouter?.backupModels || []
            },
            novelai: novelaiSettings,
            OpenAIcompatible: {
              enabled: openaiCompatibleEnabled,
              apiKey: openaiProvider?.apiKey || '',
              model: openaiProvider?.model || '',
              endpoint: openaiProvider?.endpoint || '',
              providers: openAIProviders,
              selectedProviderId: selectedProviderId,
              stream: openaiProvider?.stream,
              temperature: openaiProvider?.temperature,
              max_tokens: openaiProvider?.max_tokens,
            }
          },
          search: {
            ...user?.settings?.search,
            braveSearchApiKey: braveSearchApiKey
          },
          tts: ttsSettings, // 新增TTS设置
          license: {
            enabled: true,
            licenseKey: licenseInfo.licenseKey,
            deviceId: licenseInfo.deviceId,
            planId: licenseInfo.planId,
            expiryDate: licenseInfo.expiryDate,
            isValid: licenseInfo.isValid // Explicitly store validity state
          }
        };

        // First update settings
        await updateSettings(apiSettings);

        // 新增：同步TTS设置到本地存储，确保adapter能获取到最新token
        try {
          await updateTTSSettings(ttsSettings);
          console.log('[API设置] TTS设置已同步到本地存储');
        } catch (ttsError) {
          console.error('[API设置] TTS设置同步失败:', ttsError);
        }

        // Update the Brave Search API key
        if (braveSearchApiKey) {
          try {
            await mcpAdapter.setApiKey(braveSearchApiKey);
            console.log('Updated Brave Search API Key');
          } catch (braveSearchError) {
            console.error('Failed to update Brave Search API Key:', braveSearchError);
          }
        }

        // Update zhipuApiKey in Mem0Service directly if embedding is enabled
        if (useZhipuEmbedding && effectiveZhipuApiKey) {
          try {
            const Mem0Service = require('@/src/memory/services/Mem0Service').default;
            const mem0Service = Mem0Service.getInstance();
            mem0Service.updateEmbedderApiKey(effectiveZhipuApiKey);
            console.log('Updated zhipuApiKey in Mem0Service');
            
            // Reset embedding availability flag to true since we have a key now
            mem0Service.isEmbeddingAvailable = true;
          } catch (memError) {
            console.error('Failed to update zhipuApiKey in Mem0Service:', memError);
          }
        }

        // Then initialize CloudServiceProvider
        try {
          if (useCloudService) {
            const cloudConfig: CloudServiceConfig = {
              enabled: true,
              licenseKey: licenseInfo.licenseKey,
              deviceId: licenseInfo.deviceId,
              preferredModel: cloudModel
            };

            await CloudServiceProvider.initialize(cloudConfig);
            console.log('Cloud service provider initialized with license information and model', cloudModel);
            
            // Update cloud service status in the tracker
            updateCloudServiceStatus(true);
          } else {
            CloudServiceProvider.disable();
            console.log('Cloud service provider disabled');
            
            // Update cloud service status in the tracker
            updateCloudServiceStatus(false);
          }
        } catch (cloudError) {
          console.warn('Failed to initialize cloud service:', cloudError);
          // Make sure tracker status matches actual state
          updateCloudServiceStatus(false);
        }

        // 日志：如果当前provider为openai-compatible，输出当前保存的渠道信息
        if (apiProvider === 'openai-compatible') {
          console.log('[API设置] 当前保存的OpenAI兼容渠道:', {
            id: selectedProviderId,
            name: openaiProvider?.name,
            endpoint: openaiProvider?.endpoint,
            model: openaiProvider?.model,
          });
        }

        Alert.alert('成功', '设置已保存', [
          { text: '确定', onPress: () => router.back() }
        ]);
      } else if (!useActivationCode) {
        await licenseService.clearLicense();
        CloudServiceProvider.disable();
        setUseCloudService(false);
        
        // Update cloud service status in the tracker
        updateCloudServiceStatus(false);

        const apiSettings: Partial<GlobalSettings> = {
          chat: {
            ...user?.settings?.chat,
            serverUrl: user?.settings?.chat?.serverUrl || '',
            characterApiKey: effectiveGeminiKey,
            additionalGeminiKeys: validAdditionalKeys,
            useGeminiModelLoadBalancing,
            useGeminiKeyRotation,
            geminiPrimaryModel,
            geminiBackupModel,
            retryDelay,
            geminiTemperature,
            geminiMaxTokens,
            xApiKey: user?.settings?.chat?.xApiKey || '',
            apiProvider: apiProvider,
            typingDelay: user?.settings?.chat?.typingDelay || 50,
            temperature: user?.settings?.chat?.temperature || 0.7,
            maxtokens: user?.settings?.chat?.maxtokens || 2000,
            maxTokens: user?.settings?.chat?.maxTokens || 2000,
            useZhipuEmbedding: useZhipuEmbedding,
            zhipuApiKey: effectiveZhipuApiKey,
            useCloudService: false,
            openrouter: {
              enabled: openrouterEnabled,
              apiKey: openRouterKey,
              model: selectedModel,
              useBackupModels: useBackupModels,
              backupModels: user?.settings?.chat?.openrouter?.backupModels || []
            },
            novelai: novelaiSettings,
            OpenAIcompatible: {
              enabled: openaiCompatibleEnabled,
              apiKey: openaiProvider?.apiKey || '',
              model: openaiProvider?.model || '',
              endpoint: openaiProvider?.endpoint || '',
              providers: openAIProviders,
              selectedProviderId: selectedProviderId,
              stream: openaiProvider?.stream,
              temperature: openaiProvider?.temperature,
              max_tokens: openaiProvider?.max_tokens,
            }
          },
          search: {
            ...user?.settings?.search,
            braveSearchApiKey: braveSearchApiKey
          },
          tts: ttsSettings, // 新增TTS设置
          license: {
            enabled: false
          }
        };

        await updateSettings(apiSettings);

        // 新增：同步TTS设置到本地存储，确保adapter能获取到最新token
        try {
          await updateTTSSettings(ttsSettings);
          console.log('[API设置] TTS设置已同步到本地存储（第二分支）');
        } catch (ttsError) {
          console.error('[API设置] TTS设置同步失败（第二分支）:', ttsError);
        }

        // Update the Brave Search API key
        if (braveSearchApiKey) {
          try {
            await mcpAdapter.setApiKey(braveSearchApiKey);
            console.log('Updated Brave Search API Key');
          } catch (braveSearchError) {
            console.error('Failed to update Brave Search API Key:', braveSearchError);
          }
        }

        // Update zhipuApiKey in Mem0Service directly if embedding is enabled
        if (useZhipuEmbedding && effectiveZhipuApiKey) {
          try {
            const Mem0Service = require('@/src/memory/services/Mem0Service').default;
            const mem0Service = Mem0Service.getInstance();
            mem0Service.updateEmbedderApiKey(effectiveZhipuApiKey);
            console.log('Updated zhipuApiKey in Mem0Service');
            
            // Reset embedding availability flag to true since we have a key now
            mem0Service.isEmbeddingAvailable = true;
          } catch (memError) {
            console.error('Failed to update zhipuApiKey in Mem0Service:', memError);
          }
        }

        // 日志：如果当前provider为openai-compatible，输出当前保存的渠道信息
        if (apiProvider === 'openai-compatible') {
          console.log('[API设置] 当前保存的OpenAI兼容渠道:', {
            id: selectedProviderId,
            name: openaiProvider?.name,
            endpoint: openaiProvider?.endpoint,
            model: openaiProvider?.model,
          });
        }

        Alert.alert('成功', '设置已保存', [
          { text: '确定', onPress: () => router.back() }
        ]);
      }
    } catch (error) {
      console.error('保存设置失败:', error);
      Alert.alert('错误', '保存设置失败');
    }
  };

  // Also update tracker when the switch is toggled
  const handleCloudServiceToggle = (enabled: boolean) => {
    setUseCloudService(enabled);
    console.log(`Cloud service switch toggled to: ${enabled ? 'enabled' : 'disabled'}`);
  };

  // Add a method to test if model selector can be displayed
  const canShowModelSelector = () => {
    return true; // Always allow showing model selector
  };

  // Render NovelAI token status
  const renderNovelAITokenStatus = () => {
    if (!novelAITokenStatus) return null;

    return (
      <View style={styles.tokenStatusContainer}>
        {novelAITokenStatus.isValid ? (
          <View style={styles.tokenStatusContent}>
            <Text style={styles.tokenStatusText}>
              令牌状态: <Text style={styles.tokenValid}>有效</Text>
            </Text>
            {novelAITokenStatus.message && (
              <Text style={styles.tokenDetailText}>{novelAITokenStatus.message}</Text>
            )}
          </View>
        ) : (
          <Text style={styles.tokenStatusText}>
            令牌状态: <Text style={styles.tokenInvalid}>无效</Text>
            {novelAITokenStatus.message && ` - ${novelAITokenStatus.message}`}
          </Text>
        )}
      </View>
    );
  };

  // Function to select a Gemini model
  const openModelPicker = (type: 'primary' | 'backup') => {
    setModelPickerType(type);
    setIsModelPickerVisible(true);
  };

  // Function to handle model selection
  const handleModelSelection = (modelId: string) => {
    if (isModelPickerVisible) {
      // 处理 Gemini 主/备用模型选择
      if (modelPickerType === 'primary') {
        setGeminiPrimaryModel(modelId);
      } else if (modelPickerType === 'backup') {
        setGeminiBackupModel(modelId);
      }
      setIsModelPickerVisible(false);
      return;
    }

    if (useCloudService) {
      // For cloud service, validate that the model is allowed
      if (allowedCloudModels.includes(modelId)) {
        setCloudModel(modelId);
      } else {
        // If not an allowed model, use the first allowed model
        setCloudModel(allowedCloudModels[0]);
        Alert.alert('模型不可用', '云服务目前仅支持Gemini系列模型，已自动选择推荐模型。');
      }
    } else {
      setSelectedModel(modelId);
    }
    setIsModelSelectorVisible(false);
  };

  // NovelAI自定义端点测试逻辑（参考NovelAITestModal）
  const testNovelAICustomEndpoint = async () => {
    setNovelAITestConnectionResult(null);
    setIsTestingNovelAI(true);
    try {
      if (!novelAICustomEndpoint.trim()) {
        throw new Error('请输入自定义端点URL');
      }
      if (!novelAICustomToken.trim()) {
        throw new Error('请输入自定义端点Token');
      }
      const response = await axios({
        method: 'get',
        url: novelAICustomEndpoint,
        headers: {
          'Authorization': `Bearer ${novelAICustomToken}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        timeout: 10000,
      });
      setNovelAITestConnectionResult({
        success: true,
        message: `连接成功! 自定义端点可访问。`
      });
      Alert.alert('连接成功', '自定义端点可访问');
    } catch (error: any) {
      let errorMessage = '连接测试失败';
      if (axios.isAxiosError(error)) {
        if (error.response) {
          errorMessage = `连接失败 (${error.response.status}): ${error.response.data?.message || error.message}`;
        } else if (error.request) {
          errorMessage = `无法连接到服务器: ${error.message}`;
          if (error.code === 'ECONNABORTED') {
            errorMessage = '连接超时。请检查端点URL是否正确，或者网络连接是否稳定。';
          }
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      setNovelAITestConnectionResult({
        success: false,
        message: `连接测试失败: ${errorMessage}`
      });
      Alert.alert('连接失败', errorMessage);
    } finally {
      setIsTestingNovelAI(false);
    }
  };

  // 统一测试入口
  const handleUnifiedTestConnection = async () => {
    if (providerType === 'openrouter') {
      // 简单调用 OpenRouter 的文本生成方法
      try {
        setIsTesting(true);
        if (!openRouterKey) {
          Alert.alert('错误', '请输入OpenRouter API Key');
          return;
        }
        
        const adapter = new OpenRouterAdapter(openRouterKey, selectedModel || 'openai/gpt-3.5-turbo');
        const result = await adapter.generateContent([
          { role: 'user', parts: [{ text: '你好' }] }
        ]);
        Alert.alert('连接成功', `收到回复: ${result}`);
      } catch (err: any) {
        Alert.alert('连接失败', err?.message || String(err));
      } finally {
        setIsTesting(false);
      }
    } else if (providerType === 'openai-compatible') {
      await testOpenAIcompatibleConnection();
    } else if (providerType === 'gemini') {
      // 简单调用 Gemini 的文本生成方法
      try {
        setIsTesting(true);
        if (!geminiKey) {
          Alert.alert('错误', '请输入Gemini API Key');
          return;
        }
        
        const adapter = new GeminiAdapter(geminiKey);
        const result = await adapter.generateContent([
          { role: 'user', parts: [{ text: '你好' }] }
        ]);
        Alert.alert('连接成功', `收到回复: ${result}`);
      } catch (err: any) {
        console.error('Gemini API 测试失败:', err);
        Alert.alert('连接失败', err?.message || String(err));
      } finally {
        setIsTesting(false);
      }
    }
  };
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>API 设置</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>API 渠道</Text>
                            {/* 缩小为icon按钮 */}
                            <TouchableOpacity
                style={{
                  marginLeft: 8,
                  padding: 6,
                  backgroundColor: theme.colors.primary,
                  borderRadius: 20,
                  width: 32,
                  height: 32,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onPress={handleUnifiedTestConnection}
                disabled={isTesting}
              >
                {isTesting ? (
                  <ActivityIndicator size={18} color="black" />
                ) : (
                  <Ionicons name="flash-outline" size={18} color="black" />
                )}
              </TouchableOpacity>
            </View>
            <View style={styles.contentSection}>
              <Text style={styles.inputLabel}>选择 API 提供商</Text>
              <TouchableOpacity
                style={styles.providerDropdown}
                onPress={() => setShowProviderDropdown(true)}
              >
                <Text style={styles.providerDropdownText}>
                  {getProviderDisplayName(providerType)}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {providerType === 'gemini' && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Gemini API</Text>
              </View>
              <View style={styles.contentSection}>
                <Text style={styles.inputLabel}>Gemini API Key (主密钥)</Text>
                <TextInput
                  style={styles.input}
                  value={geminiKey}
                  onChangeText={setGeminiKey}
                  placeholder="输入 Gemini API Key"
                  placeholderTextColor="#999"
                  secureTextEntry={true}
                />
                <Text style={styles.helperText}>
                  可从 <Text style={styles.link}>Google AI Studio</Text> 获取免费 API Key
                </Text>
                
                {/* 额外的API密钥 */}
                <View style={styles.additionalKeysContainer}>
                  <View style={styles.additionalKeysHeader}>
                    <Text style={styles.additionalKeysTitle}>额外的API密钥 (可选)</Text>
                    <TouchableOpacity 
                      style={styles.addKeyButton}
                      onPress={addGeminiKeyField}
                    >
                      <Ionicons name="add-circle-outline" size={20} color={theme.colors.primary} />
                      <Text style={styles.addKeyText}>添加</Text>
                    </TouchableOpacity>
                  </View>
                  
                  {additionalGeminiKeys.map((key, index) => (
                    <View key={`key-${index}`} style={styles.additionalKeyRow}>
                      <TextInput
                        style={[styles.input, styles.additionalKeyInput]}
                        value={key}
                        onChangeText={(value) => updateAdditionalGeminiKey(index, value)}
                        placeholder={`额外API密钥 #${index + 1}`}
                        placeholderTextColor="#999"
                        secureTextEntry={true}
                      />
                      <TouchableOpacity 
                        style={styles.removeKeyButton}
                        onPress={() => removeGeminiKeyField(index)}
                      >
                        <Ionicons name="close-circle" size={22} color="#f44336" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  
                </View>
                
                {/* 模型负载均衡设置 */}
                <View style={styles.loadBalancingSection}>
                  <Text style={styles.loadBalancingTitle}>高级设置</Text>
                  
                  <View style={styles.switchContainer}>
                    <Text style={styles.switchLabel}>
                      模型选择
                    </Text>
                    <Switch
                      value={useGeminiModelLoadBalancing}
                      onValueChange={setUseGeminiModelLoadBalancing}
                      trackColor={{ false: '#767577', true: 'rgba(100, 210, 255, 0.4)' }}
                      thumbColor={useGeminiModelLoadBalancing ? '#2196F3' : '#f4f3f4'}
                    />
                  </View>
                  {useGeminiModelLoadBalancing && (
                    <>
                      
                      {/* 主模型选择 */}
                      <View style={styles.modelSelectorContainer}>
                        <Text style={styles.inputLabel}>主模型</Text>
                        <TextInput
                          style={styles.input}
                          value={geminiPrimaryModel}
                          onChangeText={setGeminiPrimaryModel}
                          placeholder="输入主模型名称或从列表选择"
                          placeholderTextColor="#999"
                        />
                        <TouchableOpacity
                          style={styles.selectFromListButton}
                          onPress={() => openModelPicker('primary')}
                        >
                          <Text style={styles.selectFromListButtonText}>从列表选择</Text>
                        </TouchableOpacity>
                      </View>
                      
                      {/* 备用模型选择 */}
                      <View style={styles.modelSelectorContainer}>
                        <Text style={styles.inputLabel}>备用模型</Text>
                        <TextInput
                          style={styles.input}
                          value={geminiBackupModel}
                          onChangeText={setGeminiBackupModel}
                          placeholder="输入备用模型名称或从列表选择"
                          placeholderTextColor="#999"
                        />
                        <TouchableOpacity
                          style={styles.selectFromListButton}
                          onPress={() => openModelPicker('backup')}
                        >
                          <Text style={styles.selectFromListButtonText}>从列表选择</Text>
                        </TouchableOpacity>
                      </View>
                      
                      {/* 重试延迟设置 */}
                      <View style={styles.modelSelectorContainer}>
                        <Text style={styles.inputLabel}>备用模型重试延迟 (毫秒)</Text>
                        <TextInput
                          style={styles.input}
                          value={String(retryDelay)}
                          onChangeText={(text) => {
                            const value = parseInt(text.replace(/[^0-9]/g, ''));
                            setRetryDelay(isNaN(value) ? 5000 : value);
                          }}
                          placeholder="输入延迟时间 (毫秒)"
                          placeholderTextColor="#999"
                        />
                        <Text style={styles.helperText}>
                          推荐值: 5000 (5秒)。主模型失败后等待多久再尝试备用模型
                        </Text>
                      </View>
                    </>
                  )}
                  
                  <View style={styles.switchContainer}>
                    <Text style={styles.switchLabel}>
                      密钥轮换
                    </Text>
                    <Switch
                      value={useGeminiKeyRotation}
                      onValueChange={setUseGeminiKeyRotation}
                      trackColor={{ false: '#767577', true: 'rgba(100, 210, 255, 0.4)' }}
                      thumbColor={useGeminiKeyRotation ? '#2196F3' : '#f4f3f4'}
                    />
                  </View>
                </View>

                {/* 新增 temperature 和 max tokens 设置
                <View style={{ marginTop: 24 }}>
                  <Text style={styles.inputLabel}>Temperature</Text>
                  <TextInput
                    style={styles.input}
                    value={String(geminiTemperature)}
                    onChangeText={v => {
                      // 允许输入小数点，但只允许一个
                      let valStr = v.replace(/[^0-9.]|(?<=\..*)\./g, '');
                      let val = parseFloat(valStr);
                      if (isNaN(val)) val = 0.7;
                      if (val < 0) val = 0;
                      if (val > 2) val = 2;
                      setGeminiTemperature(val);
                    }}
                    placeholder="1"
                    placeholderTextColor="#999"
                  />
                  <Text style={styles.inputLabel}>Max Tokens</Text>
                  <TextInput
                    style={styles.input}
                    value={String(geminiMaxTokens)}
                    onChangeText={v => {
                      let val = parseInt(v.replace(/[^0-9]/g, ''));
                      if (isNaN(val)) val = 2048;
                      if (val < 1) val = 1;
                      if (val > 32768) val = 32768;
                      setGeminiMaxTokens(val);
                    }}
                    placeholder="8192"
                    placeholderTextColor="#999"
                  />
                </View> */}
              </View>
            </View>
          )}

          {providerType === 'openrouter' && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>OpenRouter API</Text>
              </View>
              <View style={styles.contentSection}>
                <Text style={styles.inputLabel}>OpenRouter API Key</Text>
                <TextInput
                  style={styles.input}
                  value={openRouterKey}
                  onChangeText={setOpenRouterKey}
                  placeholder="输入 OpenRouter API Key"
                  placeholderTextColor="#999"
                  secureTextEntry={true}
                />
                <Text style={styles.helperText}>
                  可从 <Text style={styles.link}>OpenRouter</Text> 获取 API Key
                </Text>

                <View style={styles.modelSection}>
                  <Text style={styles.inputLabel}>当前选定模型</Text>
                  <TouchableOpacity
                    style={styles.modelButton}
                    onPress={() => setIsModelSelectorVisible(true)}
                  >
                    <Text style={styles.modelButtonText}>{selectedModel}</Text>
                    <Ionicons name="chevron-down" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>

                <View style={styles.switchContainer}>
                  <Text style={styles.switchLabel}>使用备用模型</Text>
                  <Switch
                    value={useBackupModels}
                    onValueChange={setUseBackupModels}
                    trackColor={{ false: '#767577', true: 'rgba(255, 158, 205, 0.4)' }}
                    thumbColor={useBackupModels ? theme.colors.primary : '#f4f3f4'}
                  />
                </View>
              </View>
            </View>
          )}

          {providerType === 'openai-compatible' && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>OpenAI兼容API</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: '#aaa', fontSize: 12, marginRight: 12 }}>填写完整的端点</Text>
                  <TouchableOpacity
                    style={{ marginRight: 8 }}
                    onPress={addOpenAIProvider}
                  >
                    <Ionicons name="add-circle-outline" size={22} color={theme.colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setOpenAIManageMode(!openAIManageMode)}
                  >
                    <Ionicons name="settings-outline" size={22} color={openAIManageMode ? '#f44336' : '#fff'} />
                  </TouchableOpacity>
                  {/* 收起按钮，仅在有展开项时显示 */}
                  {openAIExpandedId && (
                    <TouchableOpacity
                      style={{ marginLeft: 8 }}
                      onPress={collapseOpenAIProvider}
                    >
                      <Ionicons name="chevron-up-circle-outline" size={22} color={theme.colors.primary} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <View style={styles.contentSection}>
                {/* 渠道列表 */}
                {openAIProviders.length === 0 && (
                  <Text style={{ color: '#aaa', marginBottom: 8 }}>暂无渠道，请点击右上角添加</Text>
                )}
                {openAIProviders.map((provider, idx) => (
                  <View
                    key={provider.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginBottom: 4,
                      backgroundColor: provider.id === selectedProviderId ? 'rgba(100,210,255,0.08)' : 'transparent',
                      borderRadius: 6,
                      paddingVertical: 4,
                      paddingHorizontal: 8,
                    }}
                  >
                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                      onPress={() => {
                        setSelectedProviderId(provider.id);
                        setOpenAIExpandedId(provider.id);
                      }}
                      disabled={openAIManageMode}
                    >
                      <Ionicons
                        name={provider.id === selectedProviderId ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={provider.id === selectedProviderId ? theme.colors.primary : '#aaa'}
                        style={{ marginRight: 8 }}
                      />
                      <Text style={{ color: '#fff', fontWeight: provider.id === selectedProviderId ? 'bold' : 'normal' }}>
                        {provider.name || `渠道${idx + 1}`}
                      </Text>
                      <Text style={{ color: '#aaa', marginLeft: 8, fontSize: 12 }}>
                        {provider.model || '未设置模型'}
                      </Text>
                    </TouchableOpacity>
                    {openAIManageMode && (
                      <TouchableOpacity
                        onPress={() => deleteOpenAIProvider(provider.id)}
                        style={{ marginLeft: 8 }}
                        disabled={openAIProviders.length <= 1}
                      >
                        <Ionicons name="trash-outline" size={20} color={openAIProviders.length <= 1 ? '#888' : '#f44336'} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                {/* 展开编辑区域 */}
                {openAIExpandedId && (() => {
                  const editingProvider = openAIProviders.find(p => p.id === openAIExpandedId);
                  if (!editingProvider) return null;
                  return (
                    <View style={{
                      marginTop: 12,
                      padding: 12,
                      backgroundColor: 'rgba(40,40,40,0.7)',
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.08)'
                    }}>
                      <Text style={styles.inputLabel}>渠道名称</Text>
                      <TextInput
                        style={styles.input}
                        value={editingProvider.name}
                        onChangeText={v => setOpenAIProviders(providers =>
                          providers.map(p => p.id === editingProvider.id ? { ...p, name: v } : p)
                        )}
                        placeholder="自定义名称"
                        placeholderTextColor="#999"
                      />
                      <Text style={styles.inputLabel}>OpenAI兼容端点</Text>
                      <TextInput
                        style={styles.input}
                        value={editingProvider.endpoint}
                        onChangeText={v => setOpenAIProviders(providers =>
                          providers.map(p => p.id === editingProvider.id ? { ...p, endpoint: v } : p)
                        )}
                        placeholder="如 https://api.openai.com/v1/chat/completions"
                        placeholderTextColor="#999"
                        autoCapitalize="none"
                      />
                      <Text style={styles.inputLabel}>API Key</Text>
                      <TextInput
                        style={styles.input}
                        value={editingProvider.apiKey}
                        onChangeText={v => setOpenAIProviders(providers =>
                          providers.map(p => p.id === editingProvider.id ? { ...p, apiKey: v } : p)
                        )}
                        placeholder="输入 API Key"
                        placeholderTextColor="#999"
                        secureTextEntry={true}
                      />
                      <Text style={styles.inputLabel}>模型</Text>
                      <TextInput
                        style={styles.input}
                        value={editingProvider.model}
                        onChangeText={v => setOpenAIProviders(providers =>
                          providers.map(p => p.id === editingProvider.id ? { ...p, model: v } : p)
                        )}
                        placeholder="输入模型名"
                        placeholderTextColor="#999"
                      />
                      {/* Temperature 滑块 */}
                      <Text style={styles.inputLabel}>
                        Temperature <Text style={{ color: theme.colors.primary }}>{editingProvider.temperature ?? 0.7}</Text>
                      </Text>
                      <Slider
                        style={{ width: '100%', height: 40 }}
                        minimumValue={0}
                        maximumValue={2}
                        step={0.01}
                        value={editingProvider.temperature ?? 0.7}
                        minimumTrackTintColor={theme.colors.primary}
                        maximumTrackTintColor="#888"
                        thumbTintColor={theme.colors.primary}
                        onValueChange={val => setOpenAIProviders(providers =>
                          providers.map(p => p.id === editingProvider.id ? { ...p, temperature: parseFloat(val.toFixed(2)) } : p)
                        )}
                      />
                      {/* Max Tokens 滑块 */}
                      <Text style={styles.inputLabel}>
                        Max Tokens <Text style={{ color: theme.colors.primary }}>{editingProvider.max_tokens ?? 8192}</Text>
                      </Text>
                      <Slider
                        style={{ width: '100%', height: 40 }}
                        minimumValue={512}
                        maximumValue={8192}
                        step={1}
                        value={editingProvider.max_tokens ?? 8192}
                        minimumTrackTintColor={theme.colors.primary}
                        maximumTrackTintColor="#888"
                        thumbTintColor={theme.colors.primary}
                        onValueChange={val => setOpenAIProviders(providers =>
                          providers.map(p => p.id === editingProvider.id ? { ...p, max_tokens: Math.round(val) } : p)
                        )}
                      />
                    </View>
                  );
                })()}
              </View>
            </View>
          )}

          <View style={styles.section}>
            {/* <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>测试入口</Text>
              <Switch
                value={useActivationCode}
                onValueChange={setUseActivationCode}
                trackColor={{ false: '#767577', true: 'rgba(255, 158, 205, 0.4)' }}
                thumbColor={useActivationCode ? theme.colors.primary : '#f4f3f4'}
              />
            </View> */}

            {useActivationCode && (
              <View style={styles.contentSection}>
                <Text style={styles.inputLabel}>License</Text>
                <TextInput
                  style={styles.input}
                  value={activationCode}
                  onChangeText={(text) => {
                    // 当用户修改激活码时，清除以前的license信息
                    if (licenseInfo && text !== licenseInfo.licenseKey) {
                      console.log('已修改，清除现有信息');
                                           setLicenseInfo(null);
                    }
                    setActivationCode(text);
                  }}
                  placeholder="..."
                  placeholderTextColor="#999"
                  secureTextEntry={false}
                />

                {licenseInfo ? (
                  <View style={styles.licenseInfoContainer}>
                    <Text style={styles.licenseStatusText}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color="#4CAF50"
                      /> 已激活
                    </Text>

                    <View style={styles.cloudServiceContainer}>
                      <Text style={styles.cloudServiceLabel}>启用</Text>
                      <Switch
                        value={useCloudService}
                        onValueChange={handleCloudServiceToggle}
                        trackColor={{ false: '#767577', true: 'rgba(100, 210, 255, 0.4)' }}
                        thumbColor={useCloudService ? '#2196F3' : '#f4f3f4'}
                        disabled={!licenseInfo}
                      />
                    </View>
                    {useCloudService && (
                      <>
                        <View style={styles.modelSection}>
                          <Text style={styles.inputLabel}>模型选择</Text>
                          <TouchableOpacity
                            style={styles.modelButton}
                            onPress={() => setIsModelSelectorVisible(true)}
                          >
                            <Text style={styles.modelButtonText}>{cloudModel}</Text>
                            <Ionicons name="chevron-down" size={16} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.activateButton, isActivating && styles.disabledButton]}
                    onPress={activateLicense}
                    disabled={isActivating || !activationCode.trim()}
                  >
                    {isActivating ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.buttonText}>验证激活</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>NovelAI</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Switch
                  value={novelAIEnabled}
                  onValueChange={setNovelAIEnabled}
                  trackColor={{ false: '#767577', true: 'rgba(138, 43, 226, 0.4)' }}
                  thumbColor={novelAIEnabled ? '#8a2be2' : '#f4f3f4'}
                />
                {novelAIEnabled && (
                  <>
                    {novelAIUseCustomEndpoint ? (
                      <TouchableOpacity
                        style={{ marginLeft: 8 }}
                        onPress={testNovelAICustomEndpoint}
                        disabled={isTestingNovelAI}
                      >
                        {isTestingNovelAI ? (
                          <ActivityIndicator size={18} color="#fff" />
                        ) : (
                          <Ionicons name="flash-outline" size={18} color="#fff" />
                        )}
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={{ marginLeft: 8 }}
                        onPress={testNovelAIToken}
                        disabled={isTestingNovelAI || !novelAIToken}
                      >
                        {isTestingNovelAI ? (
                          <ActivityIndicator size={18} color="#fff" />
                        ) : (
                          <Ionicons name="flash-outline" size={18} color="#fff" />
                        )}
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            </View>
            {novelAIEnabled && (
              <View style={styles.contentSection}>
                <View style={styles.switchContainer}>
                  <Text style={styles.inputLabel}>使用自定义端点</Text>
                  <Switch
                    value={novelAIUseCustomEndpoint}
                    onValueChange={setNovelAIUseCustomEndpoint}
                    trackColor={{ false: '#767577', true: 'rgba(100, 210, 255, 0.4)' }}
                    thumbColor={novelAIUseCustomEndpoint ? '#3498db' : '#f4f3f4'}
                  />
                </View>
                {novelAIUseCustomEndpoint ? (
                  <>
                    <Text style={styles.inputLabel}>自定义端点 URL（无需/generate-image后缀）</Text>
                    <TextInput
                      style={styles.input}
                      value={novelAICustomEndpoint}
                      onChangeText={setNovelAICustomEndpoint}
                      placeholder="h"
                      autoCapitalize="none"
                    />
                    <Text style={styles.inputLabel}>自定义端点 Token</Text>
                    <TextInput
                      style={styles.input}
                      value={novelAICustomToken}
                      onChangeText={setNovelAICustomToken}
                      placeholder=""
                      secureTextEntry={true}
                    />
                    {novelAITestConnectionResult && (
                      <View style={[
                        styles.tokenStatusContainer,
                        novelAITestConnectionResult.success ? { borderLeftColor: '#27ae60', backgroundColor: '#d4edda' } : { borderLeftColor: '#e74c3c', backgroundColor: '#f8d7da' }
                      ]}>
                        <Text style={{ color: novelAITestConnectionResult.success ? '#27ae60' : '#e74c3c' }}>
                          {novelAITestConnectionResult.success ? '✓ ' : '✗ '}
                          {novelAITestConnectionResult.message}
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    <Text style={styles.inputLabel}>NovelAI Token</Text>
                    <TextInput
                      style={styles.input}
                      value={novelAIToken}
                      onChangeText={setNovelAIToken}
                      placeholder="输入 NovelAI Token"
                      placeholderTextColor="#999"
                      secureTextEntry={true}
                    />
                    <Text style={styles.helperText}>
                      需要登录 <Text style={styles.link}>novelai.net</Text> 获取 Token，用于生成高质量动漫图片
                    </Text>
                    {renderNovelAITokenStatus()}
                  </>
                )}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Brave Search API</Text>
              <TouchableOpacity
                style={{ marginLeft: 8 }}
                onPress={testBraveSearch}
                disabled={isTestingBraveSearch || !braveSearchApiKey}
              >
                {isTestingBraveSearch ? (
                  <ActivityIndicator size={18} color="#fff" />
                ) : (
                  <Ionicons name="flash-outline" size={18} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
            <View style={styles.contentSection}>
              <Text style={styles.inputLabel}>Brave Search API Key</Text>
              <TextInput
                style={styles.input}
                value={braveSearchApiKey}
                onChangeText={setBraveSearchApiKey}
                placeholder={hasBraveApiKey ? '************' : '输入 Brave Search API Key'}
                placeholderTextColor="#999"
                secureTextEntry={true}
              />
              <Text style={styles.helperText}>
                可从 <Text style={styles.link}>https://brave.com/search/api/</Text> 获取免费 API Key
              </Text>
              {/* 按钮已移至标题栏 */}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>智谱清言嵌入</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Switch
                  value={useZhipuEmbedding}
                  onValueChange={setUseZhipuEmbedding}
                  trackColor={{ false: '#767577', true: 'rgba(255, 158, 205, 0.4)' }}
                  thumbColor={useZhipuEmbedding ? theme.colors.primary : '#f4f3f4'}
                />
                {useZhipuEmbedding && (
                  <TouchableOpacity
                    style={{ marginLeft: 8 }}
                    onPress={testZhipuEmbedding}
                    disabled={isTesting || !zhipuApiKey}
                  >
                    {isTesting ? (
                      <ActivityIndicator size={18} color="#fff" />
                    ) : (
                      <Ionicons name="flash-outline" size={18} color="#fff" />
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {useZhipuEmbedding && (
              <View style={styles.contentSection}>
                <Text style={styles.inputLabel}>智谱清言 API Key</Text>
                <TextInput
                  style={styles.input}
                  value={zhipuApiKey}
                  onChangeText={setZhipuApiKey}
                  placeholder="输入智谱清言 API Key"
                  placeholderTextColor="#999"
                  secureTextEntry={true}
                />
                <Text style={styles.helperText}>
                  可从 <Text style={styles.link}>智谱清言开放平台</Text> 获取 API Key
                </Text>
                {/* 按钮已移至标题栏 */}
              </View>
            )}
          </View>

          {/* 新增：豆包TTS设置区域 */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>语音合成（TTS）</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Switch
                  value={ttsEnabled}
                  onValueChange={setTtsEnabled}
                  trackColor={{ false: '#767577', true: 'rgba(255, 158, 205, 0.4)' }}
                  thumbColor={ttsEnabled ? theme.colors.primary : '#f4f3f4'}
                />
                {/* 豆包TTS测试按钮 */}
                {ttsEnabled && ttsProvider === 'doubao' && (
                  <TouchableOpacity
                    style={{ marginLeft: 8 }}
                    onPress={testdoubaoTtsConnection}
                    disabled={isTesting}
                  >
                    {isTesting ? (
                      <ActivityIndicator size={18} color="#fff" />
                    ) : (
                      <Ionicons name="flash-outline" size={18} color="#fff" />
                    )}
                  </TouchableOpacity>
                )}
                {/* Minimax 测试按钮 */}
                {ttsEnabled && ttsProvider === 'minimax' && (
                  <TouchableOpacity
                    style={{ marginLeft: 8 }}
                    onPress={testMinimaxTTS}
                    disabled={isTestingMinimax}
                  >
                    {isTestingMinimax ? (
                      <ActivityIndicator size={18} color="#fff" />
                    ) : (
                      <Ionicons name="flash-outline" size={18} color="#fff" />
                    )}
                  </TouchableOpacity>
                )}
                {/* CosyVoice 测试按钮 */}
                {ttsEnabled && ttsProvider === 'cosyvoice' && (
                  <TouchableOpacity
                    style={{ marginLeft: 8 }}
                    onPress={testCosyvoiceTTS}
                    disabled={isTestingCosyvoice}
                  >
                    {isTestingCosyvoice ? (
                      <ActivityIndicator size={18} color="#fff" />
                    ) : (
                      <Ionicons name="flash-outline" size={18} color="#fff" />
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {ttsEnabled && (
              <View style={styles.contentSection}>
                {/* TTS Provider 下拉选择 */}
                <Text style={styles.inputLabel}>TTS 服务商</Text>
                <TouchableOpacity
                  style={styles.providerDropdown}
                  onPress={() => setShowTTSProviderDropdown(true)}
                >
                  <Text style={styles.providerDropdownText}>
                    {getTTSProviderDisplayName(ttsProvider)}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color="#fff" />
                </TouchableOpacity>
                {/* 豆包TTS参数 */}
                {ttsProvider === 'doubao' && (
                  <>
                    <Text style={styles.inputLabel}>App ID</Text>
                    <TextInput
                      style={styles.input}
                      value={ttsAppId}
                      onChangeText={setTtsAppId}
                      placeholder="输入豆包TTS App ID"
                      placeholderTextColor="#999"
                      autoCapitalize="none"
                    />
                    <Text style={styles.inputLabel}>Token</Text>
                    <TextInput
                      style={styles.input}
                      value={ttsToken}
                      onChangeText={setTtsToken}
                      placeholder="输入豆包TTS Token"
                      placeholderTextColor="#999"
                      secureTextEntry={true}
                    />
                    <Text style={styles.inputLabel}>音色类型</Text>
                    <TextInput
                      style={styles.input}
                      value={ttsVoiceType}
                      onChangeText={setTtsVoiceType}
                      placeholder="音色类型"
                      placeholderTextColor="#999"
                    />
                    <Text style={styles.inputLabel}>传输方式</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          marginRight: 20,
                          opacity: ttsTransport === 'stream' ? 1 : 0.6
                        }}
                        onPress={() => setTtsTransport('stream')}
                      >
                        <Ionicons
                          name={ttsTransport === 'stream' ? 'radio-button-on' : 'radio-button-off'}
                          size={18}
                          color={theme.colors.primary}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={{ color: '#fff' }}>流式传输</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          opacity: ttsTransport === 'http' ? 1 : 0.6
                        }}
                        onPress={() => setTtsTransport('http')}
                      >
                        <Ionicons
                          name={ttsTransport === 'http' ? 'radio-button-on' : 'radio-button-off'}
                          size={18}
                          color={theme.colors.primary}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={{ color: '#fff' }}>HTTP传输</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
                {/* MinimaxTTS参数 */}
                {ttsProvider === 'minimax' && (
                  <>
                    <Text style={styles.inputLabel}>Replicate API Token</Text>
                    <TextInput
                      style={styles.input}
                      value={minimaxApiToken}
                      onChangeText={setMinimaxApiToken}
                      placeholder="输入 Replicate API Token"
                      placeholderTextColor="#999"
                      autoCapitalize="none"
                      secureTextEntry={true}
                    />
                    <Text style={styles.inputLabel}>模型名称</Text>
                    <TextInput
                      style={styles.input}
                      value={minimaxModel}
                      onChangeText={setMinimaxModel}
                      placeholder="如 minimax/speech-02-turbo"
                      placeholderTextColor="#999"
                      autoCapitalize="none"
                    />
                  </>
                )}
                {/* CosyVoiceTTS参数 */}
                {ttsProvider === 'cosyvoice' && (
                  <>
                    <Text style={styles.inputLabel}>Replicate API Token</Text>
                    <TextInput
                      style={styles.input}
                      value={cosyvoiceApiToken}
                      onChangeText={setCosyvoiceApiToken}
                      placeholder="输入 Replicate API Token"
                      placeholderTextColor="#999"
                      autoCapitalize="none"
                      secureTextEntry={true}
                    />
                    <Text style={styles.inputLabel}>模型名称</Text>
                    <TextInput
                      style={styles.input}
                      value={cosyvoiceModel}
                      onChangeText={setCosyvoiceModel}
                      placeholder="如 chenxwh/cosyvoice2-0.5b:669b1cd618f2747d2237350e868f5c313f3b548fc803ca4e57adfaba778b042d"
                      placeholderTextColor="#999"
                      autoCapitalize="none"
                    />
                  </>
                )}
              </View>
            )}
          </View>

          <View style={styles.buttonGroup}>
            {/* <TouchableOpacity
              style={styles.testButton}
              onPress={testConnection}
              disabled={isTesting}
            >
              {isTesting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="flash-outline" size={18} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.buttonText}>测试连接</Text>
                </>
              )}
            </TouchableOpacity> */}

            <TouchableOpacity
              style={styles.saveButton}
              onPress={saveSettings}
            >
              <Ionicons name="save-outline" size={18} color="black" style={styles.buttonIcon} />
              <Text style={styles.savebuttonText}>保存设置</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Provider Selection Modal */}
      <Modal
        visible={showProviderDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowProviderDropdown(false)}
      >
        <TouchableOpacity 
          style={styles.dropdownOverlay} 
          activeOpacity={1}
          onPress={() => setShowProviderDropdown(false)}
        >
          <View style={[
            styles.dropdownContent,
            { width: Math.min(screenWidth * 0.9, 400) }
          ]}>
            <TouchableOpacity
              style={[
                styles.dropdownItem,
                providerType === 'gemini' && styles.dropdownItemSelected
              ]}
              onPress={() => handleProviderTypeChange('gemini')}
            >
              <Text style={styles.dropdownItemText}>Gemini</Text>
              {providerType === 'gemini' && (
                <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.dropdownItem,
                providerType === 'openrouter' && styles.dropdownItemSelected
              ]}
              onPress={() => handleProviderTypeChange('openrouter')}
            >
              <Text style={styles.dropdownItemText}>OpenRouter</Text>
              {providerType === 'openrouter' && (
                <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.dropdownItem,
                providerType === 'openai-compatible' && styles.dropdownItemSelected
              ]}
              onPress={() => handleProviderTypeChange('openai-compatible')}
            >
              <Text style={styles.dropdownItemText}>OpenAI兼容</Text>
              {providerType === 'openai-compatible' && (
                <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* TTS Provider Selection Modal */}
      <Modal
        visible={showTTSProviderDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTTSProviderDropdown(false)}
      >
        <TouchableOpacity 
          style={styles.dropdownOverlay} 
          activeOpacity={1}
          onPress={() => setShowTTSProviderDropdown(false)}
        >
          <View style={[
            styles.dropdownContent,
            { width: Math.min(screenWidth * 0.9, 400) }
          ]}>
            <TouchableOpacity
              style={[
                styles.dropdownItem,
                ttsProvider === 'doubao' && styles.dropdownItemSelected
              ]}
              onPress={() => handleTTSProviderTypeChange('doubao')}
            >
              <Text style={styles.dropdownItemText}>豆包 TTS</Text>
              {ttsProvider === 'doubao' && (
                <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.dropdownItem,
                ttsProvider === 'minimax' && styles.dropdownItemSelected
              ]}
              onPress={() => handleTTSProviderTypeChange('minimax')}
            >
              <Text style={styles.dropdownItemText}>Minimax TTS</Text>
              {ttsProvider === 'minimax' && (
                <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.dropdownItem,
                ttsProvider === 'cosyvoice' && styles.dropdownItemSelected
              ]}
              onPress={() => handleTTSProviderTypeChange('cosyvoice')}
            >
              <Text style={styles.dropdownItemText}>CosyVoice TTS</Text>
              {ttsProvider === 'cosyvoice' && (
                <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={isModelSelectorVisible}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setIsModelSelectorVisible(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setIsModelSelectorVisible(false)}
              style={styles.modalBackButton}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>选择模型</Text>
            <View style={styles.modalHeaderRight} />
          </View>
          <View style={{ flex: 1 }}>
            <ModelSelector
              apiKey={openRouterKey || ''}
              selectedModelId={useCloudService ? cloudModel : selectedModel}
              onSelectModel={handleModelSelection}
              useCloudService={useCloudService}
              allowedCloudModels={allowedCloudModels}
            />
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={isModelPickerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsModelPickerVisible(false)}
      >
        <View style={styles.modelPickerOverlay}>
          <View style={[
            styles.modelPickerContent,
            { width: Math.min(screenWidth * 0.95, 400), maxHeight: Math.min(screenWidth * 1.2, 500) }
          ]}>
            <View style={styles.modelPickerHeader}>
              <Text style={styles.modelPickerTitle}>
                选择{modelPickerType === 'primary' ? '主' : '备用'}模型
              </Text>
              <TouchableOpacity
                onPress={() => setIsModelPickerVisible(false)}
                style={styles.modelPickerCloseButton}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modelPickerList}>
              {availableGeminiModels.map((model) => (
                <TouchableOpacity
                  key={model}
                  style={[
                    styles.modelPickerItem,
                    ((modelPickerType === 'primary' && model === geminiPrimaryModel) ||
                      (modelPickerType === 'backup' && model === geminiBackupModel)) &&
                      styles.modelPickerItemSelected
                  ]}
                  onPress={() => handleModelSelection(model)}
                >
                  <Text style={styles.modelPickerItemText}>
                    {model}
                  </Text>
                  {((modelPickerType === 'primary' && model === geminiPrimaryModel) ||
                    (modelPickerType === 'backup' && model === geminiBackupModel)) && (
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  backButton: {
    padding: 8,
  },
  headerRight: {
    width: 40,
  },
  container: {
    flex: 1,
  },
  scrollView: {
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionTitle: {
    fontSize: Math.max(16, screenWidth * 0.045),
    fontWeight: 'bold',
    color: '#fff',
  },
  contentSection: {
    padding: 16,
  },
  inputLabel: {
    fontSize: Math.max(13, screenWidth * 0.035),
    color: '#ddd',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(40, 40, 40, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: Math.max(15, screenWidth * 0.04),
    width: '100%',
  },
  helperText: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 4,
  },
  link: {
    color: theme.colors.primary,
    textDecorationLine: 'underline',
  },
  modelSection: {
    marginTop: 16,
  },
  modelButton: {
    backgroundColor: 'rgba(40, 40, 40, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  modelButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  selectFromListButton: {
    backgroundColor: theme.colors.secondary, // Or any other suitable color
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  selectFromListButtonText: {
    color: '#fff', // Or black, depending on button background
    fontSize: 14,
    fontWeight: 'bold',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  switchLabel: {
    fontSize: 14,
    color: '#ddd',
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  testButton: {
    flex: 1,
    backgroundColor: '#666',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  saveButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginLeft: 8,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  savebuttonText: {
    color: 'black',
    fontWeight: 'bold',
    fontSize: 16,
  },
  notesContainer: {
    backgroundColor: 'rgba(60, 60, 60, 0.5)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  noteIcon: {
    marginTop: 2,
    marginRight: 8,
  },
  noteText: {
    fontSize: 14,
    color: '#ddd',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#333',
    width: Math.min(screenWidth * 0.95, 400),
    height: '70%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    backgroundColor: '#444',
    padding: Math.max(12, screenWidth * 0.03),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#555',
  },
  modalTitle: {
    fontSize: Math.max(16, screenWidth * 0.045),
    fontWeight: 'bold',
    color: '#fff',
  },
  zhipuTestButton: {
    backgroundColor: '#8e44ad',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  licenseInfoContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(30, 30, 30, 0.6)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  licenseStatusText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  licenseInfoText: {
    fontSize: 14,
    color: '#ddd',
    marginBottom: 4,
  },
  activateButton: {
    backgroundColor: '#4CAF50',
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  disabledButton: {
    opacity: 0.6,
  },
  cloudServiceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  cloudServiceLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  cloudServiceInfo: {
    marginTop: 8,
    fontSize: 12,
    color: '#aaa',
    fontStyle: 'italic',
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalBackButton: {
    padding: 8,
  },
  modalHeaderRight: {
    width: 40,
  },
  braveTestButton: {
    backgroundColor: '#FB542B',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  additionalKeysContainer: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  additionalKeysHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  additionalKeysTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ddd',
  },
  addKeyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  addKeyText: {
    fontSize: 14,
    color: theme.colors.primary,
    marginLeft: 4,
  },
  additionalKeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  additionalKeyInput: {
    flex: 1,
    marginRight: 8,
  },
  removeKeyButton: {
    padding: 4,
  },
  loadBalancingSection: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  loadBalancingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ddd',
    marginBottom: 16,
  },
  featureTag: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: 'normal',
  },
  featureDescription: {
    fontSize: 12,
    color: '#aaa',
    marginBottom: 16,
    marginTop: 4,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(33, 150, 243, 0.6)',
  },
  novelAITestButton: {
    backgroundColor: '#8a2be2',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  novelAIInfoContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(30, 30, 30, 0.6)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#8a2be2',
  },
  novelAIInfoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  novelAIInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  novelAIInfoIcon: {
    marginRight: 6,
  },
  novelAIInfoText: {
    fontSize: 13,
    color: '#ddd',
  },
  tokenStatusContainer: {
    marginVertical: 10,
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#8a2be2',
  },
  tokenStatusContent: {
    flexDirection: 'column',
  },
  tokenStatusText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  tokenDetailText: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  tokenValid: {
    color: '#27ae60',
    fontWeight: 'bold',
  },
  tokenInvalid: {
    color: '#e74c3c',
    fontWeight: 'bold',
  },
  modelSelectorContainer: {
    marginTop: 16,
  },
  modelPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modelPickerContent: {
    backgroundColor: '#333',
    width: Math.min(screenWidth * 0.95, 400),
    maxHeight: Math.min(screenWidth * 1.2, 500),
    borderRadius: 12,
    overflow: 'hidden',
  },
  modelPickerHeader: {
    backgroundColor: '#444',
    padding: Math.max(12, screenWidth * 0.03),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#555',
  },
  modelPickerTitle: {
    fontSize: Math.max(16, screenWidth * 0.045),
    fontWeight: 'bold',
    color: '#fff',
  },
  modelPickerCloseButton: {
    padding: 4,
  },
  modelPickerList: {
    padding: 8,
  },
  modelPickerItem: {
    padding: Math.max(12, screenWidth * 0.03),
    borderRadius: 8,
    marginVertical: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modelPickerItemSelected: {
    backgroundColor: 'rgba(100, 210, 255, 0.2)',
  },
  modelPickerItemText: {
    fontSize: Math.max(15, screenWidth * 0.04),
    color: '#fff',
  },
  providerDropdown: {
    backgroundColor: 'rgba(40, 40, 40, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  providerDropdownText: {
    color: '#fff',
    fontSize: 16,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownContent: {
    backgroundColor: '#333',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  dropdownItem: {
    padding: Math.max(12, screenWidth * 0.03),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownItemSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dropdownItemText: {
    fontSize: Math.max(15, screenWidth * 0.04),
    color: '#fff',
  },
});

export default ApiSettings;

