import { Character, DiaryEntry, DiarySettings, } from '@/shared/types';
import { CircleMemory } from '@/shared/types/circle-types';
import { StorageAdapter } from '@/NodeST/nodest/utils/storage-adapter';
import { generateUUID } from '@/utils/uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiSettings } from '@/utils/settings-helper';
import { unifiedGenerateContent } from '@/services/unified-api';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export class DiaryService {
  private static DIARY_STORAGE_KEY = 'character_diary_entries';

  /**
   * Generate a diary entry for the character based on chat history and character settings
   */
  static async generateDiaryEntry(character: Character): Promise<DiaryEntry | null> {
    try {
      if (!character || !character.diarySettings || !character.diarySettings.enabled) {
        console.log('[DiaryService] Diary generation skipped - diary not enabled for this character');
        return null;
      }

      const settings = character.diarySettings;
      const conversationId = character.conversationId || character.id;
      
      console.log(`[DiaryService] Generating diary entry for ${character.name} (ID: ${character.id})`);
      
      // Get recent chat history
      const recentMessages = await StorageAdapter.getRecentMessages(conversationId, 30);
      const formattedHistory = recentMessages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.parts?.[0]?.text || ''
      }));

      // Format chat history for the prompt
      const chatContext = formattedHistory.length > 0 
        ? formattedHistory.map(msg => `${msg.role === 'user' ? '用户' : character.name}: ${msg.content}`).join('\n\n')
        : "今天似乎没有与用户进行对话。";

      // Get circle memories if enabled
      let circleMemoryContext = "";
      if ((settings.circleMemoryWeight ?? 0) > 0 && (settings.circleMemoryCount ?? 0) > 0) {
        try {
          // Retrieve circle memories
          const circleMemories = await StorageAdapter.getCircleMemories(
            character.id, 
            settings.circleMemoryCount
          );
          
          if (circleMemories.length > 0) {
            // Format circle memories
            circleMemoryContext = "最近的朋友圈记忆:\n" + 
              circleMemories.map(memory => {
                const date = format(new Date(memory.timestamp), 'yyyy-MM-dd HH:mm', { locale: zhCN });
                let formattedContent = "";
                
                // Get the text content from ChatMessage structure
                const memoryText = memory.parts?.[0]?.text || "";
                
                switch (memory.type) {
                  case 'newPost':
                    formattedContent = `发布了朋友圈: "${memoryText}"`;
                    break;
                  case 'replyToComment':
                    formattedContent = `评论了${memory.name || '某人'}的评论: "${memoryText}"`;
                    break;
                  case 'replyToPost':
                    formattedContent = `回复了${memory.name || '某人'}的朋友圈: "${memoryText}"`;
                    break;
                  default:
                    formattedContent = memoryText;
                }
                
                return `- ${date}: ${formattedContent}`;
              }).join('\n');
          } else {
            circleMemoryContext = "最近没有朋友圈活动记录。";
          }
        } catch (error) {
          console.error('[DiaryService] Error retrieving circle memories:', error);
          circleMemoryContext = "获取朋友圈记忆时出现错误。";
        }
      }

      // Get character details from jsonData if available
      let characterInfo = "";
      if (character.jsonData) {
        try {
          const jsonData = JSON.parse(character.jsonData);
          characterInfo = `
姓名: ${jsonData.name || character.name}
人设描述: ${jsonData.description || character.description || ""}
性格: ${jsonData.personality || ""}
场景/背景: ${jsonData.scenario || ""}
示例对话: ${jsonData.mes_example || ""}`;
        } catch (error) {
          console.error('[DiaryService] Error parsing character JSON data:', error);
          characterInfo = `
姓名: ${character.name}
描述: ${character.description || ""}`;
        }
      } else {
        characterInfo = `
姓名: ${character.name}
描述: ${character.description || ""}`;
      }

      // Get world info (placeholder for future expansion)
      const worldInfo = `
当前日期: ${new Date().toLocaleDateString('zh-CN')}
当前时间: ${new Date().toLocaleTimeString('zh-CN')}`;

      // 获取前一天的日记内容
      let previousDiaryContent = '';
      try {
        const allEntries = await this.getDiaryEntriesByCharacterId(character.id);
        // 找到前一天的日记（不是今天的最新一条）
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const prevEntry = allEntries
          .filter(entry => {
            const entryDate = new Date(entry.createdAt);
            entryDate.setHours(0, 0, 0, 0);
            return entryDate.getTime() < today.getTime();
          })
          .sort((a, b) => b.createdAt - a.createdAt)[0];
        if (prevEntry) {
          previousDiaryContent = prevEntry.content;
        }
      } catch (e) {
        // 忽略错误
      }

      // Build the prompt
      const prompt = `你是一位名为${character.name}的角色，需要写一篇日记来反思今天的经历。

日记撰写指南:
1. 反思目标: ${settings.reflectionGoal || "思考如何更好地与用户建立情感连接"}
2. 日记应当是从${character.name}的第一人称视角撰写的
3. 内容应该基于以下信息(按照给定的权重来分配关注度):
   - 聊天记录 (权重: ${settings.contextWeight || 5}/10)
   - 角色设定 (权重: ${settings.characterWeight || 4}/10)
   - 世界信息 (权重: ${settings.worldInfoWeight || 2}/10)
   - 对话策略调整 (权重: ${settings.strategicWeight || 3}/10)
   - 朋友圈记忆 (权重: ${settings.circleMemoryWeight || 2}/10)
4. 日记内容应约${settings.wordCount || 300}字左右
5. 不要机械地重复聊天记录，而是应该深入思考并展现${character.name}的内心独白
6. 日记内容应该保持一致的语气和风格，与角色设定相符
7. 请参考前一天的日记内容，结合今天的经历进行反思${previousDiaryContent ? '（前一天的日记内容已提供）' : '（如有）'}

角色设定:
${characterInfo}

世界信息:
${worldInfo}

${previousDiaryContent ? `前一天的日记内容:
${previousDiaryContent}

` : ''}${circleMemoryContext ? `朋友圈记忆:
${circleMemoryContext}

` : ''}最近的聊天记录:
${chatContext}

请直接开始撰写日记，不要有任何前缀或标题，符合${character.name}的风格。`;

      // Get API settings from settings-helper
      const apiSettings = getApiSettings();
      
      if (!apiSettings.apiKey && !apiSettings.useCloudService) {
        throw new Error('No API key available and cloud service is disabled');
      }

      // Prepare unified API options based on provider
      let unifiedOptions: any = {
        adapter: apiSettings.apiProvider as any,
        apiKey: apiSettings.apiKey,
        characterId: character.id
      };

      // Configure provider-specific options
      if (apiSettings.apiProvider === 'openai-compatible' && apiSettings.OpenAIcompatible?.enabled) {
        unifiedOptions.openaiConfig = {
          endpoint: apiSettings.OpenAIcompatible.endpoint,
          model: apiSettings.OpenAIcompatible.model,
          temperature: apiSettings.OpenAIcompatible.temperature,
          max_tokens: apiSettings.OpenAIcompatible.max_tokens,
          stream: apiSettings.OpenAIcompatible.stream
        };
        unifiedOptions.modelId = apiSettings.OpenAIcompatible.model;
      } else if (apiSettings.apiProvider === 'openrouter' && apiSettings.openrouter?.enabled) {
        unifiedOptions.openrouterConfig = {
          enabled: true,
          apiKey: apiSettings.openrouter.apiKey,
          model: apiSettings.openrouter.model
        };
        unifiedOptions.modelId = apiSettings.openrouter.model;
      } else if (apiSettings.apiProvider === 'gemini') {
        unifiedOptions.geminiConfig = {
          additionalKeys: apiSettings.additionalGeminiKeys,
          useKeyRotation: apiSettings.useGeminiKeyRotation,
          useModelLoadBalancing: apiSettings.useGeminiModelLoadBalancing,
          backupModel: apiSettings.geminiBackupModel,
          retryDelay: apiSettings.retryDelay
        };
        unifiedOptions.modelId = apiSettings.geminiPrimaryModel;
      }

      // Create messages array for unified API
      const messages = [
        {
          role: 'user',
          content: prompt
        }
      ];

      // Generate diary content using unified API
      const response = await unifiedGenerateContent(messages, unifiedOptions);

      if (!response) {
        throw new Error('Failed to generate diary content');
      }

      const diaryEntry: DiaryEntry = {
        id: generateUUID(),
        characterId: character.id,
        content: response,
        createdAt: Date.now(),
        reflectionGoal: settings.reflectionGoal || '',
        contextWeight: settings.contextWeight || 5,
        characterWeight: settings.characterWeight || 4,
        worldInfoWeight: settings.worldInfoWeight || 2,
        strategicWeight: settings.strategicWeight || 3,
        circleMemoryWeight: settings.circleMemoryWeight || 2,
        circleMemoryCount: settings.circleMemoryCount || 0
      };

      // Save diary entry
      await this.saveDiaryEntry(diaryEntry);
      console.log(`[DiaryService] Diary entry generated successfully for ${character.name}`);

      return diaryEntry;
    } catch (error) {
      console.error('[DiaryService] Error generating diary entry:', error);
      return null;
    }
  }

  /**
   * Save a diary entry to storage
   */
  static async saveDiaryEntry(entry: DiaryEntry): Promise<boolean> {
    try {
      // Get existing diary entries
      const entries = await this.getDiaryEntriesByCharacterId(entry.characterId) || [];
      
      // Add the new entry
      entries.push(entry);
      
      // Save the updated entries
      await this.saveEntriesToStorage(entry.characterId, entries);
      
      return true;
    } catch (error) {
      console.error('[DiaryService] Error saving diary entry:', error);
      return false;
    }
  }

  /**
   * Delete a diary entry from storage
   * @param characterId The character identifier
   * @param entryId The entry identifier to delete
   * @returns True if successful, false otherwise
   */
  static async deleteDiaryEntry(characterId: string, entryId: string): Promise<boolean> {
    try {
      // Get existing diary entries
      const entries = await this.getDiaryEntriesByCharacterId(characterId) || [];
      
      // Filter out the entry to delete
      const updatedEntries = entries.filter(entry => entry.id !== entryId);
      
      // If no entry was removed (entry not found), return false
      if (updatedEntries.length === entries.length) {
        console.warn(`[DiaryService] Attempted to delete non-existent diary entry: ${entryId}`);
        return false;
      }
      
      // Save the updated entries
      await this.saveEntriesToStorage(characterId, updatedEntries);
      
      console.log(`[DiaryService] Successfully deleted diary entry: ${entryId}`);
      return true;
    } catch (error) {
      console.error('[DiaryService] Error deleting diary entry:', error);
      return false;
    }
  }

  /**
   * Check if a diary entry should be triggered
   */
  static shouldTriggerDiaryEntry(settings: DiarySettings): boolean {
    if (!settings || !settings.enabled) return false;
    
    const now = Date.now();
    const lastTriggered = settings.lastTriggered || 0;
    
    // If manual trigger, always return false (only triggered by user)
    if (settings.triggerInterval === 'manual') {
      return false;
    }
    
    // For daily trigger
    if (settings.triggerInterval === 'daily') {
      if (!settings.triggerTime) return false;
      
      const [hours, minutes] = settings.triggerTime.split(':').map(Number);
      const triggerDate = new Date();
      triggerDate.setHours(hours, minutes, 0, 0);
      
      // If last trigger was before today's trigger time and current time is after trigger time
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      return lastTriggered < today.getTime() && now >= triggerDate.getTime();
    }
    
    // For hourly triggers (e.g., '2hours', '4hours')
    if (settings.triggerInterval.includes('hours')) {
      const hours = parseInt(settings.triggerInterval.replace('hours', ''));
      const interval = hours * 60 * 60 * 1000;
      
      return (now - lastTriggered) >= interval;
    }
    
    return false;
  }

  /**
   * Update the last triggered time for a character's diary
   */
  static async updateLastTriggered(characterId: string): Promise<void> {
    try {
      const storageKey = `diary_settings_${characterId}`;
      const settingsJson = await AsyncStorage.getItem(storageKey);
      
      if (settingsJson) {
        const settings: DiarySettings = JSON.parse(settingsJson);
        settings.lastTriggered = Date.now();
        
        await AsyncStorage.setItem(storageKey, JSON.stringify(settings));
      }
    } catch (error) {
      console.error('[DiaryService] Error updating last triggered time:', error);
    }
  }

  /**
   * Get diary settings for a character
   */
  static async getDiarySettings(characterId: string): Promise<DiarySettings | null> {
    try {
      const storageKey = `diary_settings_${characterId}`;
      const settingsJson = await AsyncStorage.getItem(storageKey);
      
      if (settingsJson) {
        return JSON.parse(settingsJson);
      }
      
      // Return default settings if none exist
      return {
        enabled: false,
        reflectionGoal: "思考如何更好地与用户建立情感连接",
        wordCount: 300,
        contextWeight: 5,
        characterWeight: 4,
        worldInfoWeight: 2,
        strategicWeight: 3,
        circleMemoryWeight: 2, // Default weight for circle memories
        circleMemoryCount: 5,  // Default number of circle memories to include
        confidenceThreshold: 0.7,
        triggerInterval: 'daily',
        triggerTime: '20:00'
      };
    } catch (error) {
      console.error('[DiaryService] Error getting diary settings:', error);
      return null;
    }
  }

  /**
   * Save diary settings for a character
   */
  static async saveDiarySettings(characterId: string, settings: DiarySettings): Promise<boolean> {
    try {
      const storageKey = `diary_settings_${characterId}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(settings));
      return true;
    } catch (error) {
      console.error('[DiaryService] Error saving diary settings:', error);
      return false;
    }
  }

  /**
   * Get all diary entries for a character
   */
  static async getDiaryEntriesByCharacterId(characterId: string): Promise<DiaryEntry[]> {
    try {
      const allEntries = await this.getAllEntries();
      return allEntries.filter(entry => entry.characterId === characterId);
    } catch (error) {
      console.error('[DiaryService] Error getting diary entries:', error);
      return [];
    }
  }

  /**
   * Get all diary entries
   */
  private static async getAllEntries(): Promise<DiaryEntry[]> {
    try {
      const entriesJson = await AsyncStorage.getItem(this.DIARY_STORAGE_KEY);
      return entriesJson ? JSON.parse(entriesJson) : [];
    } catch (error) {
      console.error('[DiaryService] Error getting all diary entries:', error);
      return [];
    }
  }

  /**
   * Save entries to storage
   */
  private static async saveEntriesToStorage(characterId: string, entries: DiaryEntry[]): Promise<void> {
    try {
      // Get all entries
      const allEntries = await this.getAllEntries();
      
      // Remove existing entries for this character
      const filteredEntries = allEntries.filter(entry => entry.characterId !== characterId);
      
      // Add the new entries
      const updatedEntries = [...filteredEntries, ...entries];
      
      // Save the updated entries
      await AsyncStorage.setItem(this.DIARY_STORAGE_KEY, JSON.stringify(updatedEntries));
    } catch (error) {
      console.error('[DiaryService] Error saving entries to storage:', error);
    }
  }
}
