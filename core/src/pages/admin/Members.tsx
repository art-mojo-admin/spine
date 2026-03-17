import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Copy, UserPlus, Trash2, Users } from 'lucide-react'

export function MembersPage() {
  const { currentAccountId } = useAuth()
  const [members, setMembers] = useState<any[]>([])
  const [invites, setInvites] = useState<any[]>([])
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (!currentAccountId) return
    loadData()
  }, [currentAccountId])

  async function loadData() {
    setLoading(true)
    try {
      const [membersData, invitesData] = await Promise.all([
        apiGet<any[]>('memberships'),
        apiGet<any[]>('invites'),
      ])
      setMembers(membersData)
      setInvites(invitesData)
    } catch {}
    setLoading(false)
  }

  async function sendInvite() {
    if (!inviteEmail.trim()) return
    await apiPost('invites', { email: inviteEmail, account_role: inviteRole })
    setInviteEmail('')
    setShowInvite(false)
    loadData()
  }

  async function revokeInvite(id: string) {
    await apiDelete(`invites?id=${id}`)
    loadData()
  }

  function copyInviteLink(token: string) {
    const url = `${window.location.origin}/login?invite=${token}`
    navigator.clipboard.writeText(url)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  const statusColor = (s: string) =>
    s === 'active' ? 'default' : s === 'pending' ? 'secondary' : 'outline'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Members</h1>
          <p className="mt-1 text-muted-foreground">Manage team members and invitations</p>
        </div>
        <Button onClick={() => setShowInvite(true)} size="sm">
          <UserPlus className="mr-2 h-4 w-4" /> Invite Member
        </Button>
      </div>

      {showInvite && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="flex items-center gap-3">
              <Input
                placeholder="Email address"
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                className="flex-1"
              />
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value)}
                className="rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="member">Member</option>
                <option value="operator">Operator</option>
                <option value="admin">Admin</option>
              </select>
              <Button onClick={sendInvite}>Send Invite</Button>
              <Button variant="ghost" onClick={() => setShowInvite(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {invites.filter(i => i.status === 'pending').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pending Invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invites
                .filter(i => i.status === 'pending')
                .map((invite: any) => (
                  <div key={invite.id} className="flex items-center gap-4 rounded-lg border p-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{invite.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Expires {new Date(invite.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="secondary">{invite.account_role}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyInviteLink(invite.token)}
                    >
                      <Copy className="mr-1 h-3 w-3" />
                      {copied === invite.token ? 'Copied!' : 'Copy Link'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revokeInvite(invite.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Current Members</CardTitle>
          <CardDescription>{members.length} member{members.length !== 1 ? 's' : ''}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members found</p>
          ) : (
            <div className="space-y-3">
              {members.map((m: any) => (
                <div key={m.id} className="flex items-center gap-4 rounded-lg border p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{m.persons?.full_name || m.person_id}</p>
                    <p className="text-xs text-muted-foreground">{m.persons?.email || ''}</p>
                  </div>
                  <Badge variant={statusColor(m.status) as any}>{m.account_role}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
