import { useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { apiGet } from '@/lib/api'

interface NavExtension {
  id: string
  label: string
  url: string
}

export function ExtensionPage() {
  const { slug } = useParams<{ slug: string }>()
  const [ext, setExt] = useState<NavExtension | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const all = await apiGet<NavExtension[]>('nav-extensions')
        // Match by URL path /x/<slug>
        const match = all.find((e) => e.url === `/x/${slug}`)
        if (match) {
          setExt(match)
        } else {
          setError('Extension not found')
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading extension...</p>
      </div>
    )
  }

  if (error || !ext) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Extension Not Found</h2>
          <p className="text-sm text-muted-foreground">{error || 'No matching extension for this URL.'}</p>
        </div>
      </div>
    )
  }

  // If the URL is an absolute URL (starts with http), render in an iframe
  const isExternal = ext.url.startsWith('http://') || ext.url.startsWith('https://')

  if (isExternal) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-12 items-center border-b px-4">
          <h1 className="text-lg font-semibold">{ext.label}</h1>
        </div>
        <iframe
          src={ext.url}
          className="flex-1 w-full border-0"
          title={ext.label}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    )
  }

  // For internal /x/ paths, show a placeholder — these are resolved by nav_extensions
  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold">{ext.label}</h1>
      <p className="mt-2 text-muted-foreground">
        This is a custom extension page. Configure the URL to point to an external app to embed it here.
      </p>
    </div>
  )
}
