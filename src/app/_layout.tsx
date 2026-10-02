import React from 'react';
import {Slot} from 'expo-router';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {StatusBar} from 'expo-status-bar';
import {AppProvider,useApp} from '../state/AppContext';
import {darkTheme,lightTheme,ThemeContext} from '../theme';
import {ErrorBoundary} from '../components/ErrorBoundary';
import {AppShell} from '../navigation/AppShell';
function LayoutContent(){const {settings}=useApp();return <ThemeContext.Provider value={settings.light?lightTheme:darkTheme}><StatusBar style={settings.light?'dark':'light'}/><AppShell><Slot/></AppShell></ThemeContext.Provider>;}
export default function RootLayout(){return <ErrorBoundary><SafeAreaProvider><AppProvider><LayoutContent/></AppProvider></SafeAreaProvider></ErrorBoundary>;}
