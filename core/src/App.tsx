import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { Shell } from '@/components/layout/Shell'
import { ImpersonationProvider } from '@/hooks/useImpersonation'
import { ImpersonationBanner } from '@/components/layout/ImpersonationBanner'
import { getCustomRoutes } from '@/lib/customRoutes'

const runtimeCustomRoutes = getCustomRoutes().map(route => ({
  ...route,
  Component: lazy(route.loader),
}))

// Core pages
const LoginPage = lazy(() => import('@/pages/Login').then(m => ({ default: m.LoginPage })))
const AccountsPage = lazy(() => import('@/pages/Accounts').then(m => ({ default: m.AccountsPage })))
const AccountDetailPage = lazy(() => import('@/pages/AccountDetail').then(m => ({ default: m.AccountDetailPage })))
const PersonsPage = lazy(() => import('@/pages/Persons').then(m => ({ default: m.PersonsPage })))
const PersonDetailPage = lazy(() => import('@/pages/PersonDetail').then(m => ({ default: m.PersonDetailPage })))
const ActivityPage = lazy(() => import('@/pages/Activity').then(m => ({ default: m.ActivityPage })))
const SearchPage = lazy(() => import('@/pages/Search').then(m => ({ default: m.SearchPage })))
const SystemHealthPage = lazy(() => import('@/pages/SystemHealth').then(m => ({ default: m.SystemHealthPage })))

// Core admin pages
const WebhooksPage = lazy(() => import('@/pages/admin/Webhooks').then(m => ({ default: m.WebhooksPage })))
const SettingsPage = lazy(() => import('@/pages/admin/Settings').then(m => ({ default: m.SettingsPage })))
const RolesPage = lazy(() => import('@/pages/admin/Roles').then(m => ({ default: m.RolesPage })))
const MembersPage = lazy(() => import('@/pages/admin/Members').then(m => ({ default: m.MembersPage })))
const InboundWebhooksPage = lazy(() => import('@/pages/admin/InboundWebhooks').then(m => ({ default: m.InboundWebhooksPage })))
const ConfigPacksPage = lazy(() => import('@/pages/admin/ConfigPacks').then(m => ({ default: m.ConfigPacksPage })))
const AccountScopesPage = lazy(() => import('@/pages/admin/AccountScopes').then(m => ({ default: m.AccountScopesPage })))
const ScopeLibraryPage = lazy(() => import('@/pages/admin/ScopeLibrary').then(m => ({ default: m.ScopeLibraryPage })))
const MachinePrincipalsPage = lazy(() => import('@/pages/admin/MachinePrincipals').then(m => ({ default: m.MachinePrincipalsPage })))
const PrincipalScopesPage = lazy(() => import('@/pages/admin/PrincipalScopes').then(m => ({ default: m.PrincipalScopesPage })))
const RoleMatrixPage = lazy(() => import('@/pages/admin/RoleMatrix').then(m => ({ default: m.RoleMatrixPage })))
const AccountBrowserPage = lazy(() => import('@/pages/admin/AccountBrowser').then(m => ({ default: m.AccountBrowserPage })))
const SetupWizardPage = lazy(() => import('@/pages/admin/SetupWizard').then(m => ({ default: m.SetupWizardPage })))
const AppsPage = lazy(() => import('@/pages/admin/Apps').then(m => ({ default: m.default })))
const TenantRolesPage = lazy(() => import('@/pages/admin/TenantRoles').then(m => ({ default: m.TenantRolesPage })))
const ItemTypesPage = lazy(() => import('@/pages/admin/ItemTypes').then(m => ({ default: m.ItemTypesPage })))

// Runtime admin pages
const AutomationsPage = lazy(() => import('@/pages/admin/Automations').then(m => ({ default: m.AutomationsPage })))
const ScheduledTriggersPage = lazy(() => import('@/pages/admin/ScheduledTriggers').then(m => ({ default: m.ScheduledTriggersPage })))
const CustomActionTypesPage = lazy(() => import('@/pages/admin/CustomActionTypes').then(m => ({ default: m.CustomActionTypesPage })))
const WebhookDeliveriesPage = lazy(() => import('@/pages/admin/WebhookDeliveries').then(m => ({ default: m.WebhookDeliveriesPage })))
const SchedulerHealthPage = lazy(() => import('@/pages/admin/SchedulerHealth').then(m => ({ default: m.SchedulerHealthPage })))
const AutomationLogPage = lazy(() => import('@/pages/admin/AutomationLog').then(m => ({ default: m.AutomationLogPage })))
const IntegrationCatalogPage = lazy(() => import('@/pages/admin/IntegrationCatalog').then(m => ({ default: m.IntegrationCatalogPage })))

function PageLoader() {
  return (
    <div className="flex h-[50vh] items-center justify-center">
      <div className="text-muted-foreground">Loading...</div>
    </div>
  )
}

function ProtectedRoutes() {
  const { session, loading } = useAuth()

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
            <Route element={<ProtectedRoutes />}>
              {/* Core primitives */}
              <Route path="/" element={<Navigate to="/admin/system-health" replace />} />
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/accounts/:accountId" element={<AccountDetailPage />} />
              <Route path="/persons" element={<PersonsPage />} />
              <Route path="/persons/:personId" element={<PersonDetailPage />} />
              {/* Core system admin */}
              <Route path="/admin/system-health" element={<SystemHealthPage />} />
              <Route path="/admin/settings" element={<SettingsPage />} />
              <Route path="/admin/setup" element={<SetupWizardPage />} />
              <Route path="/admin/account-browser" element={<AccountBrowserPage />} />
              {/* Identity & access */}
              <Route path="/admin/members" element={<MembersPage />} />
              <Route path="/admin/roles" element={<RolesPage />} />
              <Route path="/admin/tenant-roles" element={<TenantRolesPage />} />
              <Route path="/admin/role-matrix" element={<RoleMatrixPage />} />
              <Route path="/admin/machine-principals" element={<MachinePrincipalsPage />} />
              <Route path="/admin/account-scopes" element={<AccountScopesPage />} />
              <Route path="/admin/scopes" element={<ScopeLibraryPage />} />
              <Route path="/admin/principal-scopes" element={<PrincipalScopesPage />} />
              {/* Apps & Navigation */}
              <Route path="/admin/apps" element={<AppsPage />} />
              {/* Type registry */}
              <Route path="/admin/item-types" element={<ItemTypesPage />} />
              {/* Pack lifecycle */}
              <Route path="/admin/packs" element={<ConfigPacksPage />} />
              {/* Webhooks */}
              <Route path="/admin/webhooks" element={<WebhooksPage />} />
              <Route path="/admin/inbound-webhooks" element={<InboundWebhooksPage />} />
              {/* Runtime admin */}
              <Route path="/admin/automations" element={<AutomationsPage />} />
              <Route path="/admin/schedules" element={<ScheduledTriggersPage />} />
              <Route path="/admin/custom-actions" element={<CustomActionTypesPage />} />
              <Route path="/admin/webhook-deliveries" element={<WebhookDeliveriesPage />} />
              <Route path="/admin/scheduler-health" element={<SchedulerHealthPage />} />
              <Route path="/admin/automation-log" element={<AutomationLogPage />} />
              <Route path="/admin/integrations" element={<IntegrationCatalogPage />} />
              {/* Custom routes injected by custom code */}
              {runtimeCustomRoutes.map(({ path, Component }) => (
                <Route key={path} path={path} element={<Component />} />
              ))}
            </Route>
          </Routes>
        </Suspense>
      </ImpersonationProvider>
    </AuthProvider>
  )
}
