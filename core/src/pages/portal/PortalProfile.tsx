import { useEffect, useState } from 'react'
import { apiGet, apiPatch } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { User, Save } from 'lucide-react'

export function PortalProfilePage() {
  const { profile, currentAccountId, refresh } = useAuth()
  const [person, setPerson] = useState<any>(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!currentAccountId || !profile?.person_id) return
    setLoading(true)
    apiGet<any>('persons', { id: profile.person_id })
      .then((res) => {
        setPerson(res)
        setFullName(res.full_name || '')
        setEmail(res.email || '')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [currentAccountId, profile?.person_id])

  async function handleSave() {
    if (!profile?.person_id || !fullName.trim()) return
    setSaving(true)
    setMessage(null)
    try {
      const updated = await apiPatch<any>('persons', {
        full_name: fullName,
        email,
      }, { id: profile.person_id })
      setPerson(updated)
      setMessage('Profile updated!')
      await refresh()
    } catch (err: any) {
      setMessage(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-lg font-semibold">{person?.full_name}</p>
              <p className="text-sm text-muted-foreground">{person?.email}</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Full Name</label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-1 h-4 w-4" />{saving ? 'Saving...' : 'Save'}
            </Button>
            {message && <p className="text-xs text-muted-foreground">{message}</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
