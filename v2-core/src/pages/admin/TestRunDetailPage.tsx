/**
 * @module src/pages/admin/TestRunDetailPage
 * @audience installer
 * @layer frontend-page
 * @stability stable
 *
 * Admin detail page for a single test run. Shows the run summary (suite,
 * status, duration, counts) and a filterable table of every individual
 * test case result. Failed cases are shown first.
 *
 * Route: /admin/testing/:run_id
 *
 * @seeAlso src/pages/admin/TestingDashboard.tsx
 * @seeAlso functions/tests.ts (data source)
 */

import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { apiFetch } from '../../lib/api'
import {
  BeakerIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  MinusCircleIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { formatDateTime } from '../../lib/utils'

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface TestResult {
  id:          string
  suite:       string
  file:        string | null
  describe:    string | null
  name:        string
  status:      'passed' | 'failed' | 'skipped'
  duration_ms: number | null
  error:       string | null
  created_at:  string
}

interface TestRunDetail {
  id:           string
  suite:        string
  status:       string
  started_at:   string
  finished_at:  string | null
  duration_ms:  number | null
  total:        number | null
  passed:       number | null
  failed:       number | null
  skipped:      number | null
  triggered_by: string | null
  results:      TestResult[]
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const SUITE_LABELS: Record<string, string> = {
  unit: 'Unit', integration: 'Integration', api: 'API', ui: 'UI',
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'passed')  return <CheckCircleIcon  className="w-4 h-4 text-green-500 shrink-0" />
  if (status === 'failed')  return <XCircleIcon      className="w-4 h-4 text-red-500 shrink-0" />
  return                           <MinusCircleIcon  className="w-4 h-4 text-gray-300 shrink-0" />
}

function RunStatusBadge({ status }: { status: string }) {
  const color =
    status === 'passed'  ? 'bg-green-100 text-green-800 border-green-200' :
    status === 'failed'  ? 'bg-red-100 text-red-800 border-red-200'      :
    status === 'running' ? 'bg-blue-100 text-blue-800 border-blue-200'   :
                           'bg-gray-100 text-gray-600 border-gray-200'
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded border text-sm font-medium ${color}`}>
      {status}
    </span>
  )
}

function durationLabel(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

// ─── PAGE ────────────────────────────────────────────────────────────────────

export default function TestRunDetailPage() {
  const { run_id } = useParams<{ run_id: string }>()
  const navigate   = useNavigate()
  const [filter, setFilter] = useState<'all' | 'passed' | 'failed' | 'skipped'>('all')
  const [search, setSearch] = useState('')

  const { data: run, loading, error } = useApi<TestRunDetail>(
    () => apiFetch(`/.netlify/functions/tests?action=get&id=${run_id}`).then(r => r.json()),
    { immediate: true }
  )

  if (loading) {
    return <div className="flex justify-center py-16"><LoadingSpinner /></div>
  }

  if (error || !run) {
    return (
      <div className="p-6 text-center text-red-500">
        {error ?? 'Test run not found'}
      </div>
    )
  }

  const results = run.results ?? []
  const filtered = results.filter(r => {
    if (filter !== 'all' && r.status !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        r.name.toLowerCase().includes(q) ||
        (r.file ?? '').toLowerCase().includes(q) ||
        (r.describe ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const failedFirst = [
    ...filtered.filter(r => r.status === 'failed'),
    ...filtered.filter(r => r.status === 'passed'),
    ...filtered.filter(r => r.status === 'skipped'),
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Back nav */}
      <button
        onClick={() => navigate('/spine-framework/admin/testing')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Back to Testing
      </button>

      {/* Run summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BeakerIcon className="w-5 h-5 text-gray-400" />
            <span className="font-semibold text-gray-900 text-lg">
              {SUITE_LABELS[run.suite] ?? run.suite} Suite
            </span>
          </div>
          <RunStatusBadge status={run.status} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Started</div>
            <div className="text-gray-700">{formatDateTime(run.started_at)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Duration</div>
            <div className="text-gray-700">{durationLabel(run.duration_ms)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Triggered by</div>
            <div className="text-gray-700">{run.triggered_by ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Run ID</div>
            <div className="text-gray-400 font-mono text-xs break-all">{run.id}</div>
          </div>
        </div>

        {/* Counts bar */}
        <div className="flex items-center gap-5 mt-4 pt-4 border-t border-gray-100 text-sm">
          <span className="text-green-600 font-semibold">{run.passed ?? 0} passed</span>
          <span className="text-red-500 font-semibold">{run.failed ?? 0} failed</span>
          <span className="text-gray-400">{run.skipped ?? 0} skipped</span>
          <span className="text-gray-500 ml-auto">{run.total ?? results.length} total</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <FunnelIcon className="w-4 h-4 text-gray-400 shrink-0" />
        <div className="flex gap-1.5">
          {(['all', 'failed', 'passed', 'skipped'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? `All (${results.length})` : f}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search tests..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="ml-auto text-sm border border-gray-200 rounded px-3 py-1.5 w-52 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Results table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {failedFirst.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">No results match filter</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 text-left w-6"></th>
                <th className="px-4 py-2 text-left">Test</th>
                <th className="px-4 py-2 text-left hidden md:table-cell">File</th>
                <th className="px-4 py-2 text-right">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {failedFirst.map(result => (
                <React.Fragment key={result.id}>
                  <tr className={result.status === 'failed' ? 'bg-red-50/40' : ''}>
                    <td className="px-4 py-2.5">
                      <StatusIcon status={result.status} />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="text-gray-800 font-medium">{result.name}</div>
                      {result.describe && (
                        <div className="text-gray-400 text-xs mt-0.5">{result.describe}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs hidden md:table-cell">
                      {result.file ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-400 text-xs whitespace-nowrap">
                      {durationLabel(result.duration_ms)}
                    </td>
                  </tr>
                  {result.error && (
                    <tr className="bg-red-50/60">
                      <td className="px-4 pb-2" />
                      <td colSpan={3} className="px-4 pb-3">
                        <pre className="text-xs text-red-700 bg-red-50 border border-red-100 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words max-h-40">
                          {result.error}
                        </pre>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
