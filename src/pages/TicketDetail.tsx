import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiGet, apiPost, apiPatch } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { EditableField } from '@/components/shared/EditableField'
import { CustomFieldsRenderer } from '@/components/shared/CustomFieldsRenderer'
import { EntityLinksPanel } from '@/components/shared/EntityLinksPanel'
import { EntityCommentsPanel } from '@/components/shared/EntityCommentsPanel'
import { WatchButton } from '@/components/shared/WatchButton'
import { EntityAttachmentsPanel } from '@/components/shared/EntityAttachmentsPanel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Pencil, Save, X, Ticket } from 'lucide-react'

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

export function TicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>()
  const navigate = useNavigate()
  const { currentAccountId } = useAuth()
  const isNew = ticketId === 'new'

  const [ticket, setTicket] = useState<any>(null)
  const [people, setPeople] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [editing, setEditing] = useState(isNew)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [status, setStatus] = useState('open')
  const [category, setCategory] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [customMeta, setCustomMeta] = useState<Record<string, any>>({})

  useEffect(() => {
    if (!currentAccountId) return

    async function load() {
      try {
        const pplRes = await apiGet<any[]>('persons')
        setPeople(pplRes || [])

        if (!isNew && ticketId) {
          setLoading(true)
          const [ticketRes, msgRes] = await Promise.all([
            apiGet<any>('tickets', { id: ticketId }),
            apiGet<any[]>('ticket-messages', { ticket_id: ticketId }),
          ])
          setTicket(ticketRes)
          setMessages(msgRes || [])
          setSubject(ticketRes.subject || '')
          setDescription(ticketRes.metadata?.description || '')
          setPriority(ticketRes.priority || 'medium')
          setStatus(ticketRes.status || 'open')
          setCategory(ticketRes.category || '')
          setAssignedTo(ticketRes.assigned_to_person_id || '')
          const { description: _desc, ...rest } = ticketRes.metadata || {}
          setCustomMeta(rest)
        }
      } catch (err: any) {
        setErrorMessage(err?.message || 'Failed to load')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [currentAccountId, ticketId, isNew])

  function resetDraft() {
    if (ticket) {
      setSubject(ticket.subject || '')
      setDescription(ticket.metadata?.description || '')
      setPriority(ticket.priority || 'medium')
      setStatus(ticket.status || 'open')
      setCategory(ticket.category || '')
      setAssignedTo(ticket.assigned_to_person_id || '')
      const { description: _desc, ...rest } = ticket.metadata || {}
      setCustomMeta(rest)
    }
    setEditing(false)
  }

  async function handleSave() {
    if (!subject.trim()) {
      setErrorMessage('Subject is required.')
      return
    }
    setSaving(true)
    setErrorMessage(null)
    try {
      if (isNew) {
        const created = await apiPost<any>('tickets', {
          subject,
          priority,
          category: category || undefined,
          assigned_to_person_id: assignedTo || undefined,
          metadata: { description: description || undefined, ...customMeta },
        })
        navigate(`/tickets/${created.id}`, { replace: true })
      } else {
        const updated = await apiPatch<any>('tickets', {
          subject,
          priority,
          status,
          category: category || undefined,
          assigned_to_person_id: assignedTo || undefined,
          metadata: { description: description || undefined, ...customMeta },
        }, { id: ticketId! })
        setTicket(updated)
        setEditing(false)
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-1 h-4 w-4" />Back
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Ticket</h1>
        </div>
        <Card><CardContent className="py-6 text-sm text-muted-foreground">Loading...</CardContent></Card>
      </div>
    )
  }

  const personOpts = [{ value: '', label: '— Unassigned —' }, ...people.map((p) => ({ value: p.id, label: p.full_name }))]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-1 h-4 w-4" />Back
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">
            {isNew ? 'New Ticket' : 'Ticket'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && !editing && ticketId && ticketId !== 'new' && (
            <WatchButton entityType="ticket" entityId={ticketId} />
          )}
          {!isNew && !editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="mr-1 h-4 w-4" />Edit
            </Button>
          )}
        </div>
      </div>

      {errorMessage && (
        <Card><CardContent className="py-3 text-sm text-destructive">{errorMessage}</CardContent></Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Ticket className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              {editing ? (
                <span className="text-lg font-semibold">{subject || 'Untitled Ticket'}</span>
              ) : (
                <>
                  <p className="text-lg font-semibold">{ticket?.subject}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant={ticket?.status === 'open' ? 'default' : 'secondary'}>{ticket?.status}</Badge>
                    <Badge>{ticket?.priority}</Badge>
                  </div>
                </>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <EditableField label="Subject" value={subject} editing={editing} onChange={setSubject} required placeholder="Ticket subject" />
            <EditableField label="Priority" value={priority} editing={editing} onChange={setPriority} type="select" options={PRIORITIES} />
            {!isNew && (
              <EditableField label="Status" value={status} editing={editing} onChange={setStatus} type="select" options={STATUSES} />
            )}
            <EditableField label="Category" value={category} editing={editing} onChange={setCategory} placeholder="e.g. billing, support" />
            <EditableField
              label="Assigned To"
              value={editing ? assignedTo : ticket?.assigned_to?.full_name}
              editing={editing}
              onChange={setAssignedTo}
              type="select"
              options={personOpts}
            />
            {!isNew && !editing && (
              <EditableField
                label="Opened By"
                value={ticket?.opened_by?.full_name}
                editing={false}
                onChange={() => {}}
              />
            )}
          </div>
          <div className="mt-4">
            <EditableField label="Description" value={description} editing={editing} onChange={setDescription} type="richtext" placeholder="Describe the issue..." />
          </div>

          {!isNew && !editing && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd>{ticket?.created_at ? new Date(ticket.created_at).toLocaleString() : '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Ticket ID</dt>
                <dd className="font-mono text-xs break-all">{ticket?.id}</dd>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {editing && (
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-1 h-4 w-4" />{saving ? 'Saving...' : 'Save'}
          </Button>
          {!isNew && (
            <Button variant="ghost" onClick={resetDraft}>
              <X className="mr-1 h-4 w-4" />Cancel
            </Button>
          )}
        </div>
      )}

      {!isNew && (
        <CustomFieldsRenderer
          entityType="ticket"
          metadata={customMeta}
          editing={editing}
          onChange={setCustomMeta}
        />
      )}

      {!isNew && !editing && ticketId && ticketId !== 'new' && (
        <EntityLinksPanel entityType="ticket" entityId={ticketId} />
      )}

      {!isNew && !editing && ticketId && ticketId !== 'new' && (
        <EntityCommentsPanel entityType="ticket" entityId={ticketId} />
      )}

      {!isNew && !editing && ticketId && ticketId !== 'new' && (
        <EntityAttachmentsPanel entityType="ticket" entityId={ticketId} />
      )}

      {/* Messages thread */}
      {!isNew && messages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Messages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {messages.map((msg: any) => (
              <div key={msg.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{msg.sender?.full_name || 'System'}</p>
                  <p className="text-xs text-muted-foreground">{new Date(msg.created_at).toLocaleString()}</p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{msg.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
