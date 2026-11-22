'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { microgrammaBold } from '@/lib/fonts'
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
    <div className="space-y-6 p-6 max-w-[1600px] mx-auto min-h-screen bg-[#F0FAF5]">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-[#CAEDE6]/60 shadow-xs">
        <div>
          <h1 className={`${microgrammaBold.className} text-2xl font-bold text-[#074139] tracking-tight flex items-center gap-3`}>
            <Layers className="w-7 h-7 text-[#074139]" />
            Transactional Outbox & Event Queues
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Section 9.1: Background outbox publisher, exponential backoff retries, and dead-letter queue (DLQ) controls.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              refetchStats()
              refetchJobs()
            }}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#074139] bg-[#E6F5F2] border border-[#CAEDE6] rounded-xl hover:bg-[#d6f0ea] shadow-xs transition-colors"
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
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-rose-700 rounded-xl hover:bg-rose-800 shadow-xs transition-all disabled:opacity-50"
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
              ? 'bg-[#E6F5F2] border-[#CAEDE6] text-[#074139]'
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#CAEDE6]/60 shadow-xs hover:border-[#074139]/20 transition-all flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-700 rounded-xl border border-amber-200/50">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className={`${microgrammaBold.className} text-2xl font-bold text-[#074139]`}>{stats?.pending ?? 0}</div>
            <div className="text-[11px] text-[#074139]/70 font-bold uppercase tracking-wider font-michroma">Pending Outbox</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#CAEDE6]/60 shadow-xs hover:border-[#074139]/20 transition-all flex items-center gap-4">
          <div className="p-3 bg-[#E6F5F2] text-[#074139] rounded-xl border border-[#CAEDE6]">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className={`${microgrammaBold.className} text-2xl font-bold text-[#074139]`}>{stats?.processing ?? 0}</div>
            <div className="text-[11px] text-[#074139]/70 font-bold uppercase tracking-wider font-michroma">Processing</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#CAEDE6]/60 shadow-xs hover:border-[#074139]/20 transition-all flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200/50">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <div className={`${microgrammaBold.className} text-2xl font-bold text-[#074139]`}>{stats?.completed ?? 0}</div>
            <div className="text-[11px] text-[#074139]/70 font-bold uppercase tracking-wider font-michroma">Completed</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-xs hover:border-rose-400 transition-all flex items-center gap-4 bg-rose-50/20">
          <div className="p-3 bg-rose-100 text-rose-700 rounded-xl">
            <AlertOctagon className="w-5 h-5" />
          </div>
          <div>
            <div className={`${microgrammaBold.className} text-2xl font-bold text-rose-700`}>{stats?.failed ?? 0}</div>
            <div className="text-[11px] text-rose-700 font-bold uppercase tracking-wider font-michroma">Dead-Letter Queue</div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-[#CAEDE6]/60 shadow-xs overflow-hidden">
        {/* Filter Bar */}
        <div className="p-4 border-b border-[#CAEDE6]/60 bg-[#F0FAF5]/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex gap-1.5 overflow-x-auto text-xs w-full md:w-auto bg-[#E6F5F2]/80 p-1.5 rounded-2xl border border-[#CAEDE6]">
            {['ALL', 'FAILED', 'PENDING', 'PROCESSING', 'COMPLETED'].map((status) => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status)
                  setPage(1)
                }}
                className={`px-3.5 py-1.5 rounded-xl font-michroma text-xs font-semibold whitespace-nowrap transition-all ${
                  statusFilter === status
                    ? 'bg-[#074139] text-white shadow-xs'
                    : 'text-[#074139]/70 hover:text-[#074139] hover:bg-white/70'
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
              className="w-full px-3.5 py-2 text-xs bg-white border border-[#CAEDE6] rounded-xl focus:outline-none focus:border-[#074139] focus:ring-2 focus:ring-[#074139]/10"
            />
          </div>
        </div>

        {/* Events Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#CAEDE6] bg-[#F0FAF5] text-[#074139] font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 font-michroma">Event Type</th>
                <th className="py-3 px-4 font-michroma">Entity ID</th>
                <th className="py-3 px-4 font-michroma">Status</th>
                <th className="py-3 px-4 font-michroma">Attempts</th>
                <th className="py-3 px-4 font-michroma">Last Error / Message</th>
                <th className="py-3 px-4 font-michroma">Created / Scheduled</th>
                <th className="py-3 px-4 text-right font-michroma">Actions</th>
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
                  <tr key={job.id} className="hover:bg-[#F0FAF5]/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-gray-900">
                      <span className="px-2.5 py-1 rounded-lg bg-[#E6F5F2] border border-[#CAEDE6] text-[#074139] font-mono font-semibold text-[11px]">
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
                          className="p-1.5 text-gray-500 hover:text-[#074139] rounded hover:bg-[#E6F5F2] transition-colors"
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
          <div className="bg-white rounded-2xl border border-[#CAEDE6] max-w-2xl w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#CAEDE6]/60 pb-3">
              <div>
                <h3 className={`${microgrammaBold.className} text-base font-bold text-[#074139]`}>{selectedJob.eventType}</h3>
                <p className="text-xs text-gray-500 font-mono">Job ID: {selectedJob.id}</p>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-gray-400 hover:text-[#074139] p-1 rounded-lg"
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
