import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';

export interface AudioCacheEntry {
  messageId: string;
  conversationId: string;
  filePath: string;
  timestamp: number;
  isComplete: boolean;
}

export interface AudioState {
  isLoading: boolean;
  hasAudio: boolean;
  isPlaying: boolean;
  isComplete: boolean;
  error: string | null;
}

export class AudioCacheManager {
  private readonly MAX_AUDIO_CACHE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB
  private readonly TARGET_AUDIO_CACHE_SIZE_BYTES = 70 * 1024 * 1024; // 70MB
  private static instance: AudioCacheManager;
  private readonly AUDIO_CACHE_DIR = `${FileSystem.documentDirectory}audio_cache/`;
  private readonly AUDIO_FILE_MAP_KEY = 'audio_file_map';
  private audioFileMap: Map<string, string> = new Map(); // messageId -> filePath
  private audioStates: Map<string, AudioState> = new Map(); // messageId -> state
  private soundMap: Map<string, Audio.Sound> = new Map(); // messageId -> sound instance

  private async evictOldestFiles(bytesToFree: number): Promise<void> {
    console.log(`[AudioCacheManager] Attempting to free ${bytesToFree} bytes...`);
    try {
      const evictableEntries: Array<{ messageId: string, filePath: string, timestamp: number, size: number }> = [];
      for (const [messageId, filePath] of this.audioFileMap.entries()) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(filePath);
          if (!fileInfo.exists || !('size' in fileInfo)) {
            console.warn(`[AudioCacheManager] File not found or size unavailable for eviction: ${filePath}`);
            continue;
          }
          // Using fileInfo.modificationTime as timestamp for eviction logic.
          // If AudioState had a more reliable lastAccessed timestamp, it would be preferred.
          const timestamp = fileInfo.modificationTime || Date.now();
          evictableEntries.push({ messageId, filePath, timestamp, size: fileInfo.size });
        } catch (infoError) {
          console.warn(`[AudioCacheManager] Error getting info for ${filePath}:`, infoError);
        }
      }

      evictableEntries.sort((a, b) => a.timestamp - b.timestamp); // Oldest first

      let bytesFreed = 0;
      for (const oldestEntry of evictableEntries) {
        if (bytesFreed >= bytesToFree) {
          break;
        }
        console.log(`[AudioCacheManager] Evicting: ${oldestEntry.filePath}, size: ${oldestEntry.size}, timestamp: ${new Date(oldestEntry.timestamp).toISOString()}`);
        try {
          await FileSystem.deleteAsync(oldestEntry.filePath, { idempotent: true });
          this.audioFileMap.delete(oldestEntry.messageId);
          this.audioStates.delete(oldestEntry.messageId);
          const sound = this.soundMap.get(oldestEntry.messageId);
          if (sound) {
            await sound.unloadAsync().catch(e => console.warn(`Error unloading sound for ${oldestEntry.messageId}`, e));
            this.soundMap.delete(oldestEntry.messageId);
          }
          bytesFreed += oldestEntry.size;
        } catch (deleteError) {
          console.error(`[AudioCacheManager] Error evicting file ${oldestEntry.filePath}:`, deleteError);
        }
      }
      console.log(`[AudioCacheManager] Freed ${bytesFreed} bytes.`);
      await this.saveAudioFileMap();
      await this.saveAudioStates();
    } catch (error) {
      console.error('[AudioCacheManager] Error during eviction process:', error);
    }
  }

  private async ensureCacheCapacity(newFileSizeEstimate: number): Promise<void> {
    try {
      const currentSize = await this.getCacheSize();
      if (currentSize + newFileSizeEstimate > this.MAX_AUDIO_CACHE_SIZE_BYTES) {
        const bytesToEvict = (currentSize + newFileSizeEstimate) - this.TARGET_AUDIO_CACHE_SIZE_BYTES;
        console.log(`[AudioCacheManager] Cache limit (${this.MAX_AUDIO_CACHE_SIZE_BYTES} bytes) exceeded. Current: ${currentSize}, NewFile: ${newFileSizeEstimate}. Need to evict ${bytesToEvict} bytes to reach target ${this.TARGET_AUDIO_CACHE_SIZE_BYTES}.`);
        await this.evictOldestFiles(bytesToEvict);
      }
    } catch (error) {
      console.error('[AudioCacheManager] Error ensuring cache capacity:', error);
    }
  }

  private constructor() {
    this.initializeCache();
  }

  public static getInstance(): AudioCacheManager {
    if (!AudioCacheManager.instance) {
      AudioCacheManager.instance = new AudioCacheManager();
    }
    return AudioCacheManager.instance;
  }

  /**
   * 初始化缓存系统
   */
  private async initializeCache(): Promise<void> {
    try {
      await FileSystem.makeDirectoryAsync(this.AUDIO_CACHE_DIR, { intermediates: true });
      await this.loadPersistedAudioFileMap();
      await this.loadPersistedAudioStates();
      console.log('[AudioCacheManager] Cache initialized successfully');
    } catch (error) {
      console.error('[AudioCacheManager] Failed to initialize cache:', error);
    }
  }

  /**
   * 加载持久化的音频文件映射
   */
  private async loadPersistedAudioFileMap(): Promise<void> {
    try {
      const mapJson = await AsyncStorage.getItem(this.AUDIO_FILE_MAP_KEY);
      if (!mapJson) return;

      const persistedMap: Record<string, string> = JSON.parse(mapJson);
      console.log(`[AudioCacheManager] Loading ${Object.keys(persistedMap).length} persisted audio files`);

      // 验证每个音频文件是否存在
      for (const [messageId, filePath] of Object.entries(persistedMap)) {
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        if (fileInfo.exists) {
          this.audioFileMap.set(messageId, filePath);
          // 初始化音频状态为已缓存
          this.audioStates.set(messageId, {
            isLoading: false,
            hasAudio: true,
            isPlaying: false,
            isComplete: true,
            error: null,
          });
          console.log(`[AudioCacheManager] Restored audio for message: ${messageId}`);
        } else {
          console.log(`[AudioCacheManager] Audio file not found, removing: ${filePath}`);
          // 文件不存在，从映射中移除
          delete persistedMap[messageId];
        }
      }

      // 保存清理后的映射
      await AsyncStorage.setItem(this.AUDIO_FILE_MAP_KEY, JSON.stringify(persistedMap));
    } catch (error) {
      console.error('[AudioCacheManager] Failed to load persisted audio file map:', error);
    }
  }

  /**
   * 保存音频文件映射到持久化存储
   */
  private async saveAudioFileMap(): Promise<void> {
    try {
      const mapObject: Record<string, string> = {};
      this.audioFileMap.forEach((filePath, messageId) => {
        mapObject[messageId] = filePath;
      });
      await AsyncStorage.setItem(this.AUDIO_FILE_MAP_KEY, JSON.stringify(mapObject));
    } catch (error) {
      console.error('[AudioCacheManager] Failed to save audio file map:', error);
    }
  }

  /**
   * 生成音频文件路径
   */
  private generateAudioFilePath(conversationId: string, messageId: string): string {
    const timestamp = Date.now();
    const filename = `${conversationId}_${messageId}_${timestamp}.mp3`;
    return `${this.AUDIO_CACHE_DIR}${filename}`;
  }

  /**
   * 下载远程音频文件，支持多种方式（复用MinimaxTTS的多层fallback机制）
   */
  private async downloadAudioFileWithFallback(audioUrl: string, filePath: string): Promise<string> {
    // For web, just return the URL
    if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
      return audioUrl;
    }
    try {
      // Validate URL
      if (!audioUrl || (!audioUrl.startsWith('http://') && !audioUrl.startsWith('https://'))) {
        throw new Error('Invalid audio URL format');
      }
      // Clean and encode the URL properly
      const cleanUrl = encodeURI(decodeURI(audioUrl));
      // Try downloading with explicit headers
      const downloadResult = await FileSystem.downloadAsync(
        cleanUrl,
        filePath,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Expo FileSystem)',
            'Accept': 'audio/mpeg, audio/wav, audio/*, */*',
          },
        }
      );
      if (downloadResult.status === 200) {
        return downloadResult.uri;
      } else {
        throw new Error(`Download failed with status: ${downloadResult.status}`);
      }
    } catch (error) {
      // Try alternative approach: fetch + base64
      try {
        const response = await fetch(audioUrl);
        if (!response.ok) {
          throw new Error(`Fetch failed with status: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        // @ts-ignore
        const base64 = typeof Buffer !== 'undefined'
          ? Buffer.from(arrayBuffer).toString('base64')
          : btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        await FileSystem.writeAsStringAsync(filePath, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        return filePath;
      } catch (fetchError) {
        // Final fallback: return the original URL for direct streaming
        return audioUrl;
      }
    }
  }

  /**
   * 缓存音频文件
   */
  public async cacheAudioFile(
    messageId: string,
    conversationId: string,
    audioPath: string
  ): Promise<string> {
    try {
      // 检查是否已经缓存
      const existingPath = this.audioFileMap.get(messageId);
      if (existingPath) {
        const fileInfo = await FileSystem.getInfoAsync(existingPath);
        if (fileInfo.exists) {
          console.log(`[AudioCacheManager] Audio already cached for message: ${messageId}`);
          return existingPath;
        }
      }

      // 生成新的缓存路径
      const cachedPath = this.generateAudioFilePath(conversationId, messageId);

      let localAudioPath = audioPath;
      // 判断 audioPath 是否为远程 URL
      if (/^https?:\/\//.test(audioPath)) {
        console.log(`[AudioCacheManager] Downloading remote audio: ${audioPath}`);
        // 使用多种下载方式
        localAudioPath = await this.downloadAudioFileWithFallback(audioPath, cachedPath);
      } else if (/^file:\/\//.test(audioPath) || audioPath.startsWith(FileSystem.documentDirectory || '')) {
        // 本地文件，直接复制
        await FileSystem.copyAsync({
          from: audioPath,
          to: cachedPath,
        });
        localAudioPath = cachedPath;
      } else {
        // 既不是远程URL，也不是本地文件，直接报错
        throw new Error(`Unsupported audioPath format: ${audioPath}`);
      }

      // Get file info for the newly cached file to check its size
      const newFileInfo = await FileSystem.getInfoAsync(localAudioPath);
      if (!newFileInfo.exists || !('size' in newFileInfo) || typeof newFileInfo.size !== 'number') {
        console.error(`[AudioCacheManager] Failed to get size for cached file: ${localAudioPath}. Skipping cache capacity check for this file.`);
        // Optionally, delete the file if size cannot be determined, or handle as per requirements
        // For now, we'll proceed without adding it to the map if size is critical,
        // or assume 0 if it's acceptable to proceed with an unknown size (not recommended for cache management).
        // throw new Error(`Failed to get size for cached file: ${localAudioPath}`);
      } else {
        await this.ensureCacheCapacity(newFileInfo.size);
      }

      // 更新映射
      this.audioFileMap.set(messageId, localAudioPath);
      await this.saveAudioFileMap();

      console.log(`[AudioCacheManager] Cached audio for message ${messageId} at ${localAudioPath}`);
      return localAudioPath;
    } catch (error) {
      console.error('[AudioCacheManager] Failed to cache audio file:', error);
      throw error;
    }
  }

  /**
   * 获取音频文件路径
   */
  public getAudioFilePath(messageId: string): string | null {
    return this.audioFileMap.get(messageId) || null;
  }

  /**
   * 获取音频状态
   */
  public getAudioState(messageId: string): AudioState | null {
    return this.audioStates.get(messageId) || null;
  }

  /**
   * 更新音频状态
   */
  public updateAudioState(messageId: string, state: Partial<AudioState>): void {
    const currentState = this.audioStates.get(messageId) || {
      isLoading: false,
      hasAudio: false,
      isPlaying: false,
      isComplete: false,
      error: null
    };

    const newState = { ...currentState, ...state };
    this.audioStates.set(messageId, newState);
    
    // 异步保存状态到持久化存储
    this.saveAudioStates().catch(error => {
      console.error('[AudioCacheManager] Failed to save audio state:', error);
    });

    console.log(`[AudioCacheManager] Updated audio state for ${messageId}:`, newState);
  }

  /**
   * 获取或创建音频实例
   */
  public async getAudioSound(messageId: string): Promise<Audio.Sound | null> {
    const filePath = this.audioFileMap.get(messageId);
    if (!filePath) return null;

    // 检查是否已有音频实例
    let sound = this.soundMap.get(messageId);
    if (sound) {
      return sound;
    }

    // 创建新的音频实例
    try {
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: filePath },
        { shouldPlay: false }
      );
      this.soundMap.set(messageId, newSound);
      return newSound;
    } catch (error) {
      console.error('[AudioCacheManager] Failed to create audio sound:', error);
      return null;
    }
  }

  /**
   * 清理特定会话的音频文件
   */
  public async clearConversationAudio(conversationId: string): Promise<void> {
    try {
      const filesToDelete: string[] = [];
      const messagesToRemove: string[] = [];

      // 找到属于指定会话的音频文件
      this.audioFileMap.forEach((filePath, messageId) => {
        if (filePath.includes(`${conversationId}_`)) {
          filesToDelete.push(filePath);
          messagesToRemove.push(messageId);
        }
      });

      // 删除音频文件
      for (const filePath of filesToDelete) {
        try {
          await FileSystem.deleteAsync(filePath, { idempotent: true });
        } catch (error) {
          console.error(`[AudioCacheManager] Failed to delete file ${filePath}:`, error);
        }
      }

      // 清理内存中的映射和状态
      for (const messageId of messagesToRemove) {
        this.audioFileMap.delete(messageId);
        this.audioStates.delete(messageId);
        
        // 卸载音频实例
        const sound = this.soundMap.get(messageId);
        if (sound) {
          try {
            await sound.unloadAsync();
          } catch (error) {
            console.error(`[AudioCacheManager] Failed to unload sound for ${messageId}:`, error);
          }
          this.soundMap.delete(messageId);
        }
      }

      // 保存更新后的映射
      await this.saveAudioFileMap();

      console.log(`[AudioCacheManager] Cleared ${messagesToRemove.length} audio files for conversation ${conversationId}`);
    } catch (error) {
      console.error('[AudioCacheManager] Failed to clear conversation audio:', error);
    }
  }

  /**
   * 清理所有音频缓存
   */
  public async clearAllAudio(): Promise<void> {
    try {
      // 停止并卸载所有音频实例
      for (const [messageId, sound] of this.soundMap) {
        try {
          await sound.unloadAsync();
        } catch (error) {
          console.error(`[AudioCacheManager] Failed to unload sound for ${messageId}:`, error);
        }
      }

      // 删除缓存目录
      await FileSystem.deleteAsync(this.AUDIO_CACHE_DIR, { idempotent: true });

      // 清理内存
      this.audioFileMap.clear();
      this.audioStates.clear();
      this.soundMap.clear();

      // 清理持久化存储
      await AsyncStorage.removeItem(this.AUDIO_FILE_MAP_KEY);

      // 重新创建缓存目录
      await FileSystem.makeDirectoryAsync(this.AUDIO_CACHE_DIR, { intermediates: true });

      console.log('[AudioCacheManager] Cleared all audio cache');
    } catch (error) {
      console.error('[AudioCacheManager] Failed to clear all audio:', error);
    }
  }

  /**
   * 获取缓存大小
   */
  public async getCacheSize(): Promise<number> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.AUDIO_CACHE_DIR);
      if (!dirInfo.exists) return 0;

      const files = await FileSystem.readDirectoryAsync(this.AUDIO_CACHE_DIR);
      let totalSize = 0;

      for (const file of files) {
        const filePath = `${this.AUDIO_CACHE_DIR}${file}`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        if (fileInfo.exists && 'size' in fileInfo) {
          totalSize += fileInfo.size || 0;
        }
      }

      return totalSize;
    } catch (error) {
      console.error('[AudioCacheManager] Failed to get cache size:', error);
      return 0;
    }
  }

  /**
   * 获取所有音频状态（用于组件状态同步）
   */
  public getAllAudioStates(): Record<string, AudioState> {
    const states: Record<string, AudioState> = {};
    this.audioStates.forEach((state, messageId) => {
      states[messageId] = state;
    });
    return states;
  }

  /**
   * 批量更新音频状态（用于组件状态同步）
   */
  public setAllAudioStates(states: Record<string, AudioState>): void {
    this.audioStates.clear();
    Object.entries(states).forEach(([messageId, state]) => {
      this.audioStates.set(messageId, state);
    });
  }

  /**
   * 停止所有正在播放的音频
   */
  public async stopAllAudio(): Promise<void> {
    for (const [messageId, sound] of this.soundMap) {
      try {
        const status = await sound.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await sound.stopAsync();
          this.updateAudioState(messageId, { isPlaying: false });
        }
      } catch (error) {
        console.error(`[AudioCacheManager] Failed to stop audio for ${messageId}:`, error);
      }
    }
  }

  /**
   * 检查消息是否有缓存的音频文件
   */
  public async checkCachedAudio(messageId: string): Promise<boolean> {
    try {
      const filePath = this.audioFileMap.get(messageId);
      if (!filePath) return false;

      const fileInfo = await FileSystem.getInfoAsync(filePath);
      return fileInfo.exists;
    } catch (error) {
      console.error(`[AudioCacheManager] Failed to check cached audio for ${messageId}:`, error);
      return false;
    }
  }

  /**
   * 为多个消息批量检查缓存状态并更新内存状态
   */
  public async initializeAudioStatesForMessages(messageIds: string[]): Promise<void> {
    try {
      for (const messageId of messageIds) {
        const hasCachedAudio = await this.checkCachedAudio(messageId);
        if (hasCachedAudio) {
          this.updateAudioState(messageId, {
            isLoading: false,
            hasAudio: true,
            isPlaying: false,
            isComplete: false,
            error: null
          });
        }
      }
      console.log(`[AudioCacheManager] Initialized audio states for ${messageIds.length} messages`);
    } catch (error) {
      console.error('[AudioCacheManager] Failed to initialize audio states:', error);
    }
  }

  /**
   * 获取会话的所有缓存音频消息ID
   */
  public getConversationCachedAudioIds(conversationId: string): string[] {
    const cachedIds: string[] = [];
    for (const [messageId, filePath] of this.audioFileMap.entries()) {
      if (filePath.includes(`${conversationId}_`)) {
        cachedIds.push(messageId);
      }
    }
    return cachedIds;
  }

  /**
   * 从 AsyncStorage 加载持久化的音频状态
   */
  private async loadPersistedAudioStates(): Promise<void> {
    try {
      const statesJson = await AsyncStorage.getItem('audio_states_map');
      if (statesJson) {
        const parsedStates = JSON.parse(statesJson);
        // 恢复为 Map 格式
        for (const [messageId, state] of Object.entries(parsedStates)) {
          this.audioStates.set(messageId, state as AudioState);
        }
        console.log(`[AudioCacheManager] Loaded ${Object.keys(parsedStates).length} persisted audio states`);
      }
    } catch (error) {
      console.error('[AudioCacheManager] Failed to load persisted audio states:', error);
    }
  }

  /**
   * 保存音频状态到 AsyncStorage
   */
  private async saveAudioStates(): Promise<void> {
    try {
      const statesObject: Record<string, AudioState> = {};
      for (const [messageId, state] of this.audioStates.entries()) {
        statesObject[messageId] = state;
      }
      await AsyncStorage.setItem('audio_states_map', JSON.stringify(statesObject));
    } catch (error) {
      console.error('[AudioCacheManager] Failed to save audio states:', error);
    }
  }
}

export default AudioCacheManager;