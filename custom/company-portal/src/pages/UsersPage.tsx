import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPatch, apiDelete } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import {
  UserPlus, Copy, Trash2, Users, Shield, Pencil, Check, X, Mail, Clock,
} from 'lucide-react'

const ROLES = ['member', 'operator', 'admin'] as const
type Role = typeof ROLES[number]

const roleBadgeVariant = (role: string): 'default' | 'secondary' | 'outline' => {
  if (role === 'admin') return 'default'
  if (role === 'operator') return 'secondary'
  return 'outline'
}

export default function UsersPage() {
  const { currentAccountId } = useAuth()
  const [members, setMembers] = useState<any[]>([])
  const [invites, setInvites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('member')
  const [inviting, setInviting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState<Role>('member')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (currentAccountId) loadData()
  }, [currentAccountId])

  async function loadData() {
    setLoading(true)
    try {
      const [membersData, invitesData] = await Promise.all([
        apiGet<any[]>('memberships'),
        apiGet<any[]>('invites'),
      ])
      setMembers(membersData || [])
      setInvites(invitesData || [])
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  async function sendInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setError(null)
    try {
      await apiPost('invites', { email: inviteEmail.trim(), account_role: inviteRole })
      setInviteEmail('')
      setInviteRole('member')
      setShowInvite(false)
      loadData()
    } catch (e: any) {
      setError(e.message)
    }
    setInviting(false)
  }

  async function saveRole(id: string) {
    setSaving(true)
    try {
      await apiPatch(`memberships?id=${id}`, { account_role: editRole })
      setEditingId(null)
      loadData()
    } catch (e: any) {
      setError(e.message)
    }
    setSaving(false)
  }

  async function removeMember(id: string, name: string) {
    if (!confirm(`Remove ${name} from this account?`)) return
    try {
      await apiDelete(`memberships?id=${id}`)
      loadData()
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function revokeInvite(id: string) {
    try {
      await apiDelete(`invites?id=${id}`)
      loadData()
    } catch (e: any) {
      setError(e.message)
    }
  }

  function copyInviteLink(token: string) {
    const url = `${window.location.origin}/login?invite=${token}`
    navigator.clipboard.writeText(url)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  const pendingInvites = invites.filter(i => i.status === 'pending')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="mt-1 text-muted-foreground">
            Manage members, roles, and pending invitations
          </p>
        </div>
        <Button onClick={() => setShowInvite(v => !v)} size="sm">
          <UserPlus className="mr-2 h-4 w-4" /> Invite User
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {showInvite && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite a new user</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Input
                placeholder="Email address"
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendInvite()}
                className="flex-1"
                autoFocus
              />
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as Role)}
                className="rounded-md border bg-background px-3 py-2 text-sm"
              >
                {ROLES.map(r => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
              <Button onClick={sendInvite} disabled={inviting || !inviteEmail.trim()}>
                {inviting ? 'Sending…' : 'Send Invite'}
              </Button>
              <Button variant="ghost" onClick={() => { setShowInvite(false); setInviteEmail('') }}>
                Cancel
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              <strong>Member</strong> — customer-facing portal only.{' '}
              <strong>Operator</strong> — support queue, KB, analytics.{' '}
              <strong>Admin</strong> — full account management.
            </p>
          </CardContent>
        </Card>
      )}

      {pendingInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Pending Invitations
            </CardTitle>
            <CardDescription>{pendingInvites.length} waiting to accept</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingInvites.map((invite: any) => (
                <div key={invite.id} className="flex items-center gap-4 rounded-lg border px-4 py-3">
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{invite.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Expires {new Date(invite.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={roleBadgeVariant(invite.account_role)}>{invite.account_role}</Badge>
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
                    title="Revoke invite"
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
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Active Members
          </CardTitle>
          <CardDescription>{members.length} member{members.length !== 1 ? 's' : ''}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members found.</p>
          ) : (
            <div className="space-y-2">
              {members.map((m: any) => {
                const isEditing = editingId === m.id
                const displayName = m.persons?.full_name || m.person_id
                return (
                  <div key={m.id} className="flex items-center gap-4 rounded-lg border px-4 py-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Shield className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {m.persons?.email || ''}
                      </p>
                    </div>

                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={editRole}
                          onChange={e => setEditRole(e.target.value as Role)}
                          className="rounded-md border bg-background px-2 py-1 text-sm"
                          autoFocus
                        >
                          {ROLES.map(r => (
                            <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                          ))}
                        </select>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={saving}
                          onClick={() => saveRole(m.id)}
                          title="Save"
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(null)}
                          title="Cancel"
                        >
                          <X className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge variant={roleBadgeVariant(m.account_role)}>{m.account_role}</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setEditingId(m.id); setEditRole(m.account_role) }}
                          title="Edit role"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMember(m.id, displayName)}
                          title="Remove member"
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
