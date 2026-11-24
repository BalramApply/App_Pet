export const Colors = {
  primary: '#FF5A5F',        // Coral Red
  primaryLight: '#FFE8E9',
  primaryDark: '#D94348',
  mint: '#E8F5E9',           // Soft Mint
  mintDark: '#2E7D32',
  slateDark: '#1E1E2D',      // Slate Dark
  slateMuted: '#5A5A72',
  background: '#F7F8FA',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  info: '#2563EB',
  white: '#FFFFFF',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
};

export const Radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
};

export const Typography = {
  h1: { fontSize: 24, fontWeight: '700' as const, color: Colors.slateDark },
  h2: { fontSize: 20, fontWeight: '700' as const, color: Colors.slateDark },
  h3: { fontSize: 16, fontWeight: '600' as const, color: Colors.slateDark },
  body: { fontSize: 14, fontWeight: '400' as const, color: Colors.slateDark },
  caption: { fontSize: 12, fontWeight: '500' as const, color: Colors.slateMuted },
};