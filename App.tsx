import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';

import { BootstrapGate } from '@/bootstrap/BootstrapGate';
import { ToastProvider } from '@/components/ui';
import { RootNavigator } from '@/navigation/RootNavigator';
import { store } from '@/store';
import { ThemeProvider, useAppTheme } from '@/theme/ThemeContext';

function AppContent() {
  const { isDark } = useAppTheme();
  return (
    <>
      <BootstrapGate>
        <RootNavigator />
      </BootstrapGate>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Provider store={store}>
          <ThemeProvider>
            <ToastProvider>
              <AppContent />
            </ToastProvider>
          </ThemeProvider>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
