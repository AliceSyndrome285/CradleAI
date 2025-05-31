import { GeminiAdapter } from '@/NodeST/nodest/utils/gemini-adapter';
import { OpenAIAdapter, OpenAICompatibleConfig } from '@/NodeST/nodest/utils/openai-adapter';
import { OpenRouterAdapter } from '@/utils/openrouter-adapter';

// 支持的适配器类型
type AdapterType = 'gemini' | 'openai-compatible' | 'openrouter';

// 标准消息格式（兼容OpenAI/Gemini/OpenRouter）
type UnifiedMessage = 
  | { role: string; content: string } // OpenAI/OpenRouter
  | { role: string; parts: { text: string }[] }; // Gemini

interface UnifiedApiOptions {
  adapter: AdapterType;
  apiKey?: string;
  modelId?: string;
  characterId?: string;
  openaiConfig?: Partial<OpenAICompatibleConfig>;
  openrouterConfig?: {
    enabled?: boolean;
    apiKey?: string;
    model?: string;
    additionalKeys?: string[];
    useKeyRotation?: boolean;
    backupModel?: string;
    retryDelay?: number;
  };
  geminiConfig?: {
    additionalKeys?: string[];
    useKeyRotation?: boolean;
    useModelLoadBalancing?: boolean;
    backupModel?: string;
    retryDelay?: number;
  };
  // 其他可扩展参数
}

/**
 * 统一API服务：根据适配器类型和参数，调用对应适配器的文本生成方法
 * @param messages 消息数组（格式兼容OpenAI/Gemini/OpenRouter）
 * @param options 适配器类型及API设置信息
 * @returns Promise<string> 响应文本
 */
export async function unifiedGenerateContent(
  messages: UnifiedMessage[],
  options: UnifiedApiOptions
): Promise<string> {
  const { adapter, apiKey, modelId, characterId } = options;

  if (adapter === 'gemini') {
    // GeminiAdapter: 支持OpenAI格式和Gemini格式消息
    // 自动适配消息格式
    let geminiMessages;
    if (messages.length > 0 && (messages[0] as any).parts) {
      geminiMessages = messages as any;
    } else {
      geminiMessages = messages.map(msg => ({
        role: msg.role,
        parts: [{ text: (msg as any).content }]
      }));
    }
    // 支持可选配置
    if (typeof GeminiAdapter.executeDirectGenerateContent === 'function') {
      return await GeminiAdapter.executeDirectGenerateContent(geminiMessages, {
        apiKey,
        characterId,
        modelId
      });
    }
    throw new Error('GeminiAdapter 不支持 executeDirectGenerateContent');
  }

  if (adapter === 'openai-compatible') {
    // OpenAIAdapter: 需要将消息转换为ChatMessage格式
    const chatMessages = messages.map(msg => ({
      role: msg.role,
      parts: [{ text: ('content' in msg ? (msg as any).content : (msg as any).parts?.[0]?.text || '') }]
    }));
    // 支持可选配置
    if (typeof OpenAIAdapter.prototype.generateContent === 'function') {
      // 直接用静态方法（如有），否则实例化
      if (typeof (OpenAIAdapter as any).executeDirectGenerateContent === 'function') {
        return await (OpenAIAdapter as any).executeDirectGenerateContent(chatMessages, {
          apiKey,
          characterId,
          modelId,
          ...(options.openaiConfig || {})
        });
      } else {
        // fallback: 实例化
        const config: OpenAICompatibleConfig = {
          endpoint: options.openaiConfig?.endpoint || '',
          apiKey: apiKey || '',
          model: modelId || options.openaiConfig?.model || 'gpt-3.5-turbo'
        };
        const adapterInstance = new OpenAIAdapter(config);
        return await adapterInstance.generateContent(chatMessages, characterId);
      }
    }
    throw new Error('OpenAIAdapter 不支持 generateContent');
  }

  if (adapter === 'openrouter') {
    // OpenRouterAdapter: 只支持OpenAI/OpenRouter消息格式
    const openrouterMessages = messages.map(msg =>
      'content' in msg ? { role: msg.role, content: (msg as any).content } : {
        role: msg.role,
        content: (msg as any).parts?.[0]?.text || ''
      }
    );
    if (typeof OpenRouterAdapter.executeDirectGenerateContent === 'function') {
      return await OpenRouterAdapter.executeDirectGenerateContent(openrouterMessages, {
        apiKey,
        characterId,
        modelId,
        ...(options.openrouterConfig || {})
      });
    } else {
      // fallback: 实例化
      const adapterInstance = new OpenRouterAdapter(
        apiKey || '',
        modelId || 'openai/gpt-3.5-turbo',
        options.openrouterConfig
      );
      return await adapterInstance.generateContent(openrouterMessages, characterId);
    }
  }

  throw new Error(`不支持的适配器类型: ${adapter}`);
}
