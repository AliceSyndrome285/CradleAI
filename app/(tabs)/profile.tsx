import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useUser } from '@/constants/UserContext';
import { useRouter } from 'expo-router';
import ListItem from '@/components/ListItem';
import ConfirmDialog from '@/components/ConfirmDialog';
import LoadingIndicator from '@/components/LoadingIndicator';
import { theme } from '@/constants/theme';
import NovelAITestModal from '@/components/NovelAITestModal';

const Profile: React.FC = () => {
  const { user, updateAvatar } = useUser();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [showNovelAITestModal, setShowNovelAITestModal] = useState(false);

  const pickImage = useCallback(async () => {
    try {
      setIsLoading(true);
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setShowPermissionDialog(true);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await updateAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [updateAvatar]);


  const handleNovelAIImageGenerated = (imageUrl: string, taskId?: string) => {
    console.log('NovelAI 图像已生成:', imageUrl, '任务ID:', taskId);
    Alert.alert('成功', '图像已成功生成并保存到应用中');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />

      {/* Header Image */}
      <Image 
        source={require('@/assets/images/default-background.jpg')}
        style={styles.headerImage}
        resizeMode="cover"
      />

      {/* User Profile */}
      <View style={styles.header}>
        <TouchableOpacity onPress={pickImage}>
          <Image
            source={user?.avatar ? { uri: user.avatar } : require('@/assets/images/default-avatar.png')}
            style={styles.avatar}
          />
          <View style={styles.editAvatarButton}>
            <Ionicons name="camera" size={16} color="black" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Menu Items */}
      <ScrollView 
        style={styles.menuContainer}
        contentContainerStyle={styles.menuContent}
        showsVerticalScrollIndicator={false}
      >
        <ListItem
          title="API 设置"
          leftIcon="cloud-outline"
          chevron={true}
          onPress={() => router.push('/pages/api-settings')}
        />
        
        <ListItem
          title="模型预算"
          leftIcon="calculator-outline"
          chevron={true}
          onPress={() => router.push('../pages/token-planner')}
        />

        {/* Add new option for custom user settings manager */}
        <ListItem
          title="自设管理"
          leftIcon="person-outline"
          chevron={true}
          onPress={() => router.push('../pages/custom-settings-manager')}
        />

        {/* NovelAI Test
        <ListItem
          title="NovelAI 测试"
          leftIcon="image-outline"
          chevron={true}
          onPress={() => setShowNovelAITestModal(true)}
          subtitle="测试NovelAI连接和图像生成"
        /> */}

        {/* 新增：rFramework测试入口 */}
        <ListItem
          title="预设/世界书测试"
          leftIcon="flask-outline"
          chevron={true}
          onPress={() => router.push('/components/testframework')}
          subtitle="测试消息格式"
        />

        {/* 新增：工具设置入口 */}
        <ListItem
          title="工具设置"
          leftIcon="construct-outline"
          chevron={true}
          onPress={() => router.push('/pages/UtilSettings')}
          subtitle="自动消息提示词配置"
        />

        {/* 全局设置按钮 */}
        <ListItem
          title="全局设置"
          leftIcon="settings-outline"
          chevron={true}
          onPress={() => router.push('/pages/global-settings')}
          subtitle="预设 | 世界书 | 正则"
        />
        
        {/* Chat UI Settings button */}
        <ListItem
          title="界面设置"
          leftIcon="color-palette-outline"
          chevron={true}
          onPress={() => router.push('/pages/chat-ui-settings')}
          subtitle="自定义聊天界面外观"
        />
        
        {/* New: Plugin manager option */}
        {/* <ListItem
          title="插件管理"
          leftIcon="extension-puzzle-outline"
          chevron={true}
          onPress={() => router.push('/pages/plugins')}
          subtitle="管理插件"
        /> */}

        {/* <ListItem
          title="加入社区"
          leftIcon="people-outline"
          onPress={() => {
            // Add community links handling
          }}
          subtitle="Discord | QQ群"
        /> */}
        

        {/* <ListItem
          title="调试工具"
          leftIcon="construct-outline"
          chevron={true}
          onPress={() => router.push('../pages/debug-tools')}
          subtitle="角色数据检查"
        /> */}
        
        <ListItem
          title="关于"
          leftIcon="information-circle-outline"
          chevron={false}
          subtitle="GitHub | CradleAI | 1.0.4"
          onPress={() => Linking.openURL('https://github.com/AliceSyndrome285/CradleAI')}
        />
      </ScrollView>

      {/* 图片权限确认对话框 */}
      <ConfirmDialog
        visible={showPermissionDialog}
        title="需要权限"
        message="请允许访问相册以便选择头像图片"
        confirmText="确定"
        cancelText="取消"
        confirmAction={() => setShowPermissionDialog(false)}
        cancelAction={() => setShowPermissionDialog(false)}
        destructive={false}
        icon="alert-circle"
      />

      {/* NovelAI Test Modal */}
      <NovelAITestModal
        visible={showNovelAITestModal}
        onClose={() => setShowNovelAITestModal(false)}
        onImageGenerated={handleNovelAIImageGenerated}
      />

      {/* 使用新的LoadingIndicator组件 */}
      <LoadingIndicator 
        visible={isLoading} 
        text="处理中..."
        overlay={true}
        useModal={true}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerImage: {
    width: '100%',
    height: 160, // Reduced from 200
  },
  header: {
    marginTop: -50, // Reduced from -60
    padding: 12, // Reduced from 16
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  avatar: {
    width: 75, // Reduced from 90
    height: 75, // Reduced from 90
    borderRadius: 37.5, // Adjusted accordingly
    marginBottom: 12, // Reduced from 16
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 12, // Adjusted from 16
    right: 0,
    backgroundColor: theme.colors.primary,
    width: 26, // Reduced from 30
    height: 26, // Reduced from 30
    borderRadius: 13, // Adjusted accordingly
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  menuContainer: {
    flex: 1,
    paddingHorizontal: 8, // Add horizontal padding
  },
  menuContent: {
    paddingVertical: 8, // Add vertical padding
    paddingBottom: 20, // Extra bottom padding
  },
  content: {
    flex: 1,
  },
});

export default Profile;