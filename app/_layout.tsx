import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { Animated, useWindowDimensions, Easing, View, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { CharactersProvider } from '@/constants/CharactersContext';
import { UserProvider } from '@/constants/UserContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Colors from '@/constants/Colors';
import { RegexProvider } from '@/constants/RegexContext';
import { initCloudServiceTracker } from '@/utils/cloud-service-tracker';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme() || 'light';
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const { height: windowHeight } = useWindowDimensions();

  // Initialize cloud service tracker
  useEffect(() => {
    initCloudServiceTracker();
  }, []);

  // Use the correct theme structure that ReactNavigation expects
  const theme = colorScheme === 'dark' 
    ? { 
        ...DarkTheme, 
        colors: {
          ...DarkTheme.colors,
          primary: Colors.dark.tint,
          background: '#282828',
          card: '#333333',
          text: '#ffffff',
          border: 'rgba(255, 255, 255, 0.1)',
        }
      } 
    : { 
        ...DefaultTheme, 
        colors: {
          ...DefaultTheme.colors,
          primary: Colors.light.tint,
          background: '#f8f8f8',
          card: '#ffffff',
          text: '#333333',
          border: 'rgba(0, 0, 0, 0.1)',
        }
      };

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  const MyTransition = {
    gestureDirection: 'vertical' as const,
    transitionSpec: {
      duration: 250,
      easing: Easing.out(Easing.poly(4)),
      timing: Animated.timing,
      useNativeDriver: true,
    },
    screenInterpolator: ({ position, scene }: { position: Animated.Value; scene: { index: number; }; }) => {
      const thisSceneIndex = scene.index;

      const translateY = position.interpolate({
        inputRange: [thisSceneIndex - 1, thisSceneIndex],
        outputRange: [windowHeight, 0],
      });

      return { transform: [{ translateY }] };
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <UserProvider>
        <CharactersProvider>
          <RegexProvider>
            <View style={styles.container}>
              <ThemeProvider value={theme}>
                <Stack screenOptions={{headerShown: false}}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="pages/character-detail" />
                  <Stack.Screen name="pages/create_char" />
                  <Stack.Screen name="pages/create_character_tabs" />
                </Stack>
                <StatusBar style="dark" backgroundColor='black' />
              </ThemeProvider>
            </View>
          </RegexProvider>
        </CharactersProvider>
      </UserProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#282828',
  },
});
