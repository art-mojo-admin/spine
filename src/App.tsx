import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { Shell } from '@/components/layout/Shell'
import { PortalShell } from '@/components/layout/PortalShell'
import { ImpersonationProvider } from '@/hooks/useImpersonation'
import { ImpersonationBanner } from '@/components/layout/ImpersonationBanner'

// Lazy-loaded pages — each becomes its own chunk
const LoginPage = lazy(() => import('@/pages/Login').then(m => ({ default: m.LoginPage })))
const DashboardPage = lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.DashboardPage })))
const AccountsPage = lazy(() => import('@/pages/Accounts').then(m => ({ default: m.AccountsPage })))
const AccountDetailPage = lazy(() => import('@/pages/AccountDetail').then(m => ({ default: m.AccountDetailPage })))
const PersonsPage = lazy(() => import('@/pages/Persons').then(m => ({ default: m.PersonsPage })))
const PersonDetailPage = lazy(() => import('@/pages/PersonDetail').then(m => ({ default: m.PersonDetailPage })))
const WorkflowsPage = lazy(() => import('@/pages/Workflows').then(m => ({ default: m.WorkflowsPage })))
const WorkflowDetailPage = lazy(() => import('@/pages/WorkflowDetail').then(m => ({ default: m.WorkflowDetailPage })))
const WorkflowBuilderPage = lazy(() => import('@/pages/WorkflowBuilder').then(m => ({ default: m.WorkflowBuilderPage })))
const WorkflowItemDetailPage = lazy(() => import('@/pages/WorkflowItemDetail').then(m => ({ default: m.WorkflowItemDetailPage })))
const DocumentsPage = lazy(() => import('@/pages/KnowledgeBase').then(m => ({ default: m.DocumentsPage })))
const DocumentDetailPage = lazy(() => import('@/pages/KBArticleDetail').then(m => ({ default: m.DocumentDetailPage })))
const ActivityPage = lazy(() => import('@/pages/Activity').then(m => ({ default: m.ActivityPage })))
const CoursesPage = lazy(() => import('@/pages/Courses').then(m => ({ default: m.CoursesPage })))
const CourseDetailPage = lazy(() => import('@/pages/CourseDetail').then(m => ({ default: m.CourseDetailPage })))
const LessonViewerPage = lazy(() => import('@/pages/LessonViewer').then(m => ({ default: m.LessonViewerPage })))
const SearchPage = lazy(() => import('@/pages/Search').then(m => ({ default: m.SearchPage })))
const ExtensionPage = lazy(() => import('@/pages/ExtensionPage').then(m => ({ default: m.ExtensionPage })))
const ViewRendererPage = lazy(() => import('@/pages/ViewRenderer').then(m => ({ default: m.ViewRendererPage })))
const SystemHealthPage = lazy(() => import('@/pages/SystemHealth').then(m => ({ default: m.SystemHealthPage })))

// Admin pages
const ThemeEditorPage = lazy(() => import('@/pages/admin/ThemeEditor').then(m => ({ default: m.ThemeEditorPage })))
const WebhooksPage = lazy(() => import('@/pages/admin/Webhooks').then(m => ({ default: m.WebhooksPage })))
const SettingsPage = lazy(() => import('@/pages/admin/Settings').then(m => ({ default: m.SettingsPage })))
const RolesPage = lazy(() => import('@/pages/admin/Roles').then(m => ({ default: m.RolesPage })))
const MembersPage = lazy(() => import('@/pages/admin/Members').then(m => ({ default: m.MembersPage })))
const AutomationsPage = lazy(() => import('@/pages/admin/Automations').then(m => ({ default: m.AutomationsPage })))
const InboundWebhooksPage = lazy(() => import('@/pages/admin/InboundWebhooks').then(m => ({ default: m.InboundWebhooksPage })))
const CustomFieldDefinitionsPage = lazy(() => import('@/pages/admin/CustomFieldDefinitions').then(m => ({ default: m.CustomFieldDefinitionsPage })))
const ScheduledTriggersPage = lazy(() => import('@/pages/admin/ScheduledTriggers').then(m => ({ default: m.ScheduledTriggersPage })))
const LinkTypeDefinitionsPage = lazy(() => import('@/pages/admin/LinkTypeDefinitions').then(m => ({ default: m.LinkTypeDefinitionsPage })))
const ConfigPacksPage = lazy(() => import('@/pages/admin/ConfigPacks').then(m => ({ default: m.ConfigPacksPage })))
const AccountModulesPage = lazy(() => import('@/pages/admin/AccountModules').then(m => ({ default: m.AccountModulesPage })))
const CustomActionTypesPage = lazy(() => import('@/pages/admin/CustomActionTypes').then(m => ({ default: m.CustomActionTypesPage })))
const ViewDefinitionsPage = lazy(() => import('@/pages/admin/ViewDefinitions').then(m => ({ default: m.ViewDefinitionsPage })))
const AppDefinitionsPage = lazy(() => import('@/pages/admin/AppDefinitions').then(m => ({ default: m.AppDefinitionsPage })))
const AppBuilderPage = lazy(() => import('@/pages/admin/AppBuilder').then(m => ({ default: m.AppBuilderPage })))
const AccountBrowserPage = lazy(() => import('@/pages/admin/AccountBrowser').then(m => ({ default: m.AccountBrowserPage })))

// Public pages
const PublicHomePage = lazy(() => import('@/pages/public/PublicHome').then(m => ({ default: m.PublicHomePage })))
const PublicListingPage = lazy(() => import('@/pages/public/PublicListing').then(m => ({ default: m.PublicListingPage })))
const PublicItemDetailPage = lazy(() => import('@/pages/public/PublicItemDetail').then(m => ({ default: m.PublicItemDetailPage })))

// Portal pages
const PortalDashboardPage = lazy(() => import('@/pages/portal/PortalDashboard').then(m => ({ default: m.PortalDashboardPage })))
const MyItemsPage = lazy(() => import('@/pages/portal/MyItems').then(m => ({ default: m.MyItemsPage })))
const PortalBrowsePage = lazy(() => import('@/pages/portal/PortalBrowse').then(m => ({ default: m.PortalBrowsePage })))
const PortalProfilePage = lazy(() => import('@/pages/portal/PortalProfile').then(m => ({ default: m.PortalProfilePage })))

function PageLoader() {
  return (
    <div className="flex h-[50vh] items-center justify-center">
      <div className="text-muted-foreground">Loading...</div>
    </div>
  )
}

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
        <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/p/:accountSlug" element={<PublicHomePage />} />
          <Route path="/p/:accountSlug/:workflowId" element={<PublicListingPage />} />
          <Route path="/p/:accountSlug/:workflowId/:itemId" element={<PublicItemDetailPage />} />
          <Route element={<ProtectedRoutes />}>
          {/* Portal routes */}
          <Route path="/my-items" element={<MyItemsPage />} />
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
          {/* Redirects from old /tickets paths */}
          <Route path="/tickets" element={<Navigate to="/workflows" replace />} />
          <Route path="/tickets/:ticketId" element={<Navigate to="/workflows" replace />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/documents/:articleId" element={<DocumentDetailPage />} />
          {/* Redirects from old /kb paths */}
          <Route path="/kb" element={<Navigate to="/documents" replace />} />
          <Route path="/kb/:articleId" element={<Navigate to="/documents" replace />} />
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/courses/:courseId" element={<CourseDetailPage />} />
          <Route path="/courses/:courseId/lessons/:lessonId" element={<LessonViewerPage />} />
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
          <Route path="/admin/views" element={<ViewDefinitionsPage />} />
          <Route path="/admin/apps" element={<AppDefinitionsPage />} />
          <Route path="/admin/apps/:appId/builder" element={<AppBuilderPage />} />
          <Route path="/admin/account-browser" element={<AccountBrowserPage />} />
          <Route path="/admin/system-health" element={<SystemHealthPage />} />
          <Route path="/v/:viewSlug" element={<ViewRendererPage />} />
          <Route path="/x/:slug" element={<ExtensionPage />} />
        </Route>
      </Routes>
      </Suspense>
      </ImpersonationProvider>
    </AuthProvider>
  )
}
