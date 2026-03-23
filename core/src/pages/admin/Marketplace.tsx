import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Download, CheckCircle, ExternalLink, Package, Users, MessageSquare, Settings, Zap } from 'lucide-react'

// Mock marketplace data
const mockApps = [
  {
    slug: 'customer-portal',
    name: 'Customer Portal',
    description: 'Self-service portal for customers with knowledge base, support tickets, and community features.',
    version: '1.0.0',
    category: 'Portals',
    icon: Users,
    is_premium: false,
    is_installed: true,
    is_active: true,
    install_type: 'npm',
    npm_package: '@spine/customer-portal',
    install_prompt: 'Please run: npm install @spine/customer-portal',
    screenshots: [],
    author: 'Spine Framework',
    downloads: 1247,
    rating: 4.8,
    last_updated: '2024-03-15',
    requires_scopes: [],
    features: ['Knowledge Base with full-text search', 'Support ticket submission and tracking', 'Community forums with moderation', 'User dashboard with quick actions', 'Profile management', 'Notification preferences']
  },
  {
    slug: 'company-portal',
    name: 'Company Portal',
    description: 'Advanced tools for support operators including queue management, knowledge editing, and analytics.',
    version: '1.0.0',
    category: 'Operations',
    icon: Settings,
    is_premium: false,
    is_installed: true,
    is_active: true,
    install_type: 'npm',
    npm_package: '@spine/company-portal',
    install_prompt: 'Please run: npm install @spine/company-portal',
    screenshots: [],
    author: 'Spine Framework',
    downloads: 892,
    rating: 4.6,
    last_updated: '2024-03-18',
    requires_scopes: ['admin.automations', 'admin.audit'],
    features: ['Support Queue', 'Knowledge Management', 'Analytics Dashboard', 'User Management']
  },
  {
    slug: 'advanced-automations',
    name: 'Advanced Automations',
    description: 'Powerful automation engine with visual workflow builder and custom triggers.',
    version: '3.0.0',
    category: 'Automation',
    icon: Zap,
    is_premium: true,
    is_installed: false,
    is_active: false,
    install_type: 'npm',
    npm_package: '@spine/advanced-automations',
    install_prompt: 'Please run: npm install @spine/advanced-automations',
    screenshots: [],
    author: 'Spine Labs',
    downloads: 456,
    rating: 4.9,
    last_updated: '2024-03-20',
    requires_scopes: ['admin.automations'],
    features: ['Visual Workflow Builder', 'Custom Triggers', 'Advanced Scheduling', 'Performance Analytics']
  },
  {
    slug: 'crm-integration',
    name: 'CRM Integration',
    description: 'Seamless integration with popular CRM platforms for unified customer management.',
    version: '1.5.0',
    category: 'Integrations',
    icon: Package,
    is_premium: true,
    is_installed: false,
    is_active: false,
    install_type: 'git',
    git_url: 'https://github.com/spine-apps/crm-integration',
    install_prompt: 'Please run: git clone https://github.com/spine-apps/crm-integration core/crm-integration',
    screenshots: [],
    author: 'Spine Partners',
    downloads: 312,
    rating: 4.4,
    last_updated: '2024-03-10',
    requires_scopes: ['admin.integrations'],
    features: ['Salesforce Sync', 'HubSpot Integration', 'Contact Management', 'Deal Tracking']
  }
]

const categories = ['All', 'Portals', 'Operations', 'Automation', 'Integrations']

export function MarketplacePage() {
  const { currentAccountId } = useAuth()
  const [apps, setApps] = useState(mockApps)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedApp, setSelectedApp] = useState<string | null>(null)

  const filteredApps = apps.filter(app => {
    const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         app.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === 'All' || app.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const handleToggleApp = async (appSlug: string) => {
    // Mock toggle - in real implementation would call API
    setApps(prev => prev.map(app => 
      app.slug === appSlug 
        ? { ...app, is_active: !app.is_active }
        : app
    ))
  }

  const handleInstall = (app: any) => {
    // In real implementation, this would copy the install prompt to clipboard
    // and navigate to app detail page
    setSelectedApp(app.slug)
  }

  const selectedAppData = apps.find(app => app.slug === selectedApp)

  if (selectedApp && selectedAppData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setSelectedApp(null)}>
            ← Back to Marketplace
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <selectedAppData.icon className="h-8 w-8 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-2xl">{selectedAppData.name}</CardTitle>
                    <CardDescription className="text-base mt-2">
                      {selectedAppData.description}
                    </CardDescription>
                    <div className="flex items-center gap-4 mt-4">
                      <Badge variant="secondary">{selectedAppData.category}</Badge>
                      {selectedAppData.is_premium && (
                        <Badge variant="outline">Premium</Badge>
                      )}
                      {selectedAppData.is_installed && (
                        <Badge variant="default">Installed</Badge>
                      )}
                      <span className="text-sm text-muted-foreground">
                        v{selectedAppData.version}
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Features</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedAppData.features.map((feature: string, index: number) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Installation</h3>
                  <div className="space-y-3">
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-mono">{selectedAppData.install_prompt}</p>
                    </div>
                    <Button 
                      className="w-full"
                      onClick={() => navigator.clipboard.writeText(selectedAppData.install_prompt)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Copy Install Command
                    </Button>
                  </div>
                </div>

                {selectedAppData.requires_scopes.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Required Scopes</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedAppData.requires_scopes.map((scope: string, index: number) => (
                        <Badge key={index} variant="outline">{scope}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>App Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedAppData.is_installed ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Status</span>
                        <Badge variant={selectedAppData.is_active ? "default" : "secondary"}>
                          {selectedAppData.is_active ? "Active" : "Disabled"}
                        </Badge>
                      </div>
                      <Button 
                        className="w-full"
                        variant={selectedAppData.is_active ? "destructive" : "default"}
                        onClick={() => handleToggleApp(selectedAppData.slug)}
                      >
                        {selectedAppData.is_active ? "Disable App" : "Enable App"}
                      </Button>
                    </div>
                    <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground mb-2">
                        Installed version: {selectedAppData.version}
                      </p>
                      <Button variant="outline" className="w-full">
                        Check for Updates
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
                    <Button className="w-full" onClick={() => handleInstall(selectedAppData)}>
                      <Download className="h-4 w-4 mr-2" />
                      Install App
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>App Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Author</span>
                  <span className="text-sm font-medium">{selectedAppData.author}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Downloads</span>
                  <span className="text-sm font-medium">{selectedAppData.downloads.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Rating</span>
                  <span className="text-sm font-medium">⭐ {selectedAppData.rating}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Last Updated</span>
                  <span className="text-sm font-medium">{selectedAppData.last_updated}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Install Type</span>
                  <span className="text-sm font-medium uppercase">{selectedAppData.install_type}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Marketplace</h1>
        <p className="mt-1 text-muted-foreground">
          Discover and install apps to extend your Spine instance
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search apps..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map(category => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredApps.map((app) => (
          <Card key={app.slug} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <app.icon className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg truncate">{app.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {app.description}
                  </CardDescription>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs">
                      {app.category}
                    </Badge>
                    {app.is_premium && (
                      <Badge variant="outline" className="text-xs">Premium</Badge>
                    )}
                    {app.is_installed && (
                      <Badge variant="default" className="text-xs">Installed</Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>⭐ {app.rating}</span>
                  <span>{app.downloads.toLocaleString()} downloads</span>
                </div>
                <Button 
                  className="w-full"
                  variant={app.is_installed ? "outline" : "default"}
                  onClick={() => setSelectedApp(app.slug)}
                >
                  {app.is_installed ? "Manage" : "View Details"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredApps.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">No apps found</h3>
          <p className="text-muted-foreground">
            Try adjusting your search or filter criteria
          </p>
        </div>
      )}
    </div>
  )
}
