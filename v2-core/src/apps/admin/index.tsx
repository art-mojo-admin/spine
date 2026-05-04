import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '../../components/layout/Layout'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { NotFoundPage } from '../../pages/NotFoundPage'
import { useAuth } from '../../contexts/AuthContext'

// Config list pages
const TypesPage = lazy(() => import('../../pages/admin/TypesPage').then(m => ({ default: m.TypesPage })))
const AppsPage = lazy(() => import('../../pages/admin/AppsPage').then(m => ({ default: m.AppsPage })))
const TypeDetailPage = lazy(() => import('../../pages/admin/TypeDetailPage').then(m => ({ default: m.TypeDetailPage })))
const PipelinesPage = lazy(() => import('../../pages/admin/PipelinesPage').then(m => ({ default: m.PipelinesPage })))
const TriggersPage = lazy(() => import('../../pages/admin/TriggersPage').then(m => ({ default: m.TriggersPage })))
const AIAgentsPage = lazy(() => import('../../pages/admin/AIAgentsPage').then(m => ({ default: m.AIAgentsPage })))
const EmbeddingsPage = lazy(() => import('../../pages/admin/EmbeddingsPage').then(m => ({ default: m.EmbeddingsPage })))
const TimersPage = lazy(() => import('../../pages/admin/TimersPage').then(m => ({ default: m.TimersPage })))
const IntegrationsPage = lazy(() => import('../../pages/admin/IntegrationsPage').then(m => ({ default: m.IntegrationsPage })))

// Config detail pages
const AppDetailPage = lazy(() => import('../../pages/admin/AppDetailPage').then(m => ({ default: m.AppDetailPage })))
const PipelineDetailPage = lazy(() => import('../../pages/admin/PipelineDetailPage').then(m => ({ default: m.PipelineDetailPage })))
const TriggerDetailPage = lazy(() => import('../../pages/admin/TriggerDetailPage').then(m => ({ default: m.TriggerDetailPage })))
const AIAgentDetailPage = lazy(() => import('../../pages/admin/AIAgentDetailPage').then(m => ({ default: m.AIAgentDetailPage })))
const EmbeddingDetailPage = lazy(() => import('../../pages/admin/EmbeddingDetailPage').then(m => ({ default: m.EmbeddingDetailPage })))
const TimerDetailPage = lazy(() => import('../../pages/admin/TimerDetailPage').then(m => ({ default: m.TimerDetailPage })))
const IntegrationDetailPage = lazy(() => import('../../pages/admin/IntegrationDetailPage').then(m => ({ default: m.IntegrationDetailPage })))
const RolesPage = lazy(() => import('../../pages/admin/RolesPage').then(m => ({ default: m.RolesPage })))
const RoleDetailPage = lazy(() => import('../../pages/admin/RoleDetailPage').then(m => ({ default: m.RoleDetailPage })))
const PromptConfigsPage = lazy(() => import('../../pages/admin/PromptConfigsPage').then(m => ({ default: m.PromptConfigsPage })))
const PromptConfigDetailPage = lazy(() => import('../../pages/admin/PromptConfigDetailPage').then(m => ({ default: m.PromptConfigDetailPage })))
const APIKeysPage = lazy(() => import('../../pages/admin/APIKeysPage').then(m => ({ default: m.APIKeysPage })))
const APIKeyDetailPage = lazy(() => import('../../pages/admin/APIKeyDetailPage').then(m => ({ default: m.APIKeyDetailPage })))

// Observability pages
const ObservabilityDashboard = lazy(() => import('../../pages/admin/ObservabilityDashboard').then(m => ({ default: m.ObservabilityDashboard })))
const PipelineExecutionsPage = lazy(() => import('../../pages/admin/PipelineExecutionsPage').then(m => ({ default: m.PipelineExecutionsPage })))
const LogsPage = lazy(() => import('../../pages/admin/LogsPage').then(m => ({ default: m.LogsPage })))
const AlertsConfigPage = lazy(() => import('../../pages/admin/AlertsConfigPage').then(m => ({ default: m.AlertsConfigPage })))

// Runtime data pages (unified)
const DataListPage = lazy(() => import('../../components/runtime/DataListPage').then(m => ({ default: m.DataListPage })))
const DataDetailPage = lazy(() => import('../../components/runtime/DataDetailPage').then(m => ({ default: m.DataDetailPage })))

// Testing pages
const TestingDashboard = lazy(() => import('../../pages/admin/TestingDashboard'))
const TestRunDetailPage = lazy(() => import('../../pages/admin/TestRunDetailPage'))

export default function AdminApp() {
  const { user } = useAuth()

  if (!user?.is_system_admin) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <Layout>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>}>
        <Routes>
          {/* Default redirect → configs */}
          <Route index element={<Navigate to="configs/types" replace />} />
          <Route path="dashboard" element={<Navigate to="configs/types" replace />} />

          {/* Configs section */}
          <Route path="configs/types/new" element={<TypeDetailPage />} />
          <Route path="configs/types/:id" element={<TypeDetailPage />} />
          <Route path="configs/types" element={<TypesPage />} />
          <Route path="configs/apps/new" element={<AppDetailPage />} />
          <Route path="configs/apps/:id" element={<AppDetailPage />} />
          <Route path="configs/apps" element={<AppsPage />} />
          <Route path="configs/pipelines/new" element={<PipelineDetailPage />} />
          <Route path="configs/pipelines/:id" element={<PipelineDetailPage />} />
          <Route path="configs/pipelines" element={<PipelinesPage />} />
          <Route path="configs/triggers/new" element={<TriggerDetailPage />} />
          <Route path="configs/triggers/:id" element={<TriggerDetailPage />} />
          <Route path="configs/triggers" element={<TriggersPage />} />
          <Route path="configs/ai-agents/new" element={<AIAgentDetailPage />} />
          <Route path="configs/ai-agents/:id" element={<AIAgentDetailPage />} />
          <Route path="configs/ai-agents" element={<AIAgentsPage />} />
          <Route path="configs/embeddings/new" element={<EmbeddingDetailPage />} />
          <Route path="configs/embeddings/:id" element={<EmbeddingDetailPage />} />
          <Route path="configs/embeddings" element={<EmbeddingsPage />} />
          <Route path="configs/timers/new" element={<TimerDetailPage />} />
          <Route path="configs/timers/:id" element={<TimerDetailPage />} />
          <Route path="configs/timers" element={<TimersPage />} />
          <Route path="configs/integrations/new" element={<IntegrationDetailPage />} />
          <Route path="configs/integrations/:id" element={<IntegrationDetailPage />} />
          <Route path="configs/integrations" element={<IntegrationsPage />} />
          <Route path="configs/roles/new" element={<RoleDetailPage />} />
          <Route path="configs/roles/:id" element={<RoleDetailPage />} />
          <Route path="configs/roles" element={<RolesPage />} />
          <Route path="configs/prompts/new" element={<PromptConfigDetailPage />} />
          <Route path="configs/prompts/:id" element={<PromptConfigDetailPage />} />
          <Route path="configs/prompts" element={<PromptConfigsPage />} />
          <Route path="configs/api-keys/new" element={<APIKeyDetailPage />} />
          <Route path="configs/api-keys/:id" element={<APIKeyDetailPage />} />
          <Route path="configs/api-keys" element={<APIKeysPage />} />

          {/* Observability section */}
          <Route path="observability" element={<ObservabilityDashboard />} />
          <Route path="observability/dashboard" element={<ObservabilityDashboard />} />
          <Route path="observability/alerts" element={<AlertsConfigPage />} />
          <Route path="observability/executions/:id" element={<PipelineExecutionsPage />} />
          <Route path="observability/executions" element={<PipelineExecutionsPage />} />
          <Route path="observability/logs" element={<LogsPage />} />

          {/* Testing section */}
          <Route path="testing/:run_id" element={<TestRunDetailPage />} />
          <Route path="testing" element={<TestingDashboard />} />

          {/* Runtime Data - Unified entity management */}
          <Route path="runtime/:entity" element={<DataListPage />} />
          <Route path="runtime/:entity/new" element={<DataDetailPage />} />
          <Route path="runtime/:entity/:id" element={<DataDetailPage />} />

          {/* Legacy data routes - redirect to runtime routes */}
          <Route path="data/:entity" element={<Navigate to="../runtime/:entity" replace />} />
          <Route path="data/:entity/create" element={<Navigate to="../runtime/:entity/new" replace />} />
          <Route path="data/:entity/:id" element={<Navigate to="../runtime/:entity/:id" replace />} />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}
