import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ColorPicker from '@/components/common/ColorPicker';
import { theme } from '@/constants/theme';

export interface ChatUISettings {
  // Regular mode
  regularUserBubbleColor: string;
  regularUserBubbleAlpha: number;
  regularBotBubbleColor: string;
  regularBotBubbleAlpha: number;
  regularUserTextColor: string;
  regularBotTextColor: string;
  
  // Background focus mode
  bgUserBubbleColor: string;
  bgUserBubbleAlpha: number;
  bgBotBubbleColor: string;
  bgBotBubbleAlpha: number;
  bgUserTextColor: string;
  bgBotTextColor: string;
  
  // Visual novel mode
  vnDialogColor: string;
  vnDialogAlpha: number;
  vnTextColor: string;
  
  // Global sizes
  bubblePaddingMultiplier: number;
  textSizeMultiplier: number;
}

const DEFAULT_SETTINGS: ChatUISettings = {
  // Regular mode
  regularUserBubbleColor: 'rgb(255, 224, 195)',
  regularUserBubbleAlpha: 0.95,
  regularBotBubbleColor: 'rgb(68, 68, 68)',
  regularBotBubbleAlpha: 0.85,
  regularUserTextColor: '#333333',
  regularBotTextColor: '#ffffff',
  
  // Background focus mode
  bgUserBubbleColor: 'rgb(255, 224, 195)',
  bgUserBubbleAlpha: 0.95,
  bgBotBubbleColor: 'rgb(68, 68, 68)',
  bgBotBubbleAlpha: 0.9,
  bgUserTextColor: '#333333',
  bgBotTextColor: '#ffffff',
  
  // Visual novel mode
  vnDialogColor: 'rgb(0, 0, 0)',
  vnDialogAlpha: 0.7,
  vnTextColor: '#ffffff',
  
  // Global sizes
  bubblePaddingMultiplier: 1.0,
  textSizeMultiplier: 1.0
};

const SETTINGS_FILE = `${FileSystem.documentDirectory}chat_ui_settings.json`;

const ChatUISettingsScreen: React.FC = () => {
  const [settings, setSettings] = useState<ChatUISettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<'regular' | 'bg-focus' | 'visual-novel' | 'global'>('regular');
  const [isLoading, setIsLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Load settings from file system when component mounts
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const fileInfo = await FileSystem.getInfoAsync(SETTINGS_FILE);
      
      if (fileInfo.exists) {
        const fileContent = await FileSystem.readAsStringAsync(SETTINGS_FILE);
        const loadedSettings = JSON.parse(fileContent);
        setSettings(loadedSettings);
      } else {
        // If file doesn't exist, use default settings
        setSettings(DEFAULT_SETTINGS);
      }
    } catch (error) {
      console.error('Error loading UI settings:', error);
      Alert.alert('Error', 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setIsLoading(true);
      await FileSystem.writeAsStringAsync(SETTINGS_FILE, JSON.stringify(settings));
      setHasChanges(false);
      Alert.alert('Success', 'Settings saved successfully');
    } catch (error) {
      console.error('Error saving UI settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateSetting = <K extends keyof ChatUISettings>(key: K, value: ChatUISettings[K]) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
    setHasChanges(true);
  };

  const handleResetConfirm = () => {
    Alert.alert(
      '重置设置',
      '确定要将所有UI设置恢复为默认值吗？',
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '重置', 
          style: 'destructive',
          onPress: () => {
            setSettings(DEFAULT_SETTINGS);
            setHasChanges(true);
          }
        }
      ]
    );
  };

  const renderColorWithAlpha = (label: string, color: string, alpha: number, onColorChange: (color: string) => void, onAlphaChange: (alpha: number) => void) => (
    <View style={styles.settingItem}>
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.settingRow}>
        <ColorPicker
          color={color}
          onColorChange={onColorChange}
          style={styles.colorPicker}
        />
        <View style={styles.alphaSliderContainer}>
          <Text style={styles.alphaLabel}>透明度: {Math.round(alpha * 100)}%</Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={1}
            step={0.01}
            value={alpha}
            onValueChange={onAlphaChange}
            minimumTrackTintColor={theme.colors.primary}
            maximumTrackTintColor="#777"
            thumbTintColor={theme.colors.primary}
          />
        </View>
      </View>
      <View style={[styles.colorPreview, { 
        backgroundColor: color.replace('rgb', 'rgba').replace(')', `,${alpha})`) 
      }]} />
    </View>
  );
  
  const renderTextColorSetting = (label: string, color: string, onColorChange: (color: string) => void) => (
    <View style={styles.settingItem}>
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.settingRow}>
        <ColorPicker
          color={color}
          onColorChange={onColorChange}
          style={styles.colorPicker}
        />
      </View>
      <View style={[styles.colorPreview, { backgroundColor: color }]}>
        <Text style={{ color: '#fff', fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 2 }}>示例文本</Text>
      </View>
    </View>
  );

  const renderSizeSlider = (label: string, value: number, onValueChange: (value: number) => void, min: number = 0.7, max: number = 1.5) => (
    <View style={styles.settingItem}>
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.sliderContainer}>
        <Text style={styles.sliderValue}>{Math.round(value * 100)}%</Text>
        <Slider
          style={[styles.slider, { width: '80%' }]}
          minimumValue={min}
          maximumValue={max}
          step={0.05}
          value={value}
          onValueChange={onValueChange}
          minimumTrackTintColor={theme.colors.primary}
          maximumTrackTintColor="#777"
          thumbTintColor={theme.colors.primary}
        />
      </View>
    </View>
  );

  if (isLoading && !settings) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>加载设置中...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          if (hasChanges) {
            Alert.alert(
              '未保存的更改',
              '您有未保存的更改，确定要离开吗？',
              [
                { text: '取消', style: 'cancel' },
                { text: '离开', style: 'destructive', onPress: () => router.back() }
              ]
            );
          } else {
            router.back();
          }
        }} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>聊天界面设置</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'regular' && styles.activeTab]} 
          onPress={() => setActiveTab('regular')}
        >
          <Text style={[styles.tabText, activeTab === 'regular' && styles.activeTabText]}>常规模式</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'bg-focus' && styles.activeTab]} 
          onPress={() => setActiveTab('bg-focus')}
        >
          <Text style={[styles.tabText, activeTab === 'bg-focus' && styles.activeTabText]}>背景强调</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'visual-novel' && styles.activeTab]} 
          onPress={() => setActiveTab('visual-novel')}
        >
          <Text style={[styles.tabText, activeTab === 'visual-novel' && styles.activeTabText]}>视觉小说</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'global' && styles.activeTab]} 
          onPress={() => setActiveTab('global')}
        >
          <Text style={[styles.tabText, activeTab === 'global' && styles.activeTabText]}>全局</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {activeTab === 'regular' && (
          <View style={styles.settingsSection}>
            <Text style={styles.sectionTitle}>常规模式设置</Text>
            
            {/* User Bubble Color */}
            {renderColorWithAlpha(
              '用户气泡颜色',
              settings.regularUserBubbleColor,
              settings.regularUserBubbleAlpha,
              (color) => handleUpdateSetting('regularUserBubbleColor', color),
              (alpha) => handleUpdateSetting('regularUserBubbleAlpha', alpha)
            )}
            
            {/* Bot Bubble Color */}
            {renderColorWithAlpha(
              'AI气泡颜色',
              settings.regularBotBubbleColor,
              settings.regularBotBubbleAlpha,
              (color) => handleUpdateSetting('regularBotBubbleColor', color),
              (alpha) => handleUpdateSetting('regularBotBubbleAlpha', alpha)
            )}
            
            {/* User Text Color */}
            {renderTextColorSetting(
              '用户文本颜色',
              settings.regularUserTextColor,
              (color) => handleUpdateSetting('regularUserTextColor', color)
            )}
            
            {/* Bot Text Color */}
            {renderTextColorSetting(
              'AI文本颜色',
              settings.regularBotTextColor,
              (color) => handleUpdateSetting('regularBotTextColor', color)
            )}
          </View>
        )}
        
        {activeTab === 'bg-focus' && (
          <View style={styles.settingsSection}>
            <Text style={styles.sectionTitle}>背景强调模式设置</Text>
            
            {/* User Bubble Color */}
            {renderColorWithAlpha(
              '用户气泡颜色',
              settings.bgUserBubbleColor,
              settings.bgUserBubbleAlpha,
              (color) => handleUpdateSetting('bgUserBubbleColor', color),
              (alpha) => handleUpdateSetting('bgUserBubbleAlpha', alpha)
            )}
            
            {/* Bot Bubble Color */}
            {renderColorWithAlpha(
              'AI气泡颜色',
              settings.bgBotBubbleColor,
              settings.bgBotBubbleAlpha,
              (color) => handleUpdateSetting('bgBotBubbleColor', color),
              (alpha) => handleUpdateSetting('bgBotBubbleAlpha', alpha)
            )}
            
            {/* User Text Color */}
            {renderTextColorSetting(
              '用户文本颜色',
              settings.bgUserTextColor,
              (color) => handleUpdateSetting('bgUserTextColor', color)
            )}
            
            {/* Bot Text Color */}
            {renderTextColorSetting(
              'AI文本颜色',
              settings.bgBotTextColor,
              (color) => handleUpdateSetting('bgBotTextColor', color)
            )}
          </View>
        )}
        
        {activeTab === 'visual-novel' && (
          <View style={styles.settingsSection}>
            <Text style={styles.sectionTitle}>视觉小说模式设置</Text>
            
            {/* VN Dialog Color */}
            {renderColorWithAlpha(
              '对话框背景颜色',
              settings.vnDialogColor,
              settings.vnDialogAlpha,
              (color) => handleUpdateSetting('vnDialogColor', color),
              (alpha) => handleUpdateSetting('vnDialogAlpha', alpha)
            )}
            
            {/* VN Text Color */}
            {renderTextColorSetting(
              '文本颜色',
              settings.vnTextColor,
              (color) => handleUpdateSetting('vnTextColor', color)
            )}
          </View>
        )}
        
        {activeTab === 'global' && (
          <View style={styles.settingsSection}>
            <Text style={styles.sectionTitle}>全局设置</Text>
            
            {/* Bubble Padding Size */}
            {renderSizeSlider(
              '气泡内边距',
              settings.bubblePaddingMultiplier,
              (value) => handleUpdateSetting('bubblePaddingMultiplier', value)
            )}
            
            {/* Text Size */}
            {renderSizeSlider(
              '文本大小',
              settings.textSizeMultiplier,
              (value) => handleUpdateSetting('textSizeMultiplier', value)
            )}
            
            {/* Reset to Default */}
            <TouchableOpacity 
              style={styles.resetButton}
              onPress={handleResetConfirm}
            >
              <Ionicons name="refresh-circle" size={20} color="#fff" />
              <Text style={styles.resetButtonText}>重置为默认值</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Add padding to ensure bottom save button doesn't overlap content */}
        <View style={{ height: 100 }} />
      </ScrollView>
      
      {/* Save button (fixed at bottom) */}
      <View style={[styles.saveButtonContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity 
          style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
          onPress={saveSettings}
          disabled={!hasChanges || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>保存设置</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#444'
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff'
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#444'
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center'
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary
  },
  tabText: {
    fontSize: 14,
    color: '#aaa'
  },
  activeTabText: {
    color: theme.colors.primary,
    fontWeight: 'bold'
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  settingsSection: {
    marginBottom: 20
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12
  },
  settingItem: {
    marginBottom: 16
  },
  settingLabel: {
    fontSize: 14,
    color: '#ddd',
    marginBottom: 8
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  colorPicker: {
    width: 100,
    height: 40
  },
  alphaSliderContainer: {
    flex: 1,
    marginLeft: 16
  },
  alphaLabel: {
    fontSize: 12,
    color: '#aaa',
    marginBottom: 4
  },
  slider: {
    width: '100%',
    height: 40
  },
  colorPreview: {
    height: 40,
    borderRadius: 8,
    marginTop: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  sliderValue: {
    color: '#aaa',
    width: 45,
    textAlign: 'center'
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e74c3c',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16
  },
  resetButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8
  },
  saveButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(34, 34, 34, 0.9)',
    borderTopWidth: 1,
    borderTopColor: '#444',
  },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#555',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default ChatUISettingsScreen;
