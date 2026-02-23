import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Package, Download, Check } from 'lucide-react'

interface ConfigPack {
  id: string
  name: string
  description: string | null
  is_system: boolean
  created_at: string
}

export function ConfigPacksPage() {
  const { currentAccountId } = useAuth()
  const [packs, setPacks] = useState<ConfigPack[]>([])
  const [loading, setLoading] = useState(true)
  const [installing, setInstalling] = useState<string | null>(null)
  const [installed, setInstalled] = useState<Record<string, string[]>>({})
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!currentAccountId) return
    setLoading(true)
    apiGet<ConfigPack[]>('config-packs')
      .then((data) => setPacks(data || []))
      .catch((err) => setErrorMessage(err?.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [currentAccountId])

  async function handleInstall(packId: string) {
    setInstalling(packId)
    setErrorMessage(null)
    try {
      const result = await apiPost<{ success: boolean; installed: string[] }>('config-packs', {
        action: 'install',
        pack_id: packId,
      })
      setInstalled((prev) => ({ ...prev, [packId]: result.installed || [] }))
    } catch (err: any) {
      setErrorMessage(err?.message || 'Install failed')
    } finally {
      setInstalling(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Template Packs</h1>
        <p className="mt-1 text-muted-foreground">
          Install pre-built configurations for common use cases. Each pack creates workflows, custom fields, link types, and automations.
        </p>
      </div>

      {errorMessage && (
        <Card><CardContent className="py-3 text-sm text-destructive">{errorMessage}</CardContent></Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading packs...</p>
      ) : packs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No template packs available.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {packs.map((pack) => {
            const isInstalled = !!installed[pack.id]
            const isInstalling = installing === pack.id

            return (
              <Card key={pack.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Package className="h-5 w-5 text-primary" />
                        {pack.name}
                      </CardTitle>
                      {pack.is_system && (
                        <Badge variant="secondary" className="mt-1 text-[10px]">Built-in</Badge>
                      )}
                    </div>
                  </div>
                  {pack.description && (
                    <CardDescription>{pack.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  {isInstalled ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <Check className="h-4 w-4" />
                        <span className="font-medium">Installed!</span>
                      </div>
                      <div className="max-h-32 overflow-y-auto rounded-md bg-muted p-2">
                        {installed[pack.id].map((item, i) => (
                          <p key={i} className="text-xs text-muted-foreground">{item}</p>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleInstall(pack.id)}
                      disabled={isInstalling}
                    >
                      <Download className="mr-1 h-4 w-4" />
                      {isInstalling ? 'Installing...' : 'Install'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
