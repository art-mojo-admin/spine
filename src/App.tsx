import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { Shell } from '@/components/layout/Shell'
import { PortalShell } from '@/components/layout/PortalShell'
import { LoginPage } from '@/pages/Login'
import { DashboardPage } from '@/pages/Dashboard'
import { AccountsPage } from '@/pages/Accounts'
import { AccountDetailPage } from '@/pages/AccountDetail'
import { PersonsPage } from '@/pages/Persons'
import { PersonDetailPage } from '@/pages/PersonDetail'
import { WorkflowsPage } from '@/pages/Workflows'
import { WorkflowDetailPage } from '@/pages/WorkflowDetail'
import { WorkflowBuilderPage } from '@/pages/WorkflowBuilder'
import { WorkflowItemDetailPage } from '@/pages/WorkflowItemDetail'
import { TicketsPage } from '@/pages/Tickets'
import { TicketDetailPage } from '@/pages/TicketDetail'
import { KnowledgeBasePage } from '@/pages/KnowledgeBase'
import { KBArticleDetailPage } from '@/pages/KBArticleDetail'
import { ActivityPage } from '@/pages/Activity'
import { ThemeEditorPage } from '@/pages/admin/ThemeEditor'
import { WebhooksPage } from '@/pages/admin/Webhooks'
import { SettingsPage } from '@/pages/admin/Settings'
import { RolesPage } from '@/pages/admin/Roles'
import { MembersPage } from '@/pages/admin/Members'
import { AutomationsPage } from '@/pages/admin/Automations'
import { InboundWebhooksPage } from '@/pages/admin/InboundWebhooks'
import { CustomFieldDefinitionsPage } from '@/pages/admin/CustomFieldDefinitions'
import { ScheduledTriggersPage } from '@/pages/admin/ScheduledTriggers'
import { LinkTypeDefinitionsPage } from '@/pages/admin/LinkTypeDefinitions'
import { ConfigPacksPage } from '@/pages/admin/ConfigPacks'
import { AccountModulesPage } from '@/pages/admin/AccountModules'
import { CustomActionTypesPage } from '@/pages/admin/CustomActionTypes'
import { NavExtensionsPage } from '@/pages/admin/NavExtensions'
import { ExtensionPage } from '@/pages/ExtensionPage'
import { AccountBrowserPage } from '@/pages/admin/AccountBrowser'
import { ImpersonationProvider } from '@/hooks/useImpersonation'
import { ImpersonationBanner } from '@/components/layout/ImpersonationBanner'
import { SearchPage } from '@/pages/Search'
import { PublicHomePage } from '@/pages/public/PublicHome'
import { PublicListingPage } from '@/pages/public/PublicListing'
import { PublicItemDetailPage } from '@/pages/public/PublicItemDetail'
import { PortalDashboardPage } from '@/pages/portal/PortalDashboard'
import { MyItemsPage } from '@/pages/portal/MyItems'
import { MyTicketsPage } from '@/pages/portal/MyTickets'
import { PortalBrowsePage } from '@/pages/portal/PortalBrowse'
import { PortalProfilePage } from '@/pages/portal/PortalProfile'

function ProtectedRoutes() {
  const { session, loading, currentRole } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (currentRole === 'portal') {
    return <PortalShell />
  }

  return <Shell />
}

export default function App() {
  return (
    <AuthProvider>
      <ImpersonationProvider>
        <ImpersonationBanner />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/p/:accountSlug" element={<PublicHomePage />} />
          <Route path="/p/:accountSlug/:workflowId" element={<PublicListingPage />} />
          <Route path="/p/:accountSlug/:workflowId/:itemId" element={<PublicItemDetailPage />} />
          <Route element={<ProtectedRoutes />}>
          {/* Portal routes */}
          <Route path="/my-items" element={<MyItemsPage />} />
          <Route path="/my-tickets" element={<MyTicketsPage />} />
          <Route path="/browse" element={<PortalBrowsePage />} />
          <Route path="/profile" element={<PortalProfilePage />} />
          {/* Standard routes */}
          <Route path="/" element={<DashboardPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/accounts/:accountId" element={<AccountDetailPage />} />
          <Route path="/persons" element={<PersonsPage />} />
          <Route path="/persons/:personId" element={<PersonDetailPage />} />
          <Route path="/workflows" element={<WorkflowsPage />} />
          <Route path="/workflows/:workflowId" element={<WorkflowDetailPage />} />
          <Route path="/workflows/:workflowId/builder" element={<WorkflowBuilderPage />} />
          <Route path="/workflow-items/:itemId" element={<WorkflowItemDetailPage />} />
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/tickets/:ticketId" element={<TicketDetailPage />} />
          <Route path="/kb" element={<KnowledgeBasePage />} />
          <Route path="/kb/:articleId" element={<KBArticleDetailPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/admin/theme" element={<ThemeEditorPage />} />
          <Route path="/admin/webhooks" element={<WebhooksPage />} />
          <Route path="/admin/settings" element={<SettingsPage />} />
          <Route path="/admin/roles" element={<RolesPage />} />
          <Route path="/admin/members" element={<MembersPage />} />
          <Route path="/admin/automations" element={<AutomationsPage />} />
          <Route path="/admin/inbound-webhooks" element={<InboundWebhooksPage />} />
          <Route path="/admin/custom-fields" element={<CustomFieldDefinitionsPage />} />
          <Route path="/admin/schedules" element={<ScheduledTriggersPage />} />
          <Route path="/admin/link-types" element={<LinkTypeDefinitionsPage />} />
          <Route path="/admin/packs" element={<ConfigPacksPage />} />
          <Route path="/admin/modules" element={<AccountModulesPage />} />
          <Route path="/admin/custom-actions" element={<CustomActionTypesPage />} />
          <Route path="/admin/nav-extensions" element={<NavExtensionsPage />} />
          <Route path="/admin/account-browser" element={<AccountBrowserPage />} />
          <Route path="/x/:slug" element={<ExtensionPage />} />
        </Route>
      </Routes>
      </ImpersonationProvider>
    </AuthProvider>
  )
}
