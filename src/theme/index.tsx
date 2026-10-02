import { createContext, useContext } from 'react';

export const darkTheme = {
  background: '#101419', surface: '#1A2026', elevated: '#252D34', hover: '#303A42',
  border: '#35414B', text: '#F4F5F0', muted: '#A7B2B6', subtle: '#76858B',
  blue: '#FF963C', cyan: '#68DDE1', purple: '#BA9CFC', amber: '#FFB35F', red: '#FF6B76',
  blueTint: '#453022', cyanTint: '#193B40', purpleTint: '#302945', amberTint: '#493729',
  light: false,
};
export const lightTheme: typeof darkTheme = {
  background: '#E6E8E7', surface: '#F7F8F5', elevated: '#E1E7E8', hover: '#D5DEE0',
  border: '#C7D0D1', text: '#182329', muted: '#52636B', subtle: '#708188',
  blue: '#B35414', cyan: '#117D82', purple: '#7252AE', amber: '#9F5519', red: '#B94350',
  blueTint: '#F7E2D0', cyanTint: '#D8EEED', purpleTint: '#ECE4F7', amberTint: '#F4E5D2',
  light: true,
};
export const ThemeContext = createContext(darkTheme);
export const useTheme = () => useContext(ThemeContext);
