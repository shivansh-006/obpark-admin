'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  Layers,
  RefreshCw,
  AlertOctagon,
  CheckCircle,
  Clock,
  Activity,
  Trash2,
  RotateCcw,
  Eye,
  Filter,
  Check,
  AlertCircle,
  X,
} from 'lucide-react'

interface OutboxJob {
  id: string
  eventType: string
  entityId: string
  correlationId?: string
  payload: Record<string, any>
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  attempts: number
  maxAttempts: number
  lastError?: string
  scheduledFor: string
  processedAt?: string
  createdAt: string
  updatedAt: string
}

interface QueueStats {
  pending: number
  processing: number
  completed: number
  failed: number
  total: number
}

export default function QueuesPage() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [eventTypeFilter, setEventTypeFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selectedJob, setSelectedJob] = useState<OutboxJob | null>(null)
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Fetch Queue Stats
  const { data: stats, refetch: refetchStats } = useQuery<QueueStats>({
    queryKey: ['admin', 'queues', 'stats'],
    queryFn: () => api.get('/admin/queues/stats'),
    refetchInterval: 5000,
  })

  // Fetch Jobs List
  const { data: jobsData, isLoading, refetch: refetchJobs } = useQuery<{
    jobs: OutboxJob[]
    total: number
    page: number
    limit: number
    totalPages: number
  }>({
    queryKey: ['admin', 'queues', 'jobs', statusFilter, eventTypeFilter, page],
    queryFn: () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (eventTypeFilter.trim()) params.set('eventType', eventTypeFilter.trim())
      params.set('page', page.toString())
      params.set('limit', '20')
      return api.get(`/admin/queues/jobs?${params.toString()}`)
    },
    refetchInterval: 5000,
  })

  // Mutation: Retry Single Job
  const retryMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/queues/retry/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'queues'] })
      setFeedbackMsg({ type: 'success', text: 'Job rescheduled for immediate execution.' })
      setTimeout(() => setFeedbackMsg(null), 3000)
    },
    onError: (err: any) => {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Failed to retry job.' })
    },
  })

  // Mutation: Retry All Failed Jobs
  const retryAllMutation = useMutation({
    mutationFn: () => api.post('/admin/queues/retry-all'),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'queues'] })
      setFeedbackMsg({
        type: 'success',
        text: `Rescheduled ${data?.rescheduled ?? 'all'} dead-letter jobs for processing.`,
      })
      setTimeout(() => setFeedbackMsg(null), 3000)
    },
    onError: (err: any) => {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Failed to retry dead-letter jobs.' })
    },
  })

  // Mutation: Purge Job
  const purgeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/queues/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'queues'] })
      setFeedbackMsg({ type: 'success', text: 'Job successfully purged from queue.' })
      setTimeout(() => setFeedbackMsg(null), 3000)
    },
    onError: (err: any) => {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Failed to purge job.' })
    },
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-amber-50 text-amber-700 border-amber-200'
      case 'PROCESSING':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'COMPLETED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'FAILED':
        return 'bg-rose-50 text-rose-700 border-rose-200 font-bold'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const jobs = jobsData?.jobs || []

  return (
    <div className="space-y-6 p-6 max-w-[1600px] mx-auto min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <Layers className="w-7 h-7 text-indigo-600" />
            Transactional Outbox & Event Queues
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Section 9.1: Background outbox publisher, exponential backoff retries, and dead-letter queue (DLQ) controls.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              refetchStats()
              refetchJobs()
            }}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>

          <button
            onClick={() => {
              if (confirm('Retry all failed dead-letter jobs now?')) {
                retryAllMutation.mutate()
              }
            }}
            disabled={retryAllMutation.isPending || !stats?.failed}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 shadow-sm transition-all disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Retry All Dead-Letter ({stats?.failed ?? 0})
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)} className="text-xs hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats?.pending ?? 0}</div>
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Pending Outbox</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats?.processing ?? 0}</div>
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Processing</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats?.completed ?? 0}</div>
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Completed</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-rose-100 shadow-sm flex items-center gap-4 bg-rose-50/20">
          <div className="p-3 bg-rose-100 text-rose-700 rounded-lg">
            <AlertOctagon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-rose-700">{stats?.failed ?? 0}</div>
            <div className="text-xs text-rose-600 font-semibold uppercase tracking-wider">Dead-Letter Queue</div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Filter Bar */}
        <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex gap-2 overflow-x-auto text-xs w-full md:w-auto">
            {['ALL', 'FAILED', 'PENDING', 'PROCESSING', 'COMPLETED'].map((status) => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status)
                  setPage(1)
                }}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  statusFilter === status
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {status === 'ALL' ? 'All Events' : status === 'FAILED' ? 'Dead-Letter (Failed)' : status}
              </button>
            ))}
          </div>

          <div className="w-full md:w-72">
            <input
              type="text"
              placeholder="Filter by event type (e.g. ORDER_CONFIRMED)..."
              value={eventTypeFilter}
              onChange={(e) => {
                setEventTypeFilter(e.target.value)
                setPage(1)
              }}
              className="w-full px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Events Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/80 text-gray-500 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Entity ID</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Attempts</th>
                <th className="py-3 px-4">Last Error / Message</th>
                <th className="py-3 px-4">Created / Scheduled</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-normal">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    Loading background queue jobs...
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    No events found in this view.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-gray-900">
                      <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-indigo-700">
                        {job.eventType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-700 font-mono">
                      {job.entityId}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded text-[10px] uppercase border ${getStatusBadge(
                          job.status,
                        )}`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <span className={job.attempts >= job.maxAttempts ? 'text-rose-600 font-bold' : 'text-gray-700'}>
                        {job.attempts}
                      </span>
                      <span className="text-gray-400"> / {job.maxAttempts}</span>
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      {job.lastError ? (
                        <p className="text-rose-600 font-mono text-[11px] truncate" title={job.lastError}>
                          {job.lastError}
                        </p>
                      ) : (
                        <span className="text-gray-400 italic">None</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-500">
                      <div>{new Date(job.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
                      {job.status === 'PENDING' && (
                        <div className="text-[10px] text-amber-600">
                          Next: {new Date(job.scheduledFor).toLocaleTimeString()}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedJob(job)}
                          title="View Payload JSON"
                          className="p-1.5 text-gray-500 hover:text-indigo-600 rounded hover:bg-gray-100 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {(job.status === 'FAILED' || job.status === 'PENDING') && (
                          <button
                            onClick={() => retryMutation.mutate(job.id)}
                            disabled={retryMutation.isPending}
                            title="Retry Event Now"
                            className="p-1.5 text-amber-600 hover:text-amber-800 rounded hover:bg-amber-50 transition-colors"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (confirm(`Purge job ${job.eventType} (${job.id}) from queue?`)) {
                              purgeMutation.mutate(job.id)
                            }
                          }}
                          disabled={purgeMutation.isPending}
                          title="Purge / Delete Job"
                          className="p-1.5 text-gray-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {jobsData && jobsData.totalPages > 1 && (
          <div className="p-4 border-t border-gray-200 flex justify-between items-center text-xs text-gray-500 bg-gray-50/50">
            <span>
              Showing page {jobsData.page} of {jobsData.totalPages} ({jobsData.total} total jobs)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="px-3 py-1 bg-white border border-gray-200 rounded disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={page >= jobsData.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 bg-white border border-gray-200 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Payload Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">{selectedJob.eventType}</h3>
                <p className="text-xs text-gray-500 font-mono">Job ID: {selectedJob.id}</p>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-xs font-semibold text-gray-700">Target Entity ID:</span>
                <p className="text-xs font-mono text-gray-900">
                  {selectedJob.entityId}
                </p>
              </div>

              {selectedJob.lastError && (
                <div>
                  <span className="text-xs font-semibold text-rose-700">Failure Reason:</span>
                  <p className="text-xs font-mono text-rose-800 bg-rose-50 border border-rose-200 rounded p-2 mt-1">
                    {selectedJob.lastError}
                  </p>
                </div>
              )}

              <div>
                <span className="text-xs font-semibold text-gray-700">Payload Data:</span>
                <pre className="text-xs font-mono bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto max-h-64 mt-1">
                  {JSON.stringify(selectedJob.payload, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button
                onClick={() => setSelectedJob(null)}
                className="px-4 py-2 text-xs font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
