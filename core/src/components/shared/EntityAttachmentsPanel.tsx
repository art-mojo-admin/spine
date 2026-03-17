import { useEffect, useState, useRef } from 'react'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Paperclip, Upload, Trash2, Download, FileIcon } from 'lucide-react'

interface EntityAttachmentsPanelProps {
  entityType: string
  entityId: string
}

interface Attachment {
  id: string
  filename: string
  mime_type: string | null
  size_bytes: number | null
  storage_path: string
  uploaded_by: string | null
  created_at: string
  signed_url: string | null
  uploader?: { id: string; full_name: string } | null
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function EntityAttachmentsPanel({ entityType, entityId }: EntityAttachmentsPanelProps) {
  const { profile } = useAuth()
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLoading(true)
    apiGet<Attachment[]>('entity-attachments', {
      entity_type: entityType,
      entity_id: entityId,
    })
      .then(setAttachments)
      .catch(() => setAttachments([]))
      .finally(() => setLoading(false))
  }, [entityType, entityId])

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      // Step 1: Register attachment and get signed upload URL
      const result = await apiPost<any>('entity-attachments', {
        entity_type: entityType,
        entity_id: entityId,
        filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      })

      // Step 2: Upload file to signed URL
      if (result.upload_url) {
        await fetch(result.upload_url, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        })
      }

      // Step 3: Refresh list
      const updated = await apiGet<Attachment[]>('entity-attachments', {
        entity_type: entityType,
        entity_id: entityId,
      })
      setAttachments(updated)
    } catch {
      // Silently fail — user can retry
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiDelete('entity-attachments', { id })
      setAttachments((prev) => prev.filter((a) => a.id !== id))
    } catch {
      // Silently fail
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-base">
            <Paperclip className="h-4 w-4" />
            Attachments ({attachments.length})
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-1 h-3 w-3" />
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading attachments...</p>
        ) : attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attachments yet</p>
        ) : (
          <div className="space-y-2">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{att.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatSize(att.size_bytes)} • {att.uploader?.full_name || '—'} • {new Date(att.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {att.mime_type && (
                    <Badge variant="outline" className="text-[10px]">
                      {att.mime_type.split('/').pop()}
                    </Badge>
                  )}
                  {att.signed_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => window.open(att.signed_url!, '_blank')}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleDelete(att.id)}
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
