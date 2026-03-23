import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Download, CheckCircle, ExternalLink, Package, Users, Settings, Zap, Star, Calendar, User } from 'lucide-react'

// This would be fetched from API in real implementation
const mockAppDetails: Record<string, any> = {
  'member-portal': {
    slug: 'member-portal',
    name: 'Member Portal',
    description: 'Self-service portal for end users with knowledge base, support tickets, and community features. Provides a comprehensive dashboard for members to access all essential services.',
    version: '1.2.0',
    category: 'Portals',
    icon: Users,
    is_premium: false,
    is_installed: true,
    is_active: true,
    install_type: 'npm',
    npm_package: '@spine/member-portal',
    install_prompt: 'Please run: npm install @spine/member-portal',
    screenshots: [],
    author: 'Spine Framework',
    author_url: 'https://spine.dev',
    documentation_url: 'https://docs.spine.dev/member-portal',
    support_url: 'https://support.spine.dev',
    downloads: 1247,
    rating: 4.8,
    rating_count: 89,
    last_updated: '2024-03-15',
    published_date: '2024-01-20',
    requires_scopes: [],
    features: [
      'Knowledge Base with full-text search',
      'Support ticket submission and tracking',
      'Community forums with moderation',
      'User dashboard with quick actions',
      'Profile management',
      'Notification preferences'
    ],
    changelog: [
      { version: '1.2.0', date: '2024-03-15', changes: ['Added notification preferences', 'Improved search performance', 'Fixed mobile navigation issues'] },
      { version: '1.1.0', date: '2024-02-28', changes: ['Added community forums', 'Enhanced ticket workflow', 'New dashboard widgets'] },
      { version: '1.0.0', date: '2024-01-20', changes: ['Initial release', 'Knowledge base', 'Support tickets', 'User dashboard'] }
    ],
    dependencies: ['@spine/core >= 2.0.0'],
    size: '2.4 MB',
    license: 'MIT'
  }
}

export function MarketplaceDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { currentAccountId } = useAuth()
  const [app, setApp] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // In real implementation, fetch from API
    const appData = mockAppDetails[slug || '']
    if (appData) {
      setApp(appData)
    }
    setLoading(false)
  }, [slug])

  const handleToggleApp = async () => {
    // Mock toggle - in real implementation would call API
    setApp(prev => prev ? { ...prev, is_active: !prev.is_active } : null)
  }

  const handleCopyInstallCommand = () => {
    if (app?.install_prompt) {
      navigator.clipboard.writeText(app.install_prompt)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading app details...</div>
      </div>
    )
  }

  if (!app) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/admin/marketplace')}>
          ← Back to Marketplace
        </Button>
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">App not found</h3>
          <p className="text-muted-foreground">
            The app you're looking for doesn't exist or has been removed.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/admin/marketplace')}>
          ← Back to Marketplace
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* App Header */}
          <Card>
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <app.icon className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-2xl">{app.name}</CardTitle>
                      <CardDescription className="text-base mt-2">
                        {app.description}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{app.category}</Badge>
                        {app.is_premium && (
                          <Badge variant="outline">Premium</Badge>
                        )}
                        {app.is_installed && (
                          <Badge variant="default">Installed</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <Star className="h-4 w-4 text-yellow-500 fill-current" />
                        <span className="font-medium">{app.rating}</span>
                        <span className="text-muted-foreground">({app.rating_count})</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                    <span>v{app.version}</span>
                    <span>•</span>
                    <span>Updated {app.last_updated}</span>
                    <span>•</span>
                    <span>{app.downloads.toLocaleString()} downloads</span>
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Features */}
          <Card>
            <CardHeader>
              <CardTitle>Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {app.features.map((feature: string, index: number) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Installation */}
          <Card>
            <CardHeader>
              <CardTitle>Installation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-mono">{app.install_prompt}</p>
                </div>
                <Button 
                  className="w-full"
                  onClick={handleCopyInstallCommand}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Copy Install Command
                </Button>
              </div>
              
              {app.requires_scopes.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Required Scopes</h4>
                  <div className="flex flex-wrap gap-2">
                    {app.requires_scopes.map((scope: string, index: number) => (
                      <Badge key={index} variant="outline">{scope}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold mb-2">Dependencies</h4>
                <div className="space-y-1">
                  {app.dependencies.map((dep: string, index: number) => (
                    <div key={index} className="text-sm text-muted-foreground">
                      • {dep}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Changelog */}
          <Card>
            <CardHeader>
              <CardTitle>Changelog</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {app.changelog.map((release: any, index: number) => (
                  <div key={index} className="border-l-2 border-border pl-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">v{release.version}</span>
                      <span className="text-sm text-muted-foreground">{release.date}</span>
                    </div>
                    <ul className="text-sm space-y-1">
                      {release.changes.map((change: string, changeIndex: number) => (
                        <li key={changeIndex} className="text-muted-foreground">
                          • {change}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* App Management */}
          <Card>
            <CardHeader>
              <CardTitle>App Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {app.is_installed ? (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Status</span>
                      <Badge variant={app.is_active ? "default" : "secondary"}>
                        {app.is_active ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                    <Button 
                      className="w-full"
                      variant={app.is_active ? "destructive" : "default"}
                      onClick={handleToggleApp}
                    >
                      {app.is_active ? "Disable App" : "Enable App"}
                    </Button>
                  </div>
                  <div className="pt-4 border-t space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Installed version: {app.version}
                    </p>
                    <Button variant="outline" className="w-full">
                      Check for Updates
                    </Button>
                    <Button variant="outline" className="w-full">
                      Uninstall App
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="text-center py-4">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Not installed
                    </p>
                  </div>
                  <Button className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Install App
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* App Info */}
          <Card>
            <CardHeader>
              <CardTitle>App Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Author</span>
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span className="text-sm font-medium">{app.author}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Size</span>
                <span className="text-sm font-medium">{app.size}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">License</span>
                <span className="text-sm font-medium">{app.license}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Downloads</span>
                <span className="text-sm font-medium">{app.downloads.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Rating</span>
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3 text-yellow-500 fill-current" />
                  <span className="text-sm font-medium">{app.rating}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Published</span>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span className="text-sm font-medium">{app.published_date}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Install Type</span>
                <span className="text-sm font-medium uppercase">{app.install_type}</span>
              </div>
            </CardContent>
          </Card>

          {/* Links */}
          <Card>
            <CardHeader>
              <CardTitle>Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {app.documentation_url && (
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href={app.documentation_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Documentation
                  </a>
                </Button>
              )}
              {app.support_url && (
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href={app.support_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Support
                  </a>
                </Button>
              )}
              {app.author_url && (
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href={app.author_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Author Website
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
