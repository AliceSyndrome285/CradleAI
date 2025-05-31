import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  Dimensions,
  FlatList,
  ActivityIndicator,
  Platform,
  StatusBar,
  Switch,
  Share
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as TableMemory from '@/src/memory/plugins/table-memory';
import { initializeTableMemory, isTableMemoryEnabled, setTableMemoryEnabled } from '@/src/memory/integration/table-memory-integration';
import { useMemoryContext } from '@/src/memory/providers/MemoryProvider';
import Mem0Service from '@/src/memory/services/Mem0Service';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import TextEditorModal from './common/TextEditorModal';
import { memoryService } from '@/services/memory-service';
import { StorageAdapter } from '@/NodeST/nodest/utils/storage-adapter';
import { getApiSettings } from '@/utils/settings-helper'; // Add this import

interface MemoOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  characterId?: string;
  conversationId?: string;
  customUserName?: string; // 新增
}
interface SimpleSheet {
  uid: string;
  name: string;
  cells: any[];
  characterId: string;
  conversationId: string;
  templateId: string; // Add the missing properties
  createdAt: string;
  updatedAt: string;
}

// Define interface for memory facts
interface MemoryFact {
  id: string;
  memory: string;
  score?: number;
  createdAt?: string;
  updatedAt?: string;
  metadata?: any;
  agentId?: string;
  userId?: string;
  runId?: string;
}

// Define tabs for the UI
enum TabType {
  SUMMARY = 'summary', // 新增
  TEMPLATES = 'templates',
  TABLES = 'tables',
  SETTINGS = 'settings',
  FACTS = 'facts' // Added new tab for memory facts
}

// Constants for DB size warnings
const DB_SIZE_WARNING_THRESHOLD = 50;
const DB_SIZE_ALERT_THRESHOLD = 100;
const SETTINGS_STORAGE_KEY = 'MemoryProcessingControl:settings';
const TABLE_MEMORY_ENABLED_KEY = 'MemoOverlay:tableMemoryEnabled';
// Main component
const MemoOverlay: React.FC<MemoOverlayProps> = ({ isVisible, onClose, characterId, conversationId, customUserName }) => {
  // State for tabs and loading
  const [activeTab, setActiveTab] = useState<TabType>(TabType.TABLES);
  const [loading, setLoading] = useState<boolean>(false);
  const [initialized, setInitialized] = useState<boolean>(false);
  
  // State for templates - update to have allTemplates separate from selectedTemplates
  
  const [allTemplates, setAllTemplates] = useState<TableMemory.SheetTemplate[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);

  // State for tables - using SimpleSheet type to fix TS error
  const [tables, setTables] = useState<SimpleSheet[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; colIndex: number; value: string } | null>(null);

  // State for plugin settings
  const [pluginEnabled, setPluginEnabled] = useState<boolean>(false);

  // 新增：角色表格数据
  const [characterTablesData, setCharacterTablesData] = useState<Awaited<ReturnType<typeof TableMemory.getCharacterTablesData>> | null>(null);

  // Memory state and settings from MemoryProcessingControl
  const { setMemoryProcessingInterval, getMemoryProcessingInterval } = useMemoryContext();
  const [currentInterval, setCurrentInterval] = useState(10);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [memoryFacts, setMemoryFacts] = useState<MemoryFact[]>([]);
  const [isLoadingFacts, setIsLoadingFacts] = useState(false);
  const [factSearchQuery, setFactSearchQuery] = useState('');
  const [editingMemory, setEditingMemory] = useState<MemoryFact | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newMemoryContent, setNewMemoryContent] = useState('');
  const [dbStats, setDbStats] = useState<{totalCount: number, dbSize: number, dbSizeMB: string}>({
    totalCount: 0,
    dbSize: 0,
    dbSizeMB: '0'
  });
  const [characterMemoryCount, setCharacterMemoryCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedMemoryId, setExpandedMemoryId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // 新增：summary相关state
  const [summaries, setSummaries] = useState<any[]>([]);
  const [isLoadingSummaries, setIsLoadingSummaries] = useState(false);

  // 新增：表格模板管理展开状态
  const [isTemplateManagementExpanded, setIsTemplateManagementExpanded] = useState(false);

  // 新增：表格维护展开状态
  const [isTableMaintenanceExpanded, setIsTableMaintenanceExpanded] = useState(false);

  // Reference to track if component is mounted
  const isMountedRef = useRef<boolean>(false);
    // 新增：读取表格记忆插件开关状态
    useEffect(() => {
      if (isVisible) {
        (async () => {
          try {
            const enabledStr = await AsyncStorage.getItem(TABLE_MEMORY_ENABLED_KEY);
            if (enabledStr !== null) {
              setPluginEnabled(enabledStr === 'true');
              setTableMemoryEnabled(enabledStr === 'true');
            } else {
              // fallback: 读取当前插件状态
              setPluginEnabled(isTableMemoryEnabled());
            }
          } catch (e) {
            setPluginEnabled(isTableMemoryEnabled());
          }
        })();
      }
    }, [isVisible]);
  
  // Initialize the plugin when the component mounts
  useEffect(() => {
    isMountedRef.current = true;
    if (isVisible && !initialized) {
      initializePluginAsync();
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [isVisible, initialized]);

  // Load data when character/conversation changes or when visibility changes
  useEffect(() => {
    if (isVisible && initialized && characterId) {
      loadData(true); // Force refresh when becoming visible
    }
  }, [isVisible, initialized, characterId, conversationId]);

  // Initialize memory settings from MemoryProcessingControl
  useEffect(() => {
    if (isVisible) {
      const interval = getMemoryProcessingInterval();
      setCurrentInterval(interval);
      const mem0Service = Mem0Service.getInstance();
      const enabled = mem0Service.isMemoryEnabled?.() ?? true;
      setMemoryEnabled(enabled);
    }
  }, [isVisible, getMemoryProcessingInterval]);

  // Effect for memory enabled state
  useEffect(() => {
    if (initialized && isVisible) {
      const mem0Service = Mem0Service.getInstance();
      if (mem0Service.setMemoryEnabled) {
        mem0Service.setMemoryEnabled(memoryEnabled);
        console.log(`[MemoOverlay] Memory recording ${memoryEnabled ? 'enabled' : 'disabled'}`);
      }
    }
  }, [memoryEnabled, initialized, isVisible]);

  // Load memory settings from AsyncStorage
  useEffect(() => {
    if (isVisible) {
      (async () => {
        try {
          const saved = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (typeof parsed.currentInterval === 'number') setCurrentInterval(parsed.currentInterval);
            if (typeof parsed.memoryEnabled === 'boolean') setMemoryEnabled(parsed.memoryEnabled);
          }
        } catch (e) {
          console.warn('[MemoOverlay] 读取本地设置失败', e);
        }
      })();
    }
  }, [isVisible]);

  // Save memory settings to AsyncStorage
  useEffect(() => {
    if (initialized && isVisible) {
      AsyncStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({ currentInterval, memoryEnabled })
      ).catch(e => {
        console.warn('[MemoOverlay] 保存本地设置失败', e);
      });
    }
  }, [currentInterval, memoryEnabled, initialized, isVisible]);

  // Load memory facts and stats when Facts tab is active
  useEffect(() => {
    if (isVisible && activeTab === TabType.FACTS && characterId) {
      fetchMemoryFacts();
      fetchDbStats();
    }
  }, [isVisible, activeTab, characterId]);

  // Initialize plugin
  const initializePluginAsync = async () => {
    try {
      setLoading(true);
      // Initialize table memory plugin and set default templates
      // 更新: 显式禁用队列系统，使用直接操作模式
      const success = await initializeTableMemory({
        defaultTemplates: true,
        enabled: true,
      });

      setPluginEnabled(isTableMemoryEnabled());
      setInitialized(success);

      if (success) {
        console.log('[MemoOverlay] Table memory plugin initialized successfully');
        if (characterId) {
          await loadData(true);
        }
      }
    } catch (error) {
      console.error('[MemoOverlay] Failed to initialize table memory plugin:', error);
      Alert.alert('Error', 'Failed to initialize table memory plugin');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  // Load all data (templates & tables) with option to force refresh
  const loadData = async (forceRefresh = false) => {
    if (!characterId) return;

    if (forceRefresh || tables.length === 0) {
      setLoading(true);
    }

    try {
      // 顺序加载模板和表格，避免并发
      const templateManager = TableMemory.API;
      let availableTemplates: TableMemory.SheetTemplate[] = [];
      try {
        // 使用包装后的API方法，适配文件系统存储
        availableTemplates = await templateManager.getAllTemplates();
        console.log(`[MemoOverlay] Loaded ${availableTemplates.length} total templates`);
        if (isMountedRef.current) {
          setAllTemplates(availableTemplates);
        }
      } catch (templateError) {
        console.error('[MemoOverlay] Failed to load all templates:', templateError);
      }

      // 加载选中模板
      let selectedIds: string[];
      try {
        // 使用file system friendly API
        selectedIds = await TableMemory.getSelectedTemplateIds();
        console.log(`[MemoOverlay] Loaded ${selectedIds.length} selected template IDs`);
        if (isMountedRef.current) {
          setSelectedTemplateIds(selectedIds);
        }
      } catch (err) {
        console.error('[MemoOverlay] Failed to load selected template IDs:', err);
      }

      // 加载表格数据 - 使用优化的文件系统API
      try {
        const effectiveConversationId = conversationId || characterId;
        const safeCharacterId = String(characterId);
        const safeConversationId = String(effectiveConversationId);

        // 使用getCharacterTablesData接口，该接口已针对文件系统实现优化
        const tablesData = await TableMemory.getCharacterTablesData(
          safeCharacterId,
          safeConversationId
        );
        if (isMountedRef.current) {
          setCharacterTablesData(tablesData);
          if (tablesData.success) {
            // 直接使用tablesData中的表格数据构建表格列表
            setTables(
              tablesData.tables.map(t => ({
                uid: t.id,
                name: t.name,
                cells: [], // 不再需要加载完整cells，表格内容已在tablesData中
                characterId: safeCharacterId,
                conversationId: safeConversationId,
                templateId: '', // 文件系统不依赖缓存的templateId
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }))
            );
            if (tablesData.tables.length > 0 && !selectedTableId) {
              setSelectedTableId(tablesData.tables[0].id);
            }
          }
        }
      } catch (tableError) {
        console.error('[MemoOverlay] Failed to load character tables:', tableError);
        Alert.alert('Error', 'Failed to load tables for this character');
      }
    } catch (error) {
      console.error('[MemoOverlay] Failed to load data:', error);
      Alert.alert('Error', 'Failed to load templates and tables');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  // 替换模板中的 <user> 和 用户 为 customUserName
  const replaceUserInTemplate = useCallback(
    (template: TableMemory.SheetTemplate): TableMemory.SheetTemplate => {
      if (!customUserName) return template;
      // 需要替换的字段
      const fieldsToReplace = [
        'name', 'type', 'note', 'initPrompt', 'insertPrompt', 'deletePrompt', 'updatePrompt'
      ];
      const replaced: any = { ...template };
      fieldsToReplace.forEach(field => {
        if (typeof replaced[field] === 'string') {
          replaced[field] = replaced[field]
            .replace(/<user>/g, customUserName)
            .replace(/用户/g, customUserName);
        }
      });
      // columns 也可能包含
      if (Array.isArray(replaced.columns)) {
        replaced.columns = replaced.columns.map((col: any) => {
          const colCopy = { ...col };
          if (typeof colCopy.value === 'string') {
            colCopy.value = colCopy.value
              .replace(/<user>/g, customUserName)
              .replace(/用户/g, customUserName);
          }
          if (typeof colCopy.columnNote === 'string') {
            colCopy.columnNote = colCopy.columnNote
              .replace(/<user>/g, customUserName)
              .replace(/用户/g, customUserName);
          }
          return colCopy;
        });
      }
      return replaced;
    },
    [customUserName]
  );

  // Handle template selection
  const handleTemplateSelection = async (templateId: string, selected: boolean) => {
    try {
      let newSelectedIds: string[];

      if (selected) {
        newSelectedIds = [...selectedTemplateIds, templateId];
      } else {
        newSelectedIds = selectedTemplateIds.filter(id => id !== templateId);
      }

      // 使用文件系统友好的API更新模板选择
      await TableMemory.API.selectTemplates(newSelectedIds);
      setSelectedTemplateIds(newSelectedIds);

      console.log(`[MemoOverlay] Template ${templateId} ${selected ? 'selected' : 'unselected'}`);
    } catch (error) {
      console.error('[MemoOverlay] Failed to update template selection:', error);
      Alert.alert('Error', 'Failed to update template selection');
    }
  };

  // Create tables from selected templates
  const handleCreateTablesFromTemplates = async () => {
    if (!characterId) {
      Alert.alert('Error', 'Character ID is missing');
      return;
    }

    try {
      setLoading(true);

      // 安全地转换字符串类型的ID，防止文件系统路径问题
      const effectiveConversationId = conversationId || characterId;
      const safeCharacterId = String(characterId).trim();
      // 修复: 去除 conversationId 前缀
      let safeConversationId = String(effectiveConversationId).trim();
      if (safeConversationId.startsWith('conversation-')) {
        safeConversationId = safeConversationId.replace(/^conversation-/, '');
      }

      console.log(`[MemoOverlay] Creating tables from templates for character "${safeCharacterId}", conversation "${safeConversationId}"`);
      console.log(`[MemoOverlay] Selected template IDs: ${selectedTemplateIds.join(', ')}`);

      // 获取实际的模板对象，而不是仅使用ID - 配合文件系统实现
      const selectedTemplates = await TableMemory.getSelectedTemplates();
      const validTemplates = selectedTemplates.filter(template =>
        selectedTemplateIds.includes(template.uid)
      );

      if (validTemplates.length === 0) {
        Alert.alert('No Templates Selected', 'Please select valid templates first.');
        setLoading(false);
        return;
      }

      // === 新增：对模板做 customUserName 替换 ===
      const replacedTemplates = validTemplates.map(replaceUserInTemplate);

      // 使用文件系统优化后的API创建表格
      const createdTableIds = await TableMemory.createSheetsFromTemplates(
        replacedTemplates, // 用替换后的模板
        safeCharacterId,
        safeConversationId
      );

      if (createdTableIds.length > 0) {
        console.log(`[MemoOverlay] Created ${createdTableIds.length} tables with IDs: ${createdTableIds.join(', ')}`);

        // 给文件系统一些时间写入文件
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // 重新加载数据以显示新创建的表格
        await loadData(true);

        // 设置第一个创建的表格为选中
        if (createdTableIds[0]) {
          setSelectedTableId(createdTableIds[0]);
        }

        setActiveTab(TabType.TABLES);
      } else {
        Alert.alert('No Tables Created', 'No tables were created. Please select templates first.');
      }
    } catch (error) {
      console.error('[MemoOverlay] Failed to create tables:', error);
      Alert.alert('Error', 'Failed to create tables from templates');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  // 选中表格时，只需切换selectedTableId
  const handleSelectTable = (tableId: string) => {
    setSelectedTableId(tableId);
  };

  // Handle cell edit start
  const handleEditCell = (rowIndex: number, colIndex: number, value: string) => {
    // Don't allow editing the header row
    if (rowIndex === 0) return;

    setEditingCell({ rowIndex, colIndex, value });
  };

  // Save cell edit
  const handleSaveCellEdit = async () => {
    if (!editingCell || !selectedTableId) return;

    const { rowIndex, colIndex, value } = editingCell;

    try {
      setLoading(true);

      // Create row data object with just this cell's data
      const rowData: Record<number, string> = { [colIndex]: value };

      // Update the row in the table
      await TableMemory.API.updateRow(selectedTableId, rowIndex, rowData);

      // 不再直接setTableData，直接刷新
      setTimeout(() => loadData(), 500);
      setEditingCell(null);
    } catch (error) {
      console.error('[MemoOverlay] Failed to update cell:', error);
      Alert.alert('Error', 'Failed to update table cell');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  // Cancel cell edit
  const handleCancelCellEdit = () => {
    setEditingCell(null);
  };

  // Add a new row to the table - 优化文件系统写入
  const handleAddRow = async () => {
    if (!selectedTableId) return;

    try {
      setLoading(true);

      // 获取当前表格的列数
      const table = characterTablesData?.tables.find(t => t.id === selectedTableId);
      if (!table) throw new Error('Table not found');
      const colCount = table.headers.length;

      // 构造空行
      const rowData: Record<number, string> = {};
      for (let i = 0; i < colCount; i++) {
        rowData[i] = ''; // 空值，将由文件系统插入到表格中
      }

      // 插入行
      await TableMemory.insertRow(selectedTableId, rowData);

      // 适当延迟确保文件系统写入完成
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // 刷新
      await loadData(true);
    } catch (error) {
      console.error('[MemoOverlay] Failed to add row:', error);
      Alert.alert('Error', 'Failed to add new row to table');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  // Delete a row from the table - 文件系统优化
  const handleDeleteRow = async (rowIndex: number) => {
    // 不允许删除表头
    if (rowIndex === 0 || !selectedTableId) return;

    try {
      setLoading(true);
      // 调用文件系统API删除行
      await TableMemory.deleteRow(selectedTableId, rowIndex);
      
      // 适当延迟确保文件系统写入完成
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // 刷新数据
      await loadData(true);
    } catch (error) {
      console.error('[MemoOverlay] Failed to delete row:', error);
      Alert.alert('Error', 'Failed to delete row from table');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  // Delete an entire table - 文件系统优化
  const handleDeleteTable = async (tableId: string) => {
    if (!tableId) return;
    Alert.alert(
      'Delete Table',
      'Are you sure you want to delete this table? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              // 调用文件系统API删除表格
              const success = await TableMemory.deleteSheet(tableId);
              
              if (success) {
                setTables(prevTables => prevTables.filter(table => table.uid !== tableId));
                if (selectedTableId === tableId) {
                  setSelectedTableId(null);
                }
                
                // 适当延迟确保文件系统删除操作完成
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // 刷新数据
                await loadData(true);
              } else {
                Alert.alert('Error', 'Failed to delete table');
              }
            } catch (error) {
              console.error('[MemoOverlay] Failed to delete table:', error);
              Alert.alert('Error', 'Failed to delete table');
            } finally {
              if (isMountedRef.current) {
                setLoading(false);
              }
            }
          }
        }
      ]
    );
  };

  // Toggle plugin enabled state
  const handleTogglePluginEnabled = async (enabled: boolean) => {
    try {
      setPluginEnabled(enabled);
      setTableMemoryEnabled(enabled);
      console.log(`[MemoOverlay] Table memory plugin ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('[MemoOverlay] Failed to toggle plugin:', error);
      Alert.alert('Error', 'Failed to update plugin state');
    }
  };

  // Manual refresh button handler
  const handleRefreshTables = async () => {
    console.log('[MemoOverlay] Manual refresh requested');
    await loadData(true);
  };

  // Rebuild or repair table data
  const handleRebuildTable = async (tableId: string, promptType: string) => {
    if (!characterId || !tableId) return;

    try {
      setLoading(true);

      // Get all chat messages for this character
      // Note: This is placeholder code - you'll need to integrate with your chat history
      const chatContent = "";

      // Rebuild the table
      const success = await TableMemory.API.rebuildSheet(
        tableId,
        chatContent,
        promptType as any
      );

      // Show appropriate message based on the operation result
      if (success) {
        Alert.alert('成功', '表格更新完成');
      } else {
        // This isn't an error, it just means no changes were needed
        Alert.alert('信息', '表格无需更新或已是最新状态');
      }
    } catch (error) {
      console.error('[MemoOverlay] Failed to rebuild table:', error);
      Alert.alert('错误', '更新表格时发生错误，请重试');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  // 添加重置文件系统存储队列的方法 - 用于处理可能的锁定
  const handleResetStorageQueue = async () => {
    try {
      setLoading(true);
      // 使用文件系统存储的resetDatabaseConnection方法重置队列
      const result = await TableMemory.resetDatabaseConnection();
      if (result) {
        console.log('[MemoOverlay] Successfully reset file system storage queue');
      } else {
        console.warn('[MemoOverlay] Failed to reset file system storage queue');
      }
      
      // 等待文件系统释放资源
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 刷新数据
      await loadData(true);
    } catch (error) {
      console.error('[MemoOverlay] Error resetting storage queue:', error);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  // Memory facts related functions - moved from MemoryProcessingControl
  const fetchDbStats = useCallback(async () => {
    const mem0Service = Mem0Service.getInstance();
    
    try {
      const stats = await mem0Service.getVectorDbStats();
      setDbStats(stats);
      
      if (characterId) {
        try {
          const memories = await mem0Service.getCharacterMemories(characterId);
          setCharacterMemoryCount(memories.length);
          console.log(`[MemoOverlay] 统计面板获取到 ${memories.length} 条记忆，与记忆面板保持一致`);
        } catch (error) {
          console.error('[MemoOverlay] 获取角色记忆统计失败:', error);
          setCharacterMemoryCount(0);
        }
      }
    } catch (error) {
      console.error('[MemoOverlay] Error fetching database stats:', error);
    }
  }, [characterId]);

  const dbSizeWarningMessage = React.useMemo(() => {
    const sizeMB = parseFloat(dbStats.dbSizeMB);
    if (sizeMB >= DB_SIZE_ALERT_THRESHOLD) {
      return `警告: 向量数据库已达到 ${dbStats.dbSizeMB}MB，建议清理不必要的记忆!`;
    } else if (sizeMB >= DB_SIZE_WARNING_THRESHOLD) {
      return `提示: 向量数据库大小为 ${dbStats.dbSizeMB}MB，接近建议上限`;
    }
    return '';
  }, [dbStats.dbSizeMB]);

  const fetchMemoryFacts = useCallback(async () => {
    if (!characterId) {
      console.warn('[MemoOverlay] No character ID provided for memory facts');
      return;
    }

    try {
      setIsLoadingFacts(true);
      const mem0Service = Mem0Service.getInstance();

      let memories: MemoryFact[] = [];

      // 只用getCharacterMemories直接读取数据库
      if (mem0Service.getCharacterMemories && characterId) {
        try {
          const rawMemories = await mem0Service.getCharacterMemories(characterId, 200);
          // 兼容性修正：确保memory字段存在
          memories = (rawMemories || []).map((mem: any) => {
            let memoryContent = mem.memory;
            if (!memoryContent && mem.metadata?.data) memoryContent = mem.metadata.data;
            if (!memoryContent && mem.payload?.data) memoryContent = mem.payload.data;
            if (!memoryContent && mem.payload?.memory) memoryContent = mem.payload.memory;
            return {
              ...mem,
              memory: memoryContent || '',
            };
          }).filter(mem => !!mem.memory);

          setCharacterMemoryCount(memories.length);
          console.log(`[MemoOverlay] 统计面板获取到 ${memories.length} 条记忆，与记忆面板保持一致`);
        } catch (error) {
          console.error('[MemoOverlay] 获取角色记忆统计失败:', error);
          setCharacterMemoryCount(0);
        }
      }

      // 本地搜索过滤
      if (factSearchQuery && memories.length > 0) {
        const query = factSearchQuery.toLowerCase();
        memories = memories.filter((item: MemoryFact) => {
          const content = item?.memory || '';
          return content.toLowerCase().includes(query);
        });
      }

      memories.sort((a, b) => {
        const dateA = a.updatedAt || a.createdAt || '';
        const dateB = b.updatedAt || b.createdAt || '';
        return dateB.localeCompare(dateA);
      });

      setMemoryFacts(memories);
    } catch (error) {
      console.error('[MemoOverlay] Error fetching memory facts:', error);
    } finally {
      setIsLoadingFacts(false);
    }
  }, [characterId, factSearchQuery]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchMemoryFacts();
    await fetchDbStats();
    setIsRefreshing(false);
  }, [fetchMemoryFacts, fetchDbStats]);

  const handleIntervalChange = (value: number) => {
    const roundedValue = Math.round(value);
    setCurrentInterval(roundedValue);
    setMemoryProcessingInterval(roundedValue);
    const mem0Service = Mem0Service.getInstance();
    if (mem0Service.setProcessingInterval) {
      mem0Service.setProcessingInterval(roundedValue);
      console.log(`[MemoOverlay] Memory processing interval set to ${roundedValue}`);
    }
  };

  const handleSearchQueryChange = (text: string) => {
    setFactSearchQuery(text);
  };

  const handleSearchSubmit = () => {
    fetchMemoryFacts();
  };

  const handleAddMemory = () => {
    setIsCreatingNew(true);
    setNewMemoryContent('');
  };

  const handleSaveNewMemory = async () => {
    if (!newMemoryContent.trim()) {
      Alert.alert('错误', '记忆内容不能为空');
      return;
    }

    if (!characterId) {
      Alert.alert('错误', '未选择角色');
      return;
    }

    try {
      setIsCreatingNew(false); 
      Alert.alert('处理中', '正在创建记忆...');
      
      const mem0Service = Mem0Service.getInstance();
      if (!mem0Service.isEmbeddingAvailable) {
        throw new Error('嵌入服务不可用，请确保在设置中配置了有效的智谱API密钥');
      }
      
      const result = await mem0Service.createMemory(
        newMemoryContent, 
        characterId, 
        conversationId
      );

      if (result) {
        Alert.alert('成功', '成功创建新记忆');
        setNewMemoryContent('');
        await handleRefresh();
      } else {
        throw new Error('创建记忆失败，请检查嵌入服务配置');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[MemoOverlay] Error creating memory:', error);
      
      let alertMessage = '创建记忆失败';
      
      if (errorMessage.includes('嵌入服务不可用') || 
          errorMessage.includes('API密钥') || 
          errorMessage.includes('嵌入')) {
        alertMessage = '创建记忆失败：嵌入服务不可用。请在设置中配置有效的智谱API密钥。';
      } else {
        alertMessage = `创建记忆失败：${errorMessage}`;
      }
      
      Alert.alert('错误', alertMessage, [
        { 
          text: '重试', 
          onPress: () => setIsCreatingNew(true) 
        },
        { 
          text: '确定' 
        }
      ]);
    }
  };

  const handleEditMemory = (memory: MemoryFact) => {
    setEditingMemory(memory);
    setEditingContent(memory.memory);
  };

  const handleSaveEditedMemory = async () => {
    if (!editingMemory || !editingContent.trim()) {
      Alert.alert('错误', '记忆内容不能为空');
      return;
    }

    try {
      const mem0Service = Mem0Service.getInstance();
      const result = await mem0Service.updateMemory(
        editingMemory.id,
        editingContent
      );

      if (result) {
        Alert.alert('成功', '记忆更新成功');
        setEditingMemory(null);
        setEditingContent('');
        await handleRefresh();
      } else {
        Alert.alert('错误', '更新记忆失败');
      }
    } catch (error) {
      console.error('[MemoOverlay] Error updating memory:', error);
      Alert.alert('错误', '更新记忆失败');
    }
  };

  const handleDeleteMemory = (memory: MemoryFact) => {
    Alert.alert(
      '确认删除',
      '确定要删除此记忆吗？此操作不可逆。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              const mem0Service = Mem0Service.getInstance();
              const result = await mem0Service.deleteMemory(memory.id);
              
              if (result) {
                setMemoryFacts(prev => prev.filter(item => item.id !== memory.id));
                Alert.alert('成功', '记忆已删除');
                await fetchDbStats();
              } else {
                Alert.alert('错误', '删除记忆失败');
              }
            } catch (error) {
              console.error('[MemoOverlay] Error deleting memory:', error);
              Alert.alert('错误', '删除记忆失败');
            }
          }
        }
      ]
    );
  };

  const toggleMemoryExpansion = (id: string) => {
    setExpandedMemoryId(expandedMemoryId === id ? null : id);
  };

  const handleExportMemories = async () => {
    if (!characterId) {
      Alert.alert('错误', '未选择角色，无法导出记忆');
      return;
    }

    try {
      setIsExporting(true);
      
      const mem0Service = Mem0Service.getInstance();
      const memories = await mem0Service.getCharacterMemories(characterId, 1000);
      
      if (!memories || memories.length === 0) {
        Alert.alert('提示', '该角色没有可导出的记忆数据');
        setIsExporting(false);
        return;
      }

      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        characterId: characterId,
        memoryCount: memories.length,
        memories: memories
      };
      
      const jsonString = JSON.stringify(exportData, null, 2);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `memory_${characterId}_${timestamp}.json`;
      
      const tempFilePath = FileSystem.cacheDirectory + fileName;
      await FileSystem.writeAsStringAsync(tempFilePath, jsonString);
      
      const canShare = await Sharing.isAvailableAsync();
      
      if (canShare) {
        await Sharing.shareAsync(tempFilePath, {
          mimeType: 'application/json',
          dialogTitle: '导出记忆数据',
          UTI: 'public.json'
        });
        console.log(`[MemoOverlay] 成功导出 ${memories.length} 条记忆数据`);
      } else {
        await Share.share({
          title: '记忆数据导出',
          message: `已导出 ${memories.length} 条记忆数据`,
          url: tempFilePath
        });
      }
      
      Alert.alert('成功', `已导出 ${memories.length} 条记忆数据`);
    } catch (error) {
      console.error('[MemoOverlay] 导出记忆失败:', error);
      Alert.alert('导出失败', '无法导出记忆数据，请稍后再试');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportMemories = async () => {
    if (!characterId) {
      Alert.alert('错误', '未选择角色，无法导入记忆');
      return;
    }

    try {
      setIsImporting(true);
      
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true
      });
      
      if (result.canceled || !result.assets || result.assets.length === 0) {
        console.log('[MemoOverlay] 用户取消了文件选择');
        setIsImporting(false);
        return;
      }
      
      const fileUri = result.assets[0].uri;
      const fileContent = await FileSystem.readAsStringAsync(fileUri);
      
      const importData = JSON.parse(fileContent);
      
      if (!importData.version || !importData.memories || !Array.isArray(importData.memories)) {
        throw new Error('导入文件格式无效');
      }
      
      const confirmMsg = importData.characterId === characterId 
        ? `确定要导入 ${importData.memories.length} 条记忆到当前角色吗？` 
        : `原数据属于角色 ${importData.characterId}，与当前角色 ${characterId} 不匹配。是否仍要导入 ${importData.memories.length} 条记忆？`;
      
      Alert.alert(
        '确认导入',
        confirmMsg,
        [
          {
            text: '取消',
            style: 'cancel',
            onPress: () => setIsImporting(false)
          },
          {
            text: '导入',
            onPress: async () => {
              await processImport(importData.memories, characterId);
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('[MemoOverlay] 导入记忆失败:', error);
      Alert.alert('导入失败', '无法导入记忆数据，文件可能已损坏或格式不正确');
      setIsImporting(false);
    }
  };
  
  const processImport = async (memories: MemoryFact[], targetCharId: string) => {
    try {
      const mem0Service = Mem0Service.getInstance();
      let successCount = 0;
      let errorCount = 0;
      
      Alert.alert('导入中', '正在导入记忆数据，请稍候...');
      
      for (const memory of memories) {
        try {
          const content = memory.memory;
          if (content && content.trim()) {
            await mem0Service.createMemory(
              content,
              targetCharId,
              memory.runId || 'imported-memory'
            );
            successCount++;
          }
        } catch (err) {
          console.error('[MemoOverlay] 导入单条记忆失败:', err);
          errorCount++;
        }
      }
      
      await handleRefresh();
      
      Alert.alert(
        '导入完成', 
        `成功导入 ${successCount} 条记忆` + 
        (errorCount > 0 ? `，${errorCount} 条记忆导入失败` : '')
      );
      
    } catch (error) {
      console.error('[MemoOverlay] 批量导入记忆失败:', error);
      Alert.alert('导入失败', '处理导入数据时出错');
    } finally {
      setIsImporting(false);
    }
  };

  // Format timestamp for display in memory items
  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return '未知时间';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (e) {
      return timestamp;
    }
  };



  // Render the tables tab with tag-based table selection and full-width table
  const renderTablesTab = () => (
    <View style={styles.tabContent}>
      {/* 表格选择Tag */}
      <View style={styles.tableTagsContainer}>
        {characterTablesData?.success && characterTablesData.tables.length > 0 ? (
          characterTablesData.tables.map((table) => (
            <TouchableOpacity
              key={table.id}
              style={[
                styles.tableTag,
                selectedTableId === table.id && styles.tableTagSelected
              ]}
              onPress={() => handleSelectTable(table.id)}
            >
              <Text style={[
                styles.tableTagText,
                selectedTableId === table.id && styles.tableTagTextSelected
              ]}>
                {table.name}
              </Text>
              <TouchableOpacity
                style={styles.tableTagDelete}
                onPress={() => handleDeleteTable(table.id)}
              >
                <Ionicons name="close-circle" size={16} color="#ff6b6b" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.emptyText}>暂无表格，请先在模板页创建</Text>
        )}
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefreshTables}
          disabled={loading}
        >
          <Ionicons
            name="refresh"
            size={20}
            color={loading ? "#666" : "#ff9f1c"}
          />
        </TouchableOpacity>
      </View>
      {/* 表格内容 */}
      <View style={styles.tableDataContainerFull}>
        <View style={styles.tablesHeader}>
          <Text style={styles.tabTitle}>
            {selectedTableId
              ? characterTablesData?.tables.find(t => t.id === selectedTableId)?.name || '表格数据'
              : '请选择表格'}
          </Text>
          {selectedTableId && (
            <Text style={styles.tableIdText}>{selectedTableId}</Text>
          )}
        </View>
        {selectedTableId && characterTablesData?.success ? (() => {
          const table = characterTablesData.tables.find(t => t.id === selectedTableId);
          if (!table) {
            return (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>该表格暂无数据</Text>
              </View>
            );
          }
          const matrix = [table.headers, ...table.rows];
          return (
            <>
              <ScrollView horizontal>
                <ScrollView>
                  <View style={styles.tableGrid}>
                    {matrix.map((row, rowIndex) => (
                      <View key={`row-${rowIndex}`} style={styles.tableRow}>
                        {row.map((cell, colIndex) => (
                          <TouchableOpacity
                            key={`cell-${rowIndex}-${colIndex}`}
                            style={[
                              styles.tableCell,
                              rowIndex === 0 && styles.tableHeaderCell,
                              editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex && styles.tableCellEditing
                            ]}
                            onPress={() => rowIndex > 0 && handleEditCell(rowIndex, colIndex, cell)}
                            disabled={rowIndex === 0}
                          >
                            <Text
                              style={[
                                styles.tableCellText,
                                rowIndex === 0 && styles.tableHeaderCellText
                              ]}
                              numberOfLines={2}
                            >
                              {cell}
                            </Text>
                          </TouchableOpacity>
                        ))}
                        {rowIndex > 0 && (
                          <TouchableOpacity
                            style={styles.rowDeleteButton}
                            onPress={() => handleDeleteRow(rowIndex)}
                          >
                            <Ionicons name="close-circle" size={18} color="#ff6b6b" />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </ScrollView>
              <TouchableOpacity
                style={[styles.actionButton, styles.addRowButton]}
                onPress={handleAddRow}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>添加行</Text>
              </TouchableOpacity>
            </>
          );
        })() : selectedTableId ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>该表格暂无数据</Text>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>请先选择左上方的表格标签</Text>
          </View>
        )}
      </View>
    </View>
  );



  // Render the Facts tab (from MemoryProcessingControl)
  const renderFactsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.memoriesHeader}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="搜索记忆内容..."
            placeholderTextColor="#999"
            value={factSearchQuery}
            onChangeText={handleSearchQueryChange}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.searchButton} onPress={handleSearchSubmit}>
            <Ionicons name="search" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.memoryActionsHeader}>
          <TouchableOpacity 
            style={styles.refreshButton} 
            onPress={handleRefresh}
            disabled={isRefreshing || isLoadingFacts}
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color="#ff9f1c" />
            ) : (
              <Ionicons name="refresh" size={24} color="#fff" />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.addButton} 
            onPress={handleAddMemory}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {isLoadingFacts ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff9f1c" />
          <Text style={styles.loadingText}>加载记忆中...</Text>
        </View>
      ) : memoryFacts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {characterId ? `未找到该角色的记忆` : '请选择角色查看记忆'}
          </Text>
          <TouchableOpacity 
            style={styles.createMemoryButton}
            onPress={handleAddMemory}
          >
            <Text style={styles.createMemoryButtonText}>创建新记忆</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.memoriesList}>
          {memoryFacts.map(memory => {
            if (!memory || !memory.id) return null;
            
            const isExpanded = expandedMemoryId === memory.id;
            const memoryContent = memory.memory || 
                                memory.metadata?.data || 
                                '(内容为空或格式错误)';
            
            return (
              <View 
                style={[
                  styles.memoryItem, 
                  isExpanded && styles.expandedMemoryItem
                ]}
                key={memory.id}
              >
                <TouchableOpacity 
                  style={styles.memoryHeader}
                  onPress={() => toggleMemoryExpansion(memory.id)}
                >
                  <View style={styles.memoryIconContainer}>
                    <MaterialCommunityIcons 
                      name="brain" 
                      size={18} 
                      color="#ff9f1c" 
                    />
                  </View>
                  
                  <View style={styles.memoryContent}>
                    <Text 
                      style={styles.memoryText}
                      numberOfLines={isExpanded ? undefined : 2}
                    >
                      {memoryContent}
                    </Text>
                  </View>
                  
                  <Ionicons 
                    name={isExpanded ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color="#aaa" 
                  />
                </TouchableOpacity>
                
                {isExpanded && (
                  <View style={styles.memoryDetails}>
                    <View style={styles.memoryMetadata}>
                      <Text style={styles.metadataLabel}>创建时间:</Text>
                      <Text style={styles.metadataValue}>
                        {formatTimestamp(memory.createdAt)}
                      </Text>
                    </View>
                    
                    {memory.updatedAt && (
                      <View style={styles.memoryMetadata}>
                        <Text style={styles.metadataLabel}>更新时间:</Text>
                        <Text style={styles.metadataValue}>
                          {formatTimestamp(memory.updatedAt)}
                        </Text>
                      </View>
                    )}
                    
                    {memory.agentId && (
                      <View style={styles.memoryMetadata}>
                        <Text style={styles.metadataLabel}>角色ID:</Text>
                        <Text style={styles.metadataValue}>{memory.agentId}</Text>
                      </View>
                    )}
                    
                    {memory.runId && (
                      <View style={styles.memoryMetadata}>
                        <Text style={styles.metadataLabel}>会话ID:</Text>
                        <Text style={styles.metadataValue}>{memory.runId}</Text>
                      </View>
                    )}
                    
                    {memory.metadata?.aiResponse && (
                      <View style={styles.memoryMetadata}>
                        <Text style={styles.metadataLabel}>AI响应:</Text>
                        <Text style={styles.metadataValue}>{memory.metadata.aiResponse}</Text>
                      </View>
                    )}
                    
                    <View style={styles.memoryActions}>
                      <TouchableOpacity 
                        style={[styles.memoryAction, styles.editAction]} 
                        onPress={() => handleEditMemory(memory)}
                      >
                        <Ionicons name="pencil" size={16} color="#fff" />
                        <Text style={styles.actionText}>编辑</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={[styles.memoryAction, styles.deleteAction]} 
                        onPress={() => handleDeleteMemory(memory)}
                      >
                        <Ionicons name="trash" size={16} color="#fff" />
                        <Text style={styles.actionText}>删除</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
      
      {/* Memory stats and database info */}
      {characterMemoryCount > 0 && !isLoadingFacts && (
        <View style={styles.statsFooter}>
          <Text style={styles.statsText}>共 {characterMemoryCount} 条记忆</Text>
          {dbStats.totalCount > 0 && (
            <Text style={styles.statsText}>
              数据库大小: {dbStats.dbSizeMB}MB
            </Text>
          )}
        </View>
      )}
      
      {/* Import/Export buttons */}
      {characterId && (
        <View style={styles.backupButtonsContainer}>
          <TouchableOpacity 
            style={[styles.backupButton, styles.exportButton]} 
            onPress={handleExportMemories}
            disabled={isExporting || characterMemoryCount === 0}
          >
            {isExporting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="cloud-download-outline" size={18} color="#fff" />
                <Text style={styles.backupButtonText}>导出记忆</Text>
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.backupButton, styles.importButton]} 
            onPress={handleImportMemories}
            disabled={isImporting}
          >
            {isImporting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                <Text style={styles.backupButtonText}>导入记忆</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // Render the settings tab with combined settings from both components
  const renderSettingsTab = () => (
  <ScrollView style={styles.settingsScrollView} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.settingSection}>
        <TouchableOpacity 
          style={styles.settingSectionHeader}
          onPress={() => setIsTemplateManagementExpanded(!isTemplateManagementExpanded)}
        >
          <Text style={styles.settingSectionTitle}>表格模板管理</Text>
          <Ionicons 
            name={isTemplateManagementExpanded ? "chevron-up" : "chevron-down"} 
            size={20} 
            color="#ff9f1c" 
          />
        </TouchableOpacity>
        
        {isTemplateManagementExpanded && (
          <>
            <View style={styles.helperTextContainer}>
              <Ionicons name="information-circle-outline" size={16} color="#ff9f1c" />
              <Text style={styles.helperText}>
                选择模板后可批量创建表格，表格将由AI自动填充，作为长期记忆。
              </Text>
            </View>
            {/* 替换ScrollView+FlatList为FlatList单独渲染，避免嵌套 */}
            <FlatList
              data={allTemplates}
              keyExtractor={item => item.uid}
              style={{ maxHeight: 300 }}
              renderItem={({ item }) => (
                <View key={item.uid} style={[styles.templateItem, { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8 }]}
                >
                  <TouchableOpacity
                    style={[
                      styles.templateCheckbox,
                      selectedTemplateIds.includes(item.uid) && styles.templateCheckboxSelected
                    ]}
                    onPress={() => handleTemplateSelection(item.uid, !selectedTemplateIds.includes(item.uid))}
                  >
                    {selectedTemplateIds.includes(item.uid) && (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    )}
                  </TouchableOpacity>
                  <Text style={[styles.templateName, { marginLeft: 10, flex: 1 }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>未找到模板</Text>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      initializePluginAsync();
                    }}
                  >
                    <Text style={styles.actionButtonText}>初始化默认模板</Text>
                  </TouchableOpacity>
                </View>
              }
            />
            <View style={styles.tabActions}>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.primaryButton,
                  selectedTemplateIds.length === 0 && styles.disabledButton
                ]}
                onPress={handleCreateTablesFromTemplates}
                disabled={selectedTemplateIds.length === 0}
              >
                <MaterialIcons name="add-chart" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>
                  创建 {selectedTemplateIds.length} 个表格
                </Text>
              </TouchableOpacity>
              {selectedTemplateIds.length > 0 && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.secondaryButton, styles.clearButton]}
                  onPress={() => {
                    TableMemory.API.selectTemplates([]);
                    setSelectedTemplateIds([]);
                  }}
                >
                  <Text style={styles.clearButtonText}>清除选择</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </View>

      {/* 向量记忆系统设置 */}
      <View style={styles.settingSection}>
        <Text style={styles.settingSectionTitle}>向量记忆系统</Text>
        <View style={styles.settingItem}>
          <View style={styles.settingLabel}>
            <Text style={styles.settingTitle}>启用记忆功能</Text>
            <Text style={styles.settingDescription}>
              {memoryEnabled ? '记忆系统已启用，将自动记录对话内容' : '记忆系统已禁用，不会记录新的对话'}
            </Text>
          </View>
          <Switch
            value={memoryEnabled}
            onValueChange={setMemoryEnabled}
            trackColor={{ false: '#767577', true: 'rgba(255, 159, 28, 0.7)' }}
            thumbColor={memoryEnabled ? '#ff9f1c' : '#f4f3f4'}
          />
        </View>
        
        <View style={styles.settingSubSection}>
          <Text style={styles.settingSubSectionTitle}>记忆处理间隔</Text>
          <Text style={styles.settingDescription}>
            每隔多少轮用户消息处理一次记忆（1-20轮）
          </Text>
          
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderValue}>1</Text>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={20}
              step={1}
              value={currentInterval}
              onValueChange={handleIntervalChange}
              minimumTrackTintColor="#ff9f1c"
              maximumTrackTintColor="#767577"
              thumbTintColor="#ff9f1c"
            />
            <Text style={styles.sliderValue}>20</Text>
          </View>
          
          <View style={styles.currentValueContainer}>
            <Text style={styles.currentValueLabel}>当前设置:</Text>
            <Text style={styles.currentValue}>{currentInterval} 轮</Text>        
          </View>
        </View>
      </View>

      {/* 表格记忆插件设置 */}
      <View style={styles.settingSection}>
        <Text style={styles.settingSectionTitle}>表格记忆插件</Text>

        <View style={styles.settingItem}>
          <View style={styles.settingLabel}>
            <Text style={styles.settingTitle}>启用表格记忆</Text>
            <Text style={styles.settingDescription}>
              启用表格记忆增强以存储结构化数据
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.toggle,
              pluginEnabled ? styles.toggleActive : styles.toggleInactive
            ]}
            onPress={() => handleTogglePluginEnabled(!pluginEnabled)}
          >
            <View
              style={[
                styles.toggleThumb,
                pluginEnabled ? styles.toggleThumbActive : styles.toggleThumbInactive
              ]}
            />
          </TouchableOpacity>
        </View>
      </View>

      {selectedTableId && (
        <View style={styles.settingSection}>
          <TouchableOpacity 
            style={styles.settingSectionHeader}
            onPress={() => setIsTableMaintenanceExpanded(!isTableMaintenanceExpanded)}
          >
            <Text style={styles.settingSectionTitle}>表格维护</Text>
            <Ionicons 
              name={isTableMaintenanceExpanded ? "chevron-up" : "chevron-down"} 
              size={20} 
              color="#ff9f1c" 
            />
          </TouchableOpacity>
          {isTableMaintenanceExpanded && (
            <>
              <View style={styles.maintenanceGrid}>
                {/* rebuild_base */}
                <TouchableOpacity
                  style={[styles.maintenanceButton, styles.maintenanceButtonGrid]}
                  onPress={() => handleRebuildTable(selectedTableId, 'rebuild_base')}
                >
                  <MaterialIcons name="build" size={20} color="#ccc" />
                  <Text style={styles.maintenanceButtonText}>重建表格（基础）</Text>
                </TouchableOpacity>
                {/* rebuild_compatible */}
                <TouchableOpacity
                  style={[styles.maintenanceButton, styles.maintenanceButtonGrid]}
                  onPress={() => handleRebuildTable(selectedTableId, 'rebuild_compatible')}
                >
                  <MaterialIcons name="compare-arrows" size={20} color="#ccc" />
                  <Text style={styles.maintenanceButtonText}>兼容重建表格</Text>
                </TouchableOpacity>
                {/* rebuild_summary */}
                <TouchableOpacity
                  style={[styles.maintenanceButton, styles.maintenanceButtonGrid]}
                  onPress={() => handleRebuildTable(selectedTableId, 'rebuild_summary')}
                >
                  <MaterialIcons name="summarize" size={20} color="#ccc" />
                  <Text style={styles.maintenanceButtonText}>摘要重建表格</Text>
                </TouchableOpacity>
                {/* rebuild_fix_all */}
                <TouchableOpacity
                  style={[styles.maintenanceButton, styles.maintenanceButtonGrid]}
                  onPress={() => handleRebuildTable(selectedTableId, 'rebuild_fix_all')}
                >
                  <MaterialIcons name="healing" size={20} color="#ccc" />
                  <Text style={styles.maintenanceButtonText}>修复表格数据（全部）</Text>
                </TouchableOpacity>
                {/* rebuild_fix_simplify_all */}
                <TouchableOpacity
                  style={[styles.maintenanceButton, styles.maintenanceButtonGrid]}
                  onPress={() => handleRebuildTable(selectedTableId, 'rebuild_fix_simplify_all')}
                >
                  <MaterialIcons name="filter-list" size={20} color="#ccc" />
                  <Text style={styles.maintenanceButtonText}>修复并简化（全部）</Text>
                </TouchableOpacity>
                {/* rebuild_fix_simplify_without_history */}
                <TouchableOpacity
                  style={[styles.maintenanceButton, styles.maintenanceButtonGrid]}
                  onPress={() => handleRebuildTable(selectedTableId, 'rebuild_fix_simplify_without_history')}
                >
                  <MaterialIcons name="filter-alt" size={20} color="#ccc" />
                  <Text style={styles.maintenanceButtonText}>修复并简化（无历史）</Text>
                </TouchableOpacity>
                {/* rebuild_simplify_history */}
                <TouchableOpacity
                  style={[styles.maintenanceButton, styles.maintenanceButtonGrid]}
                  onPress={() => handleRebuildTable(selectedTableId, 'rebuild_simplify_history')}
                >
                  <MaterialIcons name="compress" size={20} color="#ccc" />
                  <Text style={styles.maintenanceButtonText}>简化历史记录</Text>
                </TouchableOpacity>
                {/* refresh_table_old */}
                <TouchableOpacity
                  style={[styles.maintenanceButton, styles.maintenanceButtonGrid]}
                  onPress={() => handleRebuildTable(selectedTableId, 'refresh_table_old')}
                >
                  <MaterialIcons name="refresh" size={20} color="#ccc" />
                  <Text style={styles.maintenanceButtonText}>刷新表格（旧版）</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      )}
  </ScrollView>
  );

  // Modal for editing cell value (中文化)
  const renderCellEditModal = () => (
    <Modal
      visible={!!editingCell}
      transparent
      animationType="fade"
      onRequestClose={handleCancelCellEdit}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.cellEditContainer}>
          <Text style={styles.cellEditTitle}>编辑单元格</Text>
          <TextInput
            style={styles.cellEditInput}
            value={editingCell?.value || ''}
            onChangeText={(text) => setEditingCell(prev => prev ? { ...prev, value: text } : null)}
            multiline
            autoFocus
            placeholder="输入内容..."
            placeholderTextColor="#999"
          />
          <View style={styles.cellEditActions}>
            <TouchableOpacity
              style={[styles.cellEditButton, styles.cellEditCancelButton]}
              onPress={handleCancelCellEdit}
            >
              <Text style={styles.cellEditButtonText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cellEditButton, styles.cellEditSaveButton]}
              onPress={handleSaveCellEdit}
            >
              <Text style={styles.cellEditButtonText}>保存</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Modal for editing memory
  const renderMemoryEditModal = () => (
    <Modal
      visible={!!editingMemory}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setEditingMemory(null)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.cellEditContainer}>
          <Text style={styles.cellEditTitle}>编辑记忆</Text>
          <TextInput
            style={styles.cellEditInput}
            value={editingContent}
            onChangeText={setEditingContent}
            multiline
            autoFocus
            placeholder="编辑记忆内容..."
            placeholderTextColor="#999"
          />
          <View style={styles.cellEditActions}>
            <TouchableOpacity
              style={[styles.cellEditButton, styles.cellEditCancelButton]}
              onPress={() => setEditingMemory(null)}
            >
              <Text style={styles.cellEditButtonText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cellEditButton, styles.cellEditSaveButton]}
              onPress={handleSaveEditedMemory}
            >
              <Text style={styles.cellEditButtonText}>保存</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Modal for creating new memory
  const renderNewMemoryModal = () => (
    <TextEditorModal
      isVisible={isCreatingNew}
      initialText={newMemoryContent}
      title="新建记忆"
      placeholder="输入新记忆内容..."
      onClose={() => setIsCreatingNew(false)}
      onSave={async (text: string) => {
        setNewMemoryContent(text);
        // 直接调用原有保存逻辑
        // handleSaveNewMemory 依赖 newMemoryContent，所以这里直接传递 text
        if (!text.trim()) {
          Alert.alert('错误', '记忆内容不能为空');
          return;
        }
        if (!characterId) {
          Alert.alert('错误', '未选择角色');
          return;
        }
        try {
          setIsCreatingNew(false); 
          Alert.alert('处理中', '正在创建记忆...');
          const mem0Service = Mem0Service.getInstance();
          if (!mem0Service.isEmbeddingAvailable) {
            throw new Error('嵌入服务不可用，请确保在设置中配置了有效的智谱API密钥');
          }
          const result = await mem0Service.createMemory(
            text, 
            characterId, 
            conversationId
          );
          if (result) {
            Alert.alert('成功', '成功创建新记忆');
            setNewMemoryContent('');
            await handleRefresh();
          } else {
            throw new Error('创建记忆失败，请检查嵌入服务配置');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('[MemoOverlay] Error creating memory:', error);
          let alertMessage = '创建记忆失败';
          if (errorMessage.includes('嵌入服务不可用') || 
              errorMessage.includes('API密钥') || 
              errorMessage.includes('嵌入')) {
            alertMessage = '创建记忆失败：嵌入服务不可用。请在设置中配置有效的智谱API密钥。';
          } else {
            alertMessage = `创建记忆失败：${errorMessage}`;
          }
          Alert.alert('错误', alertMessage, [
            { 
              text: '重试', 
              onPress: () => setIsCreatingNew(true) 
            },
            { 
              text: '确定' 
            }
          ]);
        }
      }}
    />
  );

  // 加载summary内容
  useEffect(() => {
    if (isVisible && activeTab === TabType.SUMMARY && conversationId) {
      fetchSummaries();
    }
  }, [isVisible, activeTab, conversationId]);

  // 工具函数：去除 conversation- 前缀
  const getSafeConversationId = (id?: string) => {
    if (!id) return '';
    return id.startsWith('conversation-') ? id.replace(/^conversation-/, '') : id;
  };

  // 获取所有summary
  const fetchSummaries = useCallback(async () => {
    if (!conversationId) return;
    setIsLoadingSummaries(true);
    try {
      // 使用安全的 conversationId
      const safeConversationId = getSafeConversationId(conversationId);
      const allSummaries = await memoryService.getAllSummaries(safeConversationId);
      setSummaries(allSummaries || []);
      console.log(`[MemoOverlay] Loaded ${allSummaries.length} summaries for conversation ${safeConversationId}`);
    } catch (e) {
      console.error('[MemoOverlay] Failed to fetch summaries:', e);
      setSummaries([]);
    } finally {
      setIsLoadingSummaries(false);
    }
  }, [conversationId]);

  // 删除summary
  const handleDeleteSummary = async (summaryTimestamp: number) => {
    if (!conversationId) return;
    try {
      const safeConversationId = getSafeConversationId(conversationId);
      const result = await memoryService.deleteSummary(safeConversationId, summaryTimestamp);
      if (result) {
        console.log(`[MemoOverlay] Successfully deleted summary with timestamp ${summaryTimestamp}`);
        // 刷新摘要列表
        await fetchSummaries();
      } else {
        Alert.alert('错误', '删除总结失败');
      }
    } catch (e) {
      console.error('[MemoOverlay] Error deleting summary:', e);
      Alert.alert('错误', '删除总结失败');
    }
  };

  // 渲染Summary Tab，增强显示效果
  const renderSummaryTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.memoriesHeader}>
        <Text style={styles.tabTitle}>对话总结</Text>
        <View style={styles.memoryActionsHeader}>
          <TouchableOpacity 
            style={styles.refreshButton} 
            onPress={fetchSummaries}
            disabled={isLoadingSummaries}
          >
            {isLoadingSummaries ? (
              <ActivityIndicator size="small" color="#ff9f1c" />
            ) : (
              <Ionicons name="refresh" size={24} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>

          {isLoadingSummaries ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#ff9f1c" />
              <Text style={styles.loadingText}>加载总结中...</Text>
            </View>
          ) : summaries.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>暂无总结内容</Text>
              {characterId && conversationId && (
                <TouchableOpacity 
                  style={styles.createMemoryButton}
                  onPress={async () => {
                    try {
                      Alert.alert('提示', '正在生成对话总结，请稍候...');
                      const safeConversationId = getSafeConversationId(conversationId);
                      
                      // 获取API设置
                      const settings = getApiSettings();
                      // 适配API设置格式
                      const apiConfig = {
                        apiProvider: settings.apiProvider as 'gemini' | 'openrouter'| 'openai-compatible',
                        openrouter: settings.openrouter
                      };
                      // === 修正API Key选择逻辑 ===
                      let apiKeyToUse = '';
                      if (settings.apiProvider === 'openai-compatible') {
                        apiKeyToUse = settings.OpenAIcompatible?.apiKey || '';
                      } else if (settings.apiProvider === 'openrouter') {
                        apiKeyToUse = settings.openrouter?.apiKey || '';
                      } else {
                        apiKeyToUse = settings.apiKey || '';
                      }
                      // === 新增日志 ===
                      console.log('[MemoOverlay] summarizeMemoryNow 请求参数:', {
                        conversationId: safeConversationId,
                        characterId,
                        apiKey: apiKeyToUse,
                        apiConfig
                      });
                      const result = await memoryService.summarizeMemoryNow(
                        safeConversationId, 
                        characterId,
                        apiKeyToUse,
                        apiConfig
                      );
                      
                      if (result) {
                        Alert.alert('成功', '对话总结已生成');
                        await fetchSummaries();
                      } else {
                        try {
                          const cleanMessages = await StorageAdapter.getCleanChatHistory(safeConversationId);
                          if (!cleanMessages || cleanMessages.length === 0) {
                            Alert.alert('错误', '未找到聊天历史，无法生成总结');
                          } else {
                            Alert.alert('错误', '生成对话总结失败');
                          }
                        } catch (e) {
                          Alert.alert('错误', '生成对话总结失败');
                        }
                      }
                    } catch (e: any) {
                      if (e && e.message && e.message.includes('未找到聊天历史')) {
                        Alert.alert('错误', '未找到聊天历史，无法生成总结');
                      } else {
                        console.error('[MemoOverlay] Error generating summary:', e);
                        Alert.alert('错误', '生成对话总结失败');
                      }
                    }
                  }}
                >
                  <Text style={styles.createMemoryButtonText}>立即生成对话总结</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <ScrollView style={styles.memoriesList}>
              {summaries.map((summary, idx) => (
                <View key={summary.timestamp || idx} style={styles.memoryItem}>
                  <View style={styles.memoryHeader}>
                    <MaterialCommunityIcons name="file-document-outline" size={18} color="#ff9f1c" style={{ marginRight: 12 }} />
                    <View style={styles.memoryContent}>
                      <Text style={styles.memoryText}>
                        {summary.summary || summary.parts?.[0]?.text?.replace(/^---.*?---\n|---.*?---$/g, '') || '(无内容)'}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteSummary(summary.timestamp)}>
                      <Ionicons name="trash" size={20} color="#e74c3c" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.memoryDetails}>
                    <Text style={styles.metadataLabel}>时间:</Text>
                    <Text style={styles.metadataValue}>{formatTimestamp(summary.timestamp)}</Text>
                    {summary.originalMessagesRange && (
                      <Text style={styles.metadataValue}>
                        对话区间: {summary.originalMessagesRange.start} - {summary.originalMessagesRange.end}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
              
              {characterId && conversationId && summaries.length > 0 && (
                <TouchableOpacity 
                    style={[styles.createMemoryButton, { marginTop: 20, backgroundColor: 'rgba(255, 159, 28, 0.2)' }]}
                    onPress={async () => {
                    try {
                      Alert.alert('提示', '正在生成新的对话总结，请稍候...');
                      const safeConversationId = getSafeConversationId(conversationId);
                      
                      // 获取API设置
                      const settings = getApiSettings();
                      // 适配API设置格式
                      const apiConfig = {
                        apiProvider: settings.apiProvider as 'gemini' | 'openrouter' | 'openai-compatible',
                        openrouter: settings.openrouter
                      };
                      // === 修正API Key选择逻辑 ===
                      let apiKeyToUse = '';
                      if (settings.apiProvider === 'openai-compatible') {
                        apiKeyToUse = settings.OpenAIcompatible?.apiKey || '';
                      } else if (settings.apiProvider === 'openrouter') {
                        apiKeyToUse = settings.openrouter?.apiKey || '';
                      } else {
                        apiKeyToUse = settings.apiKey || '';
                      }
                      // === 新增日志 ===
                      console.log('[MemoOverlay] summarizeMemoryNow 请求参数:', {
                        conversationId: safeConversationId,
                        characterId,
                        apiKey: apiKeyToUse,
                        apiConfig
                      });
                      console.log('[MemoOverlay] Generating new summary with config:', apiConfig);
                      const result = await memoryService.summarizeMemoryNow(
                        safeConversationId, 
                        characterId,
                        apiKeyToUse,
                        apiConfig
                      );
                      
                      if (result) {
                        Alert.alert('成功', '新的对话总结已生成');
                        await fetchSummaries();
                      } else {
                        Alert.alert('错误', '生成对话总结失败');
                      }
                    } catch ( e) {
                      console.error('[MemoOverlay] Error generating summary:', e);
                      Alert.alert('错误', '生成对话总结失败');
                    }
                  }}
                >
                  <Text style={styles.createMemoryButtonText}>生成新的对话总结</Text>
                </TouchableOpacity>
              ) }
            </ScrollView>
          )}
    </View>
  );

  return (
    <Modal
      transparent
      visible={isVisible}
      onRequestClose={onClose}
      animationType="slide"
      statusBarTranslucent
    >
      <View style={styles.fullScreenContainer}>
        <BlurView intensity={30} tint="dark" style={styles.fullScreenBlurView}>
          <View style={styles.header}>
            <Text style={styles.title}>记忆增强系统</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#ff9f1c" />
              <Text style={styles.loadingText}>加载中...</Text>
            </View>
          )}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === TabType.SUMMARY && styles.activeTab]}
              onPress={() => setActiveTab(TabType.SUMMARY)}
            >
              <MaterialCommunityIcons
                name="file-document-outline"
                size={20}
                color={activeTab === TabType.SUMMARY ? '#ff9f1c' : '#ccc'}
              />
              <Text style={[styles.tabText, activeTab === TabType.SUMMARY && styles.activeTabText]}>
                总结
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === TabType.TABLES && styles.activeTab]}
              onPress={() => setActiveTab(TabType.TABLES)}
            >
              <Ionicons
                name="grid"
                size={20}
                color={activeTab === TabType.TABLES ? '#ff9f1c' : '#ccc'}
              />
              <Text style={[styles.tabText, activeTab === TabType.TABLES && styles.activeTabText]}>
                表格
                {tables.length > 0 && (
                  <Text style={styles.tabBadge}> ({tables.length})</Text>
                )}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === TabType.FACTS && styles.activeTab]}
              onPress={() => setActiveTab(TabType.FACTS)}
            >
              <MaterialCommunityIcons
                name="brain"
                size={20}
                color={activeTab === TabType.FACTS ? '#ff9f1c' : '#ccc'}
              />
              <Text style={[styles.tabText, activeTab === TabType.FACTS && styles.activeTabText]}>
                事实
                {characterMemoryCount > 0 && (
                  <Text style={styles.tabBadge}> ({characterMemoryCount})</Text>
                )}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === TabType.SETTINGS && styles.activeTab]}
              onPress={() => setActiveTab(TabType.SETTINGS)}
            >
              <Ionicons
                name="settings"
                size={20}
                color={activeTab === TabType.SETTINGS ? '#ff9f1c' : '#ccc'}
              />
              <Text style={[styles.tabText, activeTab === TabType.SETTINGS && styles.activeTabText]}>
                设置
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.content}>
            {activeTab === TabType.SUMMARY && renderSummaryTab()}
            {activeTab === TabType.TABLES && renderTablesTab()}
            {activeTab === TabType.FACTS && renderFactsTab()}
            {activeTab === TabType.SETTINGS && renderSettingsTab()}
          </View>
          {dbSizeWarningMessage && activeTab === TabType.FACTS && (
            <View style={[
              styles.dbSizeWarning, 
              parseFloat(dbStats.dbSizeMB) >= DB_SIZE_ALERT_THRESHOLD ? styles.dbSizeAlert : {}
            ]}>
              <Ionicons name="warning" size={18} color="white" />
              <Text style={styles.dbSizeWarningText}>{dbSizeWarningMessage}</Text>
            </View>
          )}
          {renderCellEditModal()}
          {renderMemoryEditModal()}
          {renderNewMemoryModal()}
        </BlurView>
      </View>
    </Modal>
  );
};

// 在 MemoOverlay 定义后，添加类型断言，声明 getSettings 静态方法
type MemoOverlayType = React.FC<MemoOverlayProps> & {
  getSettings: () => Promise<{ tableMemoryEnabled: boolean; vectorMemoryEnabled: boolean }>;
};

const MemoOverlayComponent = MemoOverlay as MemoOverlayType;

// ===== 新增: 静态方法用于外部获取设置信息 =====
MemoOverlayComponent.getSettings = async () => {
  // 表格记忆插件开关
  let tableMemoryEnabled = false;
  try {
    const enabledStr = await AsyncStorage.getItem(TABLE_MEMORY_ENABLED_KEY);
    if (enabledStr !== null) {
      tableMemoryEnabled = enabledStr === 'true';
    } else {
      tableMemoryEnabled = isTableMemoryEnabled();
    }
  } catch {
    tableMemoryEnabled = isTableMemoryEnabled();
  }

  // 向量记忆系统开关
  let vectorMemoryEnabled = true;
  try {
    const saved = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (typeof parsed.memoryEnabled === 'boolean') {
        vectorMemoryEnabled = parsed.memoryEnabled;
      }
    }
  } catch {
    // 保持默认
  }

  return {
    tableMemoryEnabled,
    vectorMemoryEnabled,
  };
};

export default MemoOverlayComponent;

const { height, width } = Dimensions.get('window');

const styles = StyleSheet.create({
  memoriesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(60, 60, 60, 0.6)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  searchInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: 12,
    color: '#fff',
    fontSize: 15,
    backgroundColor: 'transparent',
  },
  searchButton: {
    backgroundColor: 'rgba(255, 159, 28, 0.2)',
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memoryActionsHeader: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  refreshButton: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(60, 60, 60, 0.6)',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  addButton: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255, 159, 28, 0.2)',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memoriesList: {
    flex: 1,
  },
  memoryItem: {
    backgroundColor: 'rgba(60, 60, 60, 0.6)',
    borderRadius: 10,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  expandedMemoryItem: {
    backgroundColor: 'rgba(70, 70, 70, 0.8)',
  },
  memoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  memoryIconContainer: {
    marginRight: 12,
  },
  memoryContent: {
    flex: 1,
  },
  memoryText: {
    color: '#fff',
    fontSize: 14,
  },
  memoryDetails: {
    padding: 12,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  memoryMetadata: {
    flexDirection: 'row',
    marginTop: 12,
  },
  metadataLabel: {
    width: 80,
    fontSize: 13,
    color: '#aaa',
  },
  metadataValue: {
    flex: 1,
    fontSize: 13,
    color: '#ddd',
  },
  memoryActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 15,
  },
  memoryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginLeft: 8,
  },
 editAction: {
    backgroundColor: 'rgba(255, 159, 28, 0.2)',
  },
  deleteAction: {
    backgroundColor: '#e74c3c',
  },
  actionText: {
    color: '#fff',
    marginLeft: 5,
    fontSize: 13,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ddd',
    marginTop: 12,
  },
  createMemoryButton: {
    backgroundColor: '#ff9f1c',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  createMemoryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  statsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 12,
  },
  statsText: {
    color: '#ccc',
       fontSize: 13,
  },
  backupButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  backupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    flex: 0.48,
    backgroundColor: '#ff9f1c',
  },
  exportButton: {
    backgroundColor: '#ff9f1c',
  },
  importButton: {
    backgroundColor: 'rgba(255, 159, 28, 0.2)',
  },
  backupButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  dbSizeWarning: {
    backgroundColor: 'rgba(255, 159, 28, 0.9)',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dbSizeAlert: {
    backgroundColor: 'rgba(231, 76, 60, 0.9)',
  },
  dbSizeWarningText: {
    color: 'white',
    marginLeft: 8,
    flex: 1,
  },
  settingsScrollView: {
    flex: 1,
    padding: 16,
  },
  settingSection: {
    backgroundColor: 'rgba(60, 60, 60, 0.6)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 16,
  },
  settingSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingSectionTitle: {
    color: '#ff9f1c',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  settingSubSection: {
    marginTop: 16,
  },
  settingSubSectionTitle: {
    color: '#ff9f1c',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  dbSizeWarningBox: {
    backgroundColor: 'rgba(255, 159, 28, 0.1)',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  dbSizeWarningBoxText: {
    color: '#ff9f1c',
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderValue: {
    width: 30,
    textAlign: 'center',
    color: '#aaa',
  },
  currentValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  currentValueLabel: {
    fontSize: 15,
    color: '#fff',
  },
  currentValue: {
    fontSize: 20,
    color: '#ff9f1c',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  fullScreenBlurView: {
    flex: 1,
    borderRadius: 0,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  tableTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  tableTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(60, 60, 60, 0.6)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 6,
  },
  tableTagSelected: {
    backgroundColor: '#ff9f1c',
  },
  tableTagText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 4,
  },
  tableTagTextSelected: {
    color: '#fff',
  },
  tableTagDelete: {
    marginLeft: 4,
  },
  tableDataContainerFull: {
    flex: 1,
    paddingLeft: 0,
    width: '100%',
  },
  buttonIcon: {
    marginRight: 8,
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  tabTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ccc',
    marginTop: 20,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    paddingBottom: 6,
  },

  // Template styles
  templateItem: {
    backgroundColor: 'rgba(60, 60, 60, 0.6)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  templateCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#ccc',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateCheckboxSelected: {
    backgroundColor: '#ff9f1c',
    borderColor: '#ff9f1c',
  },
  templateName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  templateDesc: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 8,
  },
  templateMetadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  templateMetaText: {
    color: '#ccc',
    fontSize: 12,
  },
  metaValue: {
    color: '#ff9f1c',
    fontWeight: 'bold',
  },

  // Tables styles
  tablesContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  tablesList: {
    width: '30%',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.1)',
    paddingRight: 10,
  },
  tableDataContainer: {
    flex: 1,
    paddingLeft: 10,
  },
  tableListItem: {
    backgroundColor: 'rgba(60, 60, 60, 0.6)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  tableListItemSelected: {
    backgroundColor: 'rgba(255, 159, 28, 0.3)',
    borderLeftWidth: 3,
    borderLeftColor: '#ff9f1c',
  },
  tableListItemName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
  },
  tableIdText: {
    color: '#888',
    fontSize: 10,
    marginTop: 2,
    marginBottom: 4,
  },
  tableListItemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  tableActionButton: {
    padding: 4,
    marginLeft: 8,
  },
  tableGrid: {
    padding: 5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  tableCell: {
    backgroundColor: 'rgba(60, 60, 60, 0.6)',
    borderRadius: 4,
    padding: 8,
    minWidth: 110,
    marginRight: 2,
    height: 50,
    justifyContent: 'center',
  },
  tableHeaderCell: {
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
  },
  tableCellEditing: {
    backgroundColor: 'rgba(255, 159, 28, 0.3)',
  },
  tableCellText: {
    color: '#fff',
    fontSize: 13,
  },
  tableHeaderCellText: {
    fontWeight: 'bold',
    color: '#ff9f1c',
  },
  rowDeleteButton: {
    padding: 8,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Cell edit modal
  cellEditContainer: {
    backgroundColor: '#333',
    borderRadius: 10,
    padding: 16,
    width: '80%',
    maxWidth: 400,
  },
  cellEditTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  cellEditInput: {
    backgroundColor: '#444',
    borderRadius: 6,
    padding: 12,
    color: '#fff',
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  cellEditActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cellEditButton: {
    padding: 10,
    borderRadius: 6,
    marginLeft: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  cellEditCancelButton: {
    backgroundColor: '#555',
  },
  cellEditSaveButton: {
    backgroundColor: '#ff9f1c',
  },
  cellEditButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },

  // Actions
  tabActions: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 16,
  },
  actionButton: {
    backgroundColor: '#ff9f1c',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryButton: {
    backgroundColor: '#ff9f1c',
  },
  addRowButton: {
    marginTop: 16,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },

  // Settings
  settingLabel: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: '#ccc',
  },
  toggle: {
    width: 46,
    height: 24,
    borderRadius: 12,
    padding: 2,
  },
  toggleActive: {
    backgroundColor: 'rgba(255, 159, 28, 0.5)',
  },
  toggleInactive: {
    backgroundColor: '#555',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  toggleThumbActive: {
    backgroundColor: '#ff9f1c',
    alignSelf: 'flex-end',
  },
  toggleThumbInactive: {
    backgroundColor: '#ccc',
    alignSelf: 'flex-start',
  },

  // Maintenance
  maintenanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  maintenanceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(60, 60, 60, 0.6)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  maintenanceButtonGrid: {
    width: '48%',
    marginBottom: 10,
  },
  maintenanceButtonText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 10,
  },

  // Empty states
  emptyState: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  dangerButton: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
  },
  dangerButtonText: {
    color: '#ff6b6b',
    marginLeft: 10,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.5,
  },
  maintenanceContainer: {
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  tablesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  selectedCount: {
    color: '#ff9f1c',
    fontWeight: 'normal',
  },
  helperTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 159, 28, 0.1)',
    padding: 10,
    borderRadius: 6,
    marginBottom: 16,
  },
  helperText: {
    color: '#ccc',
    fontSize: 13,
    marginLeft: 8,
  },
  secondaryButton: {
    backgroundColor: '#444',
    marginTop: 8,
  },
  clearButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#666',
  },
  clearButtonText: {
    color: '#ccc',
  },
  tabBadge: {
    color: '#ff9f1c',
    fontSize: 12,
  },
  batchOperationsContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 10,
  },
  batchOperationsTitle: {
    fontSize: 13,
    color: '#ccc',
    marginBottom: 8,
    fontWeight: 'bold',
  },
  batchOperationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 159, 28, 0.1)',
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
  },
  batchOperationText: {
    color: '#ccc',
    marginLeft: 8,
    fontSize: 13,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  blurView: {
    width: '90%',
    height: height * 0.8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // 顶部安全距离
    paddingTop: Platform.select({
      ios: 44,
      android: StatusBar.currentHeight || 24,
      default: 24,
    }),
    paddingBottom: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 5,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },

  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  tab: {
    flex: 1,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#ff9f1c',
  },
  tabText: {
    color: '#ccc',
    marginLeft: 8,
    fontSize: 14,
  },
  activeTabText: {
    color: '#ff9f1c',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  
  // New style for button text
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 8,
  },

  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
});
