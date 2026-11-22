'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { microgrammaBold } from '@/lib/fonts'
import { Header } from '@/components/admin/layout/Header'
import {
  RotateCcw,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Truck,
  DollarSign,
  AlertCircle,
  Package,
  Calendar,
  Building,
  User,
  ShieldCheck,
  ChevronRight,
  Filter,
} from 'lucide-react'

interface ReturnItem {
  id: string
  returnNumber: string
  orderId: string
  order: {
    id: string
    orderNumber: string
    totalAmount: number
  }
  customerId: string
  customer: {
    id: string
    firstName: string
    lastName: string
    email: string
    phoneNumber?: string
  }
  vendorId?: string
  vendor?: {
    id: string
    businessName: string
    email: string
  }
  reason: 'DEFECTIVE' | 'WRONG_ITEM' | 'NOT_AS_DESCRIBED' | 'DAMAGED_IN_TRANSIT' | 'FITMENT_ISSUE' | 'OTHER'
  description: string
  evidenceImages: string[]
  status:
    | 'REQUESTED'
    | 'APPROVED'
    | 'REJECTED'
    | 'PICKUP_SCHEDULED'
    | 'ITEM_RECEIVED'
    | 'INSPECTED_RESTOCKED'
    | 'REFUNDED'
    | 'REPLACEMENT_ISSUED'
    | 'CANCELLED'
  pickupAwb?: string
  pickupCourier?: string
  inspectionNotes?: string
  isRestocked: boolean
  refundAmount?: number
  refundRef?: string
  refundDate?: string
  createdAt: string
}

interface ReturnStats {
  requested: number
  approved: number
  received: number
  refunded: number
  rejected: number
  total: number
}

export default function ReturnsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [activeReturn, setActiveReturn] = useState<ReturnItem | null>(null)
  const [actionType, setActionType] = useState<'status' | 'inspect' | 'refund' | null>(null)

  // Form states for modals
  const [newStatus, setNewStatus] = useState<string>('APPROVED')
  const [pickupCourier, setPickupCourier] = useState('Delhivery Reverse')
  const [pickupAwb, setPickupAwb] = useState('')

  const [inspectionNotes, setInspectionNotes] = useState('')
  const [isRestocked, setIsRestocked] = useState(true)

  const [refundAmount, setRefundAmount] = useState('')
  const [refundRef, setRefundRef] = useState('')
  const [isVendorResponsible, setIsVendorResponsible] = useState(false)

  // Query Stats
  const { data: stats } = useQuery<ReturnStats>({
    queryKey: ['admin', 'returns', 'stats'],
    queryFn: () => api.get<ReturnStats>('/admin/returns/stats'),
  })

  // Query Returns
  const { data, isLoading } = useQuery<{ returns: ReturnItem[]; total: number }>({
    queryKey: ['admin', 'returns', statusFilter, search],
    queryFn: () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (search) params.set('search', search)
      params.set('limit', '50')
      return api.get<{ returns: ReturnItem[]; total: number }>(`/admin/returns?${params.toString()}`)
    },
  })

  const returns = data?.returns || []

  // Mutations
  const statusMutation = useMutation({
    mutationFn: ({ id, status, pickupCourier, pickupAwb }: any) =>
      api.patch(`/admin/returns/${id}/status`, { status, pickupCourier, pickupAwb }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'returns'] })
      closeModal()
    },
    onError: (err: any) => alert(err.message || 'Failed to update status'),
  })

  const inspectMutation = useMutation({
    mutationFn: ({ id, inspectionNotes, isRestocked }: any) =>
      api.patch(`/admin/returns/${id}/inspect`, { inspectionNotes, isRestocked }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'returns'] })
      closeModal()
    },
    onError: (err: any) => alert(err.message || 'Failed to record inspection'),
  })

  const refundMutation = useMutation({
    mutationFn: ({ id, refundAmount, refundRef, isVendorResponsible }: any) =>
      api.post(`/admin/returns/${id}/refund`, {
        refundAmount: parseFloat(refundAmount),
        refundRef,
        isVendorResponsible,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'returns'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'payouts'] })
      closeModal()
    },
    onError: (err: any) => alert(err.message || 'Failed to process refund'),
  })

  const openAction = (ret: ReturnItem, type: 'status' | 'inspect' | 'refund') => {
    setActiveReturn(ret)
    setActionType(type)
    if (type === 'status') {
      setNewStatus(ret.status === 'REQUESTED' ? 'APPROVED' : ret.status)
      setPickupCourier(ret.pickupCourier || 'Delhivery Reverse')
      setPickupAwb(ret.pickupAwb || '')
    } else if (type === 'inspect') {
      setInspectionNotes(ret.inspectionNotes || '')
      setIsRestocked(ret.isRestocked ?? true)
    } else if (type === 'refund') {
      setRefundAmount(String(ret.refundAmount || ret.order?.totalAmount || ''))
      setRefundRef(ret.refundRef || '')
      setIsVendorResponsible(ret.reason === 'DEFECTIVE' || ret.reason === 'WRONG_ITEM')
    }
  }

  const closeModal = () => {
    setActiveReturn(null)
    setActionType(null)
  }

  return (
    <div className="min-h-screen bg-[#F0FAF5]">
      <Header title="Returns & Claims" />

      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-[#CAEDE6]/60 shadow-xs">
          <div>
            <h1 className={`${microgrammaBold.className} text-2xl font-bold text-[#074139] tracking-tight flex items-center gap-2`}>
              <RotateCcw className="w-7 h-7 text-[#074139]" />
              Returns, Refunds & Inspections
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Section 4.7: Manage return authorizations, reverse courier pickups, warehouse inspections, and customer refunds.
            </p>
          </div>
        </div>

        {/* KPI Cards — fluid stretching with CSS Grid auto-fit */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <div className="bg-white p-4 rounded-2xl border border-[#CAEDE6]/60 shadow-xs hover:border-[#074139]/20 transition-all">
          <span className="text-[11px] font-bold text-[#074139]/70 uppercase tracking-wider block font-michroma">
            Total Returns
          </span>
          <span className={`${microgrammaBold.className} text-xl font-bold text-[#074139] mt-1 block`}>{stats?.total ?? 0}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs hover:border-amber-300 transition-all">
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block font-michroma">
            Needs Review
          </span>
          <span className={`${microgrammaBold.className} text-xl font-bold text-amber-800 mt-1 block`}>{stats?.requested ?? 0}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#CAEDE6] bg-[#E6F5F2]/40 shadow-xs hover:border-[#074139]/30 transition-all">
          <span className="text-[11px] font-bold text-[#074139] uppercase tracking-wider block font-michroma">
            Approved / Pickup
          </span>
          <span className={`${microgrammaBold.className} text-xl font-bold text-[#074139] mt-1 block`}>{stats?.approved ?? 0}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#CAEDE6] bg-[#E6F5F2]/60 shadow-xs hover:border-[#074139]/40 transition-all">
          <span className="text-[11px] font-bold text-[#074139] uppercase tracking-wider block font-michroma">
            Item Received
          </span>
          <span className={`${microgrammaBold.className} text-xl font-bold text-[#074139] mt-1 block`}>{stats?.received ?? 0}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs hover:border-emerald-300 transition-all">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block font-michroma">
            Refunded
          </span>
          <span className={`${microgrammaBold.className} text-xl font-bold text-emerald-800 mt-1 block`}>{stats?.refunded ?? 0}</span>
        </div>
      </div>

      {/* Search and Status Filters */}
      <div className="bg-white p-4 rounded-2xl border border-[#CAEDE6]/60 shadow-xs flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search return #, order #, or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs border border-[#CAEDE6] rounded-xl focus:outline-none focus:border-[#074139] focus:ring-2 focus:ring-[#074139]/10"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-[#E6F5F2]/80 border border-[#CAEDE6] p-1.5 rounded-2xl">
          {['ALL', 'REQUESTED', 'APPROVED', 'ITEM_RECEIVED', 'REFUNDED', 'REJECTED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl font-michroma transition-all ${
                statusFilter === st
                  ? 'bg-[#074139] text-white shadow-xs'
                  : 'text-[#074139]/70 hover:text-[#074139] hover:bg-white/70'
              }`}
            >
              {st === 'ALL' ? 'All' : st.replace('_', ' ').toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Returns Table */}
      <div className="bg-white rounded-2xl border border-[#CAEDE6]/60 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading return requests...</div>
        ) : returns.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className={`${microgrammaBold.className} text-base font-semibold text-[#074139]`}>No return requests found</h3>
            <p className="text-xs text-gray-500 mt-1">
              Customer return requests and inspection cases will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F0FAF5] border-b border-[#CAEDE6] text-[#074139] font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 font-michroma">Return ID & Date</th>
                  <th className="py-3 px-4 font-michroma">Order Details</th>
                  <th className="py-3 px-4 font-michroma">Customer</th>
                  <th className="py-3 px-4 font-michroma">Vendor Partner</th>
                  <th className="py-3 px-4 font-michroma">Reason & Issue</th>
                  <th className="py-3 px-4 font-michroma">Status</th>
                  <th className="py-3 px-4 text-right font-michroma">Workflow Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {returns.map((r) => {
                  return (
                    <tr key={r.id} className="hover:bg-[#F0FAF5]/40 transition-colors">
                      {/* Return ID & Date */}
                      <td className="py-3.5 px-4 font-medium text-gray-900">
                        <span className="font-mono text-[#074139] font-bold block">{r.returnNumber}</span>
                        <span className="text-[0.6875rem] text-gray-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          {new Date(r.createdAt).toLocaleDateString('en-IN')}
                        </span>
                      </td>

                      {/* Order */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-emerald-800 font-semibold block">
                          #{r.order?.orderNumber}
                        </span>
                        <span className="text-[0.6875rem] text-gray-500">
                          ₹{Number(r.order?.totalAmount || 0).toFixed(2)}
                        </span>
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900">
                          {r.customer?.firstName} {r.customer?.lastName}
                        </div>
                        <span className="text-[0.6875rem] text-gray-500 block truncate max-w-[140px]">
                          {r.customer?.email}
                        </span>
                      </td>

                      {/* Vendor */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-800">
                          {r.vendor?.businessName || 'OBPARK Direct'}
                        </div>
                      </td>

                      {/* Reason */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <span className="px-2 py-0.5 rounded text-[0.625rem] font-bold uppercase bg-gray-100 text-gray-700 block w-max mb-1">
                          {r.reason.replace('_', ' ')}
                        </span>
                        <p className="text-[0.6875rem] text-gray-600 truncate">{r.description}</p>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {r.status === 'REQUESTED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.625rem] font-bold bg-amber-100 text-amber-800">
                            <Clock className="w-3 h-3" /> Requested
                          </span>
                        )}
                        {r.status === 'APPROVED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.625rem] font-bold bg-blue-100 text-blue-800">
                            Approved
                          </span>
                        )}
                        {r.status === 'ITEM_RECEIVED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.625rem] font-bold bg-[#E6F5F2] text-[#074139] border border-[#CAEDE6]">
                            Received
                          </span>
                        )}
                        {r.status === 'INSPECTED_RESTOCKED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.625rem] font-bold bg-[#E6F5F2] text-[#074139] border border-[#CAEDE6]">
                            Restocked
                          </span>
                        )}
                        {r.status === 'REFUNDED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.625rem] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle className="w-3 h-3" /> Refunded
                          </span>
                        )}
                        {r.status === 'REJECTED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.625rem] font-bold bg-rose-100 text-rose-800">
                            <XCircle className="w-3 h-3" /> Rejected
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            onClick={() => openAction(r, 'status')}
                            className="px-2.5 py-1 text-[0.6875rem] font-medium rounded-md border border-gray-200 hover:bg-gray-100 transition-colors"
                          >
                            Status
                          </button>
                          <button
                            onClick={() => openAction(r, 'inspect')}
                            className="px-2.5 py-1 text-[0.6875rem] font-medium rounded-md bg-[#E6F5F2] text-[#074139] border border-[#CAEDE6] hover:bg-[#d6f0ea] transition-colors"
                          >
                            Inspect
                          </button>
                          {r.status !== 'REFUNDED' && (
                            <button
                              onClick={() => openAction(r, 'refund')}
                              className="px-2.5 py-1 text-[0.6875rem] font-semibold rounded-md bg-[#074139] text-white hover:bg-[#06332d] transition-colors"
                            >
                              Refund
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Status / Reverse Pickup */}
      {actionType === 'status' && activeReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-gray-900">
              Update Return Status — {activeReturn.returnNumber}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                statusMutation.mutate({
                  id: activeReturn.id,
                  status: newStatus,
                  pickupCourier,
                  pickupAwb,
                })
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-lg bg-white"
                >
                  <option value="APPROVED">Approve (Authorize Return)</option>
                  <option value="PICKUP_SCHEDULED">Pickup Scheduled</option>
                  <option value="ITEM_RECEIVED">Item Received at Warehouse</option>
                  <option value="REJECTED">Reject Return</option>
                  <option value="CANCELLED">Cancel</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Reverse Pickup Courier
                </label>
                <input
                  type="text"
                  value={pickupCourier}
                  onChange={(e) => setPickupCourier(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-lg"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Reverse Tracking / AWB #
                </label>
                <input
                  type="text"
                  value={pickupAwb}
                  onChange={(e) => setPickupAwb(e.target.value)}
                  placeholder="e.g. REV-9988221"
                  className="w-full px-3 py-2 text-xs border rounded-lg font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={statusMutation.isPending}
                  className="px-4 py-1.5 text-xs font-semibold bg-[#074139] text-white rounded-lg hover:bg-[#05302a]"
                >
                  {statusMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Inspection & Restocking */}
      {actionType === 'inspect' && activeReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-gray-900">
              Warehouse Inspection — {activeReturn.returnNumber}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                inspectMutation.mutate({
                  id: activeReturn.id,
                  inspectionNotes,
                  isRestocked,
                })
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Inspection Checklist & Condition Notes *
                </label>
                <textarea
                  required
                  rows={3}
                  value={inspectionNotes}
                  onChange={(e) => setInspectionNotes(e.target.value)}
                  placeholder="Verify original seal, check for cosmetic scratches, electrical testing..."
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#074139]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="restock"
                  checked={isRestocked}
                  onChange={(e) => setIsRestocked(e.target.checked)}
                  className="rounded text-[#074139]"
                />
                <label htmlFor="restock" className="text-xs font-medium text-gray-800">
                  Item in good condition — restock into available warehouse inventory
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inspectMutation.isPending}
                  className="px-4 py-1.5 text-xs font-semibold bg-[#074139] text-white rounded-lg hover:bg-[#06332d]"
                >
                  {inspectMutation.isPending ? 'Recording...' : 'Confirm Inspection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Process Refund */}
      {actionType === 'refund' && activeReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              Issue Customer Refund — {activeReturn.returnNumber}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                refundMutation.mutate({
                  id: activeReturn.id,
                  refundAmount,
                  refundRef,
                  isVendorResponsible,
                })
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Refund Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-lg font-semibold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Gateway / Bank Refund Reference (UTR) *
                </label>
                <input
                  type="text"
                  required
                  value={refundRef}
                  onChange={(e) => setRefundRef(e.target.value.toUpperCase())}
                  placeholder="e.g. RFND-9928172"
                  className="w-full px-3 py-2 text-xs border rounded-lg font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="vendorResp"
                  checked={isVendorResponsible}
                  onChange={(e) => setIsVendorResponsible(e.target.checked)}
                  className="rounded text-[#074139]"
                />
                <label htmlFor="vendorResp" className="text-xs text-gray-700">
                  Deduct refund value from vendor payout ledger (Vendor defect / fault)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={refundMutation.isPending}
                  className="px-4 py-1.5 text-xs font-semibold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800"
                >
                  {refundMutation.isPending ? 'Processing...' : 'Confirm Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
