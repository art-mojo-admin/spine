import React, { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { Layout } from './components/layout/Layout'
import { LoadingSpinner } from './components/ui/LoadingSpinner'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { LoginPage } from './pages/auth/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { DashboardPage } from './pages/DashboardPage'

// Config list pages
const TypesPage = lazy(() => import('./pages/admin/TypesPage').then(m => ({ default: m.TypesPage })))
const AppsPage = lazy(() => import('./pages/admin/AppsPage').then(m => ({ default: m.AppsPage })))
const TypeDetailPage = lazy(() => import('./pages/admin/TypeDetailPage').then(m => ({ default: m.TypeDetailPage })))
const PipelinesPage = lazy(() => import('./pages/admin/PipelinesPage').then(m => ({ default: m.PipelinesPage })))
const TriggersPage = lazy(() => import('./pages/admin/TriggersPage').then(m => ({ default: m.TriggersPage })))
const AIAgentsPage = lazy(() => import('./pages/admin/AIAgentsPage').then(m => ({ default: m.AIAgentsPage })))
const EmbeddingsPage = lazy(() => import('./pages/admin/EmbeddingsPage').then(m => ({ default: m.EmbeddingsPage })))
const TimersPage = lazy(() => import('./pages/admin/TimersPage').then(m => ({ default: m.TimersPage })))

const AccountTypesPage = lazy(() => import('./pages/admin/AccountTypesPage').then(m => ({ default: m.AccountTypesPage })))
const PersonTypesPage = lazy(() => import('./pages/admin/PersonTypesPage').then(m => ({ default: m.PersonTypesPage })))
const IntegrationsPage = lazy(() => import('./pages/admin/IntegrationsPage').then(m => ({ default: m.IntegrationsPage })))

// Config detail pages
const AppDetailPage = lazy(() => import('./pages/admin/AppDetailPage').then(m => ({ default: m.AppDetailPage })))
const PipelineDetailPage = lazy(() => import('./pages/admin/PipelineDetailPage').then(m => ({ default: m.PipelineDetailPage })))
const TriggerDetailPage = lazy(() => import('./pages/admin/TriggerDetailPage').then(m => ({ default: m.TriggerDetailPage })))
const AIAgentDetailPage = lazy(() => import('./pages/admin/AIAgentDetailPage').then(m => ({ default: m.AIAgentDetailPage })))
const EmbeddingDetailPage = lazy(() => import('./pages/admin/EmbeddingDetailPage').then(m => ({ default: m.EmbeddingDetailPage })))
const TimerDetailPage = lazy(() => import('./pages/admin/TimerDetailPage').then(m => ({ default: m.TimerDetailPage })))
const IntegrationDetailPage = lazy(() => import('./pages/admin/IntegrationDetailPage').then(m => ({ default: m.IntegrationDetailPage })))
const AccountTypeDetailPage = lazy(() => import('./pages/admin/AccountTypeDetailPage').then(m => ({ default: m.AccountTypeDetailPage })))
const PersonTypeDetailPage = lazy(() => import('./pages/admin/PersonTypeDetailPage').then(m => ({ default: m.PersonTypeDetailPage })))

const RolesPage = lazy(() => import('./pages/admin/RolesPage').then(m => ({ default: m.RolesPage })))
const RoleDetailPage = lazy(() => import('./pages/admin/RoleDetailPage').then(m => ({ default: m.RoleDetailPage })))

const ThreadTypesPage = lazy(() => import('./pages/admin/ThreadTypesPage').then(m => ({ default: m.ThreadTypesPage })))
const MessageTypesPage = lazy(() => import('./pages/admin/MessageTypesPage').then(m => ({ default: m.MessageTypesPage })))
const AttachmentTypesPage = lazy(() => import('./pages/admin/AttachmentTypesPage').then(m => ({ default: m.AttachmentTypesPage })))

const PromptConfigsPage = lazy(() => import('./pages/admin/PromptConfigsPage').then(m => ({ default: m.PromptConfigsPage })))
const PromptConfigDetailPage = lazy(() => import('./pages/admin/PromptConfigDetailPage').then(m => ({ default: m.PromptConfigDetailPage })))
const APIKeysPage = lazy(() => import('./pages/admin/APIKeysPage').then(m => ({ default: m.APIKeysPage })))
const APIKeyDetailPage = lazy(() => import('./pages/admin/APIKeyDetailPage').then(m => ({ default: m.APIKeyDetailPage })))

// Observability pages
const PipelineExecutionsPage = lazy(() => import('./pages/admin/PipelineExecutionsPage').then(m => ({ default: m.PipelineExecutionsPage })))
const LogsPage = lazy(() => import('./pages/admin/LogsPage').then(m => ({ default: m.LogsPage })))

// Runtime data pages (unified)
const DataListPage = lazy(() => import('./components/runtime/DataListPage').then(m => ({ default: m.DataListPage })))
const DataDetailPage = lazy(() => import('./components/runtime/DataDetailPage').then(m => ({ default: m.DataDetailPage })))

function App() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <LoadingSpinner className="w-8 h-8 mx-auto mb-4" />
          <p className="text-slate-600">Loading Spine...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Layout>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>}>
        <Routes>
          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          {/* Main pages */}
          <Route path="/dashboard" element={<DashboardPage />} />
          
          {/* Admin pages - system admin only */}
          <Route path="/admin" element={
            <ProtectedRoute requireSystemAdmin>
              <Navigate to="/admin/dashboard" replace />
            </ProtectedRoute>
          } />
          
          <Route path="/admin/dashboard" element={
            <ProtectedRoute requireSystemAdmin>
              <DashboardPage />
            </ProtectedRoute>
          } />
          {/* Configs section */}
          <Route path="/admin/configs/types/new" element={
            <ProtectedRoute requireSystemAdmin>
              <TypeDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/types/:id" element={
            <ProtectedRoute requireSystemAdmin>
              <TypeDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/types" element={
            <ProtectedRoute requireSystemAdmin>
              <TypesPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/accounts/new" element={
            <ProtectedRoute requireSystemAdmin>
              <TypeDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/accounts/:id" element={
            <ProtectedRoute requireSystemAdmin>
              <TypeDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/accounts" element={
            <ProtectedRoute requireSystemAdmin>
              <AccountTypesPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/people/new" element={
            <ProtectedRoute requireSystemAdmin>
              <TypeDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/people/:id" element={
            <ProtectedRoute requireSystemAdmin>
              <PersonTypeDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/people" element={
            <ProtectedRoute requireSystemAdmin>
              <PersonTypesPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/threads/new" element={
            <ProtectedRoute requireSystemAdmin>
              <TypeDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/threads/:id" element={
            <ProtectedRoute requireSystemAdmin>
              <TypeDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/threads" element={
            <ProtectedRoute requireSystemAdmin>
              <ThreadTypesPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/messages/new" element={
            <ProtectedRoute requireSystemAdmin>
              <TypeDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/messages/:id" element={
            <ProtectedRoute requireSystemAdmin>
              <TypeDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/messages" element={
            <ProtectedRoute requireSystemAdmin>
              <MessageTypesPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/attachments/new" element={
            <ProtectedRoute requireSystemAdmin>
              <TypeDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/attachments/:id" element={
            <ProtectedRoute requireSystemAdmin>
              <TypeDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/attachments" element={
            <ProtectedRoute requireSystemAdmin>
              <AttachmentTypesPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/apps/new" element={
            <ProtectedRoute requireSystemAdmin>
              <AppDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/apps/:id" element={
            <ProtectedRoute requireSystemAdmin>
              <AppDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/apps" element={
            <ProtectedRoute requireSystemAdmin>
              <AppsPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/pipelines/new" element={
            <ProtectedRoute requireSystemAdmin>
              <PipelineDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/pipelines/:id" element={
            <ProtectedRoute requireSystemAdmin>
              <PipelineDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/pipelines" element={
            <ProtectedRoute requireSystemAdmin>
              <PipelinesPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/triggers/new" element={
            <ProtectedRoute requireSystemAdmin>
              <TriggerDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/triggers/:id" element={
            <ProtectedRoute requireSystemAdmin>
              <TriggerDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/triggers" element={
            <ProtectedRoute requireSystemAdmin>
              <TriggersPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/ai-agents/new" element={
            <ProtectedRoute requireSystemAdmin>
              <AIAgentDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/ai-agents/:id" element={
            <ProtectedRoute requireSystemAdmin>
              <AIAgentDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/ai-agents" element={
            <ProtectedRoute requireSystemAdmin>
              <AIAgentsPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/embeddings/new" element={
            <ProtectedRoute requireSystemAdmin>
              <EmbeddingDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/embeddings/:id" element={
            <ProtectedRoute requireSystemAdmin>
              <EmbeddingDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/embeddings" element={
            <ProtectedRoute requireSystemAdmin>
              <EmbeddingsPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/timers/new" element={
            <ProtectedRoute requireSystemAdmin>
              <TimerDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/timers/:id" element={
            <ProtectedRoute requireSystemAdmin>
              <TimerDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/timers" element={
            <ProtectedRoute requireSystemAdmin>
              <TimersPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/integrations/new" element={
            <ProtectedRoute requireSystemAdmin>
              <IntegrationDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/integrations/:id" element={
            <ProtectedRoute requireSystemAdmin>
              <IntegrationDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/integrations" element={
            <ProtectedRoute requireSystemAdmin>
              <IntegrationsPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/roles/new" element={
            <ProtectedRoute requireSystemAdmin>
              <RoleDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/roles/:id" element={
            <ProtectedRoute requireSystemAdmin>
              <RoleDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/roles" element={
            <ProtectedRoute requireSystemAdmin>
              <RolesPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/prompts/new" element={
            <ProtectedRoute requireSystemAdmin>
              <PromptConfigDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/prompts/:id" element={
            <ProtectedRoute requireSystemAdmin>
              <PromptConfigDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/prompts" element={
            <ProtectedRoute requireSystemAdmin>
              <PromptConfigsPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/api-keys/new" element={
            <ProtectedRoute requireSystemAdmin>
              <APIKeyDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/api-keys/:id" element={
            <ProtectedRoute requireSystemAdmin>
              <APIKeyDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/configs/api-keys" element={
            <ProtectedRoute requireSystemAdmin>
              <APIKeysPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/observability/executions/:id" element={
            <ProtectedRoute requireSystemAdmin>
              <PipelineExecutionsPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/observability/executions" element={
            <ProtectedRoute requireSystemAdmin>
              <PipelineExecutionsPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/observability/logs" element={
            <ProtectedRoute requireSystemAdmin>
              <LogsPage />
            </ProtectedRoute>
          } />
          
          {/* Runtime Data - Unified entity management */}
          <Route path="/admin/runtime/:entity" element={
            <ProtectedRoute requireSystemAdmin>
              <DataListPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/runtime/:entity/new" element={
            <ProtectedRoute requireSystemAdmin>
              <DataDetailPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/runtime/:entity/:id" element={
            <ProtectedRoute requireSystemAdmin>
              <DataDetailPage />
            </ProtectedRoute>
          } />
          
          {/* Legacy data routes - redirect to runtime routes */}
          <Route path="/admin/data/:entity" element={
            <ProtectedRoute requireSystemAdmin>
              <Navigate to="/admin/runtime/:entity" replace />
            </ProtectedRoute>
          } />
          <Route path="/admin/data/:entity/create" element={
            <ProtectedRoute requireSystemAdmin>
              <Navigate to="/admin/runtime/:entity/new" replace />
            </ProtectedRoute>
          } />
          <Route path="/admin/data/:entity/:id" element={
            <ProtectedRoute requireSystemAdmin>
              <Navigate to="/admin/runtime/:entity/:id" replace />
            </ProtectedRoute>
          } />
          
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}

export default App
