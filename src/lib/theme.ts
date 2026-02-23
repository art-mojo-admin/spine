export interface ThemeTokens {
  primary: string
  'primary-foreground': string
  secondary: string
  'secondary-foreground': string
  background: string
  foreground: string
  muted: string
  'muted-foreground': string
  accent: string
  'accent-foreground': string
  card: string
  'card-foreground': string
  popover: string
  'popover-foreground': string
  border: string
  input: string
  ring: string
  destructive: string
  'destructive-foreground': string
  radius: string
  'font-sans': string
}

export const THEME_PRESETS: Record<string, Partial<ThemeTokens>> = {
  clean: {
    primary: '221 83% 53%',
    'primary-foreground': '210 40% 98%',
    background: '0 0% 100%',
    foreground: '240 10% 3.9%',
    muted: '210 40% 96.1%',
    'muted-foreground': '215.4 16.3% 46.9%',
    border: '214.3 31.8% 91.4%',
    radius: '0.625rem',
    'font-sans': "'Inter', system-ui, -apple-system, sans-serif",
  },
  bold: {
    primary: '262 83% 58%',
    'primary-foreground': '210 40% 98%',
    background: '222.2 84% 4.9%',
    foreground: '210 40% 98%',
    muted: '217.2 32.6% 17.5%',
    'muted-foreground': '215 20.2% 65.1%',
    border: '217.2 32.6% 17.5%',
    radius: '0.75rem',
    'font-sans': "'Inter', system-ui, -apple-system, sans-serif",
  },
  muted: {
    primary: '25 34% 45%',
    'primary-foreground': '40 33% 96%',
    background: '40 33% 96%',
    foreground: '20 14.3% 14.1%',
    muted: '40 20% 90%',
    'muted-foreground': '25 5.3% 44.7%',
    border: '30 15% 85%',
    radius: '0.5rem',
    'font-sans': "'Georgia', 'Times New Roman', serif",
  },
}

export function applyThemeTokens(tokens: Partial<ThemeTokens>) {
  const root = document.documentElement
  Object.entries(tokens).forEach(([key, value]) => {
    if (value !== undefined) {
      if (key === 'radius' || key === 'font-sans') {
        root.style.setProperty(`--${key}`, value)
      } else {
        root.style.setProperty(`--${key}`, value)
      }
    }
  })
}

export function clearThemeTokens() {
  const root = document.documentElement
  root.removeAttribute('style')
}
