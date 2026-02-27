import { useEffect, useState, useCallback } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { MessageSquare, Send, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Thread {
  id: string
  target_type: string
  target_id: string
  thread_type: string
  visibility: string
  status: string
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

interface Message {
  id: string
  thread_id: string
  person_id: string | null
  direction: string
  body: string
  sequence: number
  visibility: string
  metadata: Record<string, any>
  created_at: string
  persons?: { id: string; full_name: string } | null
}

interface ThreadPanelProps {
  targetType: string
  targetId: string
  threadType?: string
  title?: string
  className?: string
}

export function ThreadPanel({
  targetType,
  targetId,
  threadType = 'discussion',
  title = 'Discussion',
  className,
}: ThreadPanelProps) {
  const { profile } = useAuth()
  const [threads, setThreads] = useState<Thread[]>([])
  const [activeThread, setActiveThread] = useState<Thread | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [expanded, setExpanded] = useState(true)

  const loadThreads = useCallback(async () => {
    try {
      const data = await apiGet<Thread[]>('threads', {
        target_type: targetType,
        target_id: targetId,
        thread_type: threadType,
      })
      setThreads(data)
      if (data.length > 0 && !activeThread) {
        setActiveThread(data[0])
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false)
    }
  }, [targetType, targetId, threadType, activeThread])

  const loadMessages = useCallback(async () => {
    if (!activeThread) return
    try {
      const data = await apiGet<Message[]>('messages', {
        thread_id: activeThread.id,
      })
      setMessages(data)
    } catch {
      // silently handle
    }
  }, [activeThread])

  useEffect(() => {
    loadThreads()
  }, [targetType, targetId])

  useEffect(() => {
    if (activeThread) loadMessages()
  }, [activeThread])

  const handleCreateThread = async () => {
    try {
      const thread = await apiPost<Thread>('threads', {
        target_type: targetType,
        target_id: targetId,
        thread_type: threadType,
        visibility: 'internal',
      })
      setThreads(prev => [thread, ...prev])
      setActiveThread(thread)
    } catch {
      // silently handle
    }
  }

  const handleSend = async () => {
    if (!newMessage.trim()) return

    // Auto-create thread if none exists
    let threadId = activeThread?.id
    if (!threadId) {
      try {
        const thread = await apiPost<Thread>('threads', {
          target_type: targetType,
          target_id: targetId,
          thread_type: threadType,
          visibility: 'internal',
        })
        setThreads(prev => [thread, ...prev])
        setActiveThread(thread)
        threadId = thread.id
      } catch {
        return
      }
    }

    setSending(true)
    try {
      const message = await apiPost<Message>('messages', {
        thread_id: threadId,
        body: newMessage.trim(),
        direction: 'internal',
      })
      setMessages(prev => [...prev, message])
      setNewMessage('')
    } catch {
      // silently handle
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const directionLabel = (dir: string) => {
    switch (dir) {
      case 'inbound': return 'Inbound'
      case 'outbound': return 'Outbound'
      default: return 'Internal'
    }
  }

  const directionColor = (dir: string) => {
    switch (dir) {
      case 'inbound': return 'text-blue-600'
      case 'outbound': return 'text-green-600'
      default: return 'text-muted-foreground'
    }
  }

  return (
    <div className={cn('rounded-lg border bg-card', className)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent/50 rounded-t-lg"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          {title}
          {messages.length > 0 && (
            <span className="text-xs text-muted-foreground">({messages.length})</span>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {expanded && (
        <div className="border-t">
          {loading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading...</div>
          ) : (
            <>
              <div className="max-h-80 overflow-y-auto p-3 space-y-3">
                {messages.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No messages yet. Start the conversation below.
                  </p>
                )}
                {messages.map((msg) => (
                  <div key={msg.id} className="flex gap-2">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                      {(msg.persons?.full_name || 'S')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium">
                          {msg.persons?.full_name || 'System'}
                        </span>
                        <span className={cn('text-[10px]', directionColor(msg.direction))}>
                          {directionLabel(msg.direction)}
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(msg.created_at).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="mt-0.5 text-sm whitespace-pre-wrap break-words">
                        {msg.body}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t p-3">
                <div className="flex gap-2">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    rows={1}
                    className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Button
                    size="sm"
                    onClick={handleSend}
                    disabled={!newMessage.trim() || sending}
                    className="self-end"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
