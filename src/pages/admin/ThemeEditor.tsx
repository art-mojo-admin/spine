import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { THEME_PRESETS, applyThemeTokens, type ThemeTokens } from '@/lib/theme'

export function ThemeEditorPage() {
  const { currentAccountId } = useAuth()
  const [theme, setTheme] = useState<any>(null)
  const [tokens, setTokens] = useState<Partial<ThemeTokens>>({})
  const [preset, setPreset] = useState('clean')
  const [logoUrl, setLogoUrl] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentAccountId) return
    apiGet<any>('themes')
      .then(data => {
        setTheme(data)
        setPreset(data.preset || 'clean')
        setTokens(data.tokens || {})
        setLogoUrl(data.logo_url || '')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [currentAccountId])

  function applyPreset(p: string) {
    setPreset(p)
    const presetTokens = THEME_PRESETS[p] || {}
    setTokens(presetTokens)
    applyThemeTokens(presetTokens)
  }

  function updateToken(key: string, value: string) {
    const updated = { ...tokens, [key]: value }
    setTokens(updated)
    applyThemeTokens(updated)
  }

  async function save() {
    await apiPost('themes', { preset, tokens, logo_url: logoUrl || null })
  }

  const tokenFields = [
    { key: 'primary', label: 'Primary' },
    { key: 'primary-foreground', label: 'Primary Foreground' },
    { key: 'background', label: 'Background' },
    { key: 'foreground', label: 'Foreground' },
    { key: 'muted', label: 'Muted' },
    { key: 'muted-foreground', label: 'Muted Foreground' },
    { key: 'border', label: 'Border' },
    { key: 'radius', label: 'Border Radius' },
    { key: 'font-sans', label: 'Font Family' },
  ]

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Theme Editor</h1>
        <p className="mt-1 text-muted-foreground">Customize your tenant's look and feel</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Presets</CardTitle>
          <CardDescription>Start with a preset, then customize individual tokens</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          {(['clean', 'bold', 'muted'] as const).map(p => (
            <Button
              key={p}
              variant={preset === p ? 'default' : 'outline'}
              onClick={() => applyPreset(p)}
              className="capitalize"
            >
              {p}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
        </CardHeader>
        <CardContent>
          <Input placeholder="Logo URL" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} className="max-w-md" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Color Tokens</CardTitle>
          <CardDescription>HSL values (e.g., "221 83% 53%") or CSS values for radius/font</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {tokenFields.map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <label className="text-sm font-medium">{label}</label>
                <Input
                  value={(tokens as any)[key] || ''}
                  onChange={e => updateToken(key, e.target.value)}
                  placeholder={`--${key}`}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={save}>Save Theme</Button>
        <Button variant="outline" onClick={() => applyPreset('clean')}>Reset to Clean</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Preview</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button>Primary Button</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm">This is a preview of your theme tokens applied in real-time.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
