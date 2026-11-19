'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  Truck,
  Search,
  Package,
  ExternalLink,
  CheckCircle,
  Clock,
  Send,
  Edit2,
  Copy,
  Check,
  AlertCircle,
  Building,
  Calendar,
} from 'lucide-react'
import { useVendors } from '@/hooks/useVendors'

interface ShipmentItem {
  id: string
  orderId: string
  orderNumber: string
  vendorId: string
  vendorName: string
  vendorEmail: string
  status: 'PENDING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED'
  courierName?: string
  trackingNumber?: string
  courierWebsite?: string
  items: Array<{
    name: string
    quantity: number
    price: number
    image?: string
  }>
  grossSales: number
  commissionRate: number
  platformFee: number
  netPayable: number
  payoutStatus: 'PENDING' | 'ELIGIBLE' | 'SETTLED'
  settlementRef?: string
  settlementDate?: string
  dispatchedAt?: string
  deliveredAt?: string
  createdAt: string
  dispatchUrl: string
}

interface ShipmentsResponse {
  shipments: ShipmentItem[]
  total: number
  page: number
  limit: number
}

const POPULAR_COURIERS = [
  'Blue Dart',
  'Delhivery',
  'DTDC',
  'Ekart Logistics',
  'Shadowfax',
  'Xpressbees',
  'India Post (Speed Post)',
  'Professional Couriers',
  'Ecom Express',
  'Shiprocket',
  'Other',
]

export default function ShipmentsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [vendorFilter, setVendorFilter] = useState<string>('ALL')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Modal State for AWB Override
  const [activeShipment, setActiveShipment] = useState<ShipmentItem | null>(null)
  const [overrideCourier, setOverrideCourier] = useState('Blue Dart')
  const [overrideCustomCourier, setOverrideCustomCourier] = useState('')
  const [overrideTracking, setOverrideTracking] = useState('')
  const [overrideWebsite, setOverrideWebsite] = useState('')

  // Query Vendors for dropdown
  const { data: vendors = [] } = useVendors()

  // Query Shipments
  const { data, isLoading } = useQuery<ShipmentsResponse>({
    queryKey: ['admin', 'shipments', statusFilter, vendorFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (vendorFilter !== 'ALL') params.set('vendorId', vendorFilter)
      params.set('limit', '50')
      return api.get<ShipmentsResponse>(`/admin/shipments?${params.toString()}`)
    },
    refetchInterval: 30000,
  })

  const shipments = data?.shipments || []

  // Filter in memory for search
  const filteredShipments = shipments.filter((s) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      s.orderNumber.toLowerCase().includes(q) ||
      s.vendorName.toLowerCase().includes(q) ||
      (s.trackingNumber && s.trackingNumber.toLowerCase().includes(q)) ||
      (s.courierName && s.courierName.toLowerCase().includes(q))
    )
  })

  // Mutations
  const overrideMutation = useMutation({
    mutationFn: ({
      id,
      courierName,
      trackingNumber,
      courierWebsite,
    }: {
      id: string
      courierName: string
      trackingNumber: string
      courierWebsite?: string
    }) =>
      api.patch(`/admin/shipments/${id}/override`, {
        courierName,
        trackingNumber,
        courierWebsite,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'shipments'] })
      setActiveShipment(null)
      setOverrideTracking('')
      setOverrideWebsite('')
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to update courier tracking')
    },
  })

  const deliverMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/shipments/${id}/deliver`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'shipments'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'payouts'] })
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to mark shipment as delivered')
    },
  })

  const resendEmailMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/shipments/${id}/resend-email`, {}),
    onSuccess: (res: any) => {
      alert(res?.message || 'Dispatch packing slip resent successfully!')
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to resend dispatch email')
    },
  })

  const handleOpenOverride = (shipment: ShipmentItem) => {
    setActiveShipment(shipment)
    if (shipment.courierName && POPULAR_COURIERS.includes(shipment.courierName)) {
      setOverrideCourier(shipment.courierName)
      setOverrideCustomCourier('')
    } else if (shipment.courierName) {
      setOverrideCourier('Other')
      setOverrideCustomCourier(shipment.courierName)
    } else {
      setOverrideCourier('Blue Dart')
      setOverrideCustomCourier('')
    }
    setOverrideTracking(shipment.trackingNumber || '')
    setOverrideWebsite(shipment.courierWebsite || '')
  }

  const handleSaveOverride = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeShipment) return
    const finalCourier =
      overrideCourier === 'Other' ? overrideCustomCourier.trim() : overrideCourier

    if (!finalCourier) {
      alert('Please specify the courier partner name.')
      return
    }
    if (!overrideTracking.trim()) {
      alert('Please enter a valid tracking number / AWB.')
      return
    }

    overrideMutation.mutate({
      id: activeShipment.id,
      courierName: finalCourier,
      trackingNumber: overrideTracking.trim(),
      courierWebsite: overrideWebsite.trim() || undefined,
    })
  }

  const copyMagicLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2500)
  }

  // Count KPIs
  const totalCount = shipments.length
  const pendingCount = shipments.filter((s) => s.status === 'PENDING').length
  const dispatchedCount = shipments.filter((s) => s.status === 'DISPATCHED').length
  const deliveredCount = shipments.filter((s) => s.status === 'DELIVERED').length

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="w-7 h-7 text-[#074139]" />
            Vendor Shipments & Dispatch
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track multi-vendor order fulfillment, monitor magic-link dispatch confirmations, and manage courier tracking.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
            Total Shipments
          </span>
          <span className="text-2xl font-bold text-gray-900 mt-1 block">{totalCount}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs">
          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider block">
            Awaiting Dispatch
          </span>
          <span className="text-2xl font-bold text-amber-800 mt-1 block">{pendingCount}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50/20 shadow-xs">
          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider block">
            In Transit
          </span>
          <span className="text-2xl font-bold text-blue-800 mt-1 block">{dispatchedCount}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
          <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider block">
            Delivered
          </span>
          <span className="text-2xl font-bold text-emerald-800 mt-1 block">{deliveredCount}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by order #, vendor, or AWB..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#074139]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Vendor Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-gray-500 font-medium">Vendor:</span>
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#074139] bg-white"
            >
              <option value="ALL">All Vendors</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.businessName || v.contactPerson}
                </option>
              ))}
            </select>
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
            {['ALL', 'PENDING', 'DISPATCHED', 'DELIVERED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  statusFilter === st
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {st === 'ALL' ? 'All' : st.charAt(0) + st.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Shipments Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading shipments...</div>
        ) : filteredShipments.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-800">No shipments found</h3>
            <p className="text-sm text-gray-500 mt-1">
              Shipments are automatically generated when customer orders contain vendor-assigned products.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Order & Date</th>
                  <th className="py-3 px-4">Vendor Partner</th>
                  <th className="py-3 px-4">Items in Package</th>
                  <th className="py-3 px-4">Subtotal</th>
                  <th className="py-3 px-4">Fulfillment Status</th>
                  <th className="py-3 px-4">Logistics / Tracking</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredShipments.map((s) => {
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/80 transition-colors">
                      {/* Order & Date */}
                      <td className="py-3.5 px-4 font-medium text-gray-900">
                        <span className="font-mono text-emerald-800 font-bold block">
                          #{s.orderNumber}
                        </span>
                        <span className="text-[0.6875rem] text-gray-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          {new Date(s.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </td>

                      {/* Vendor Partner */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-gray-400" />
                          {s.vendorName}
                        </div>
                        <span className="text-[0.6875rem] text-gray-500 block truncate max-w-[150px]">
                          {s.vendorEmail}
                        </span>
                      </td>

                      {/* Items */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1 max-w-xs">
                          {Array.isArray(s.items) &&
                            s.items.map((item, idx) => (
                              <div key={idx} className="text-gray-800 truncate">
                                <span className="font-semibold text-gray-900">{item.quantity}x</span>{' '}
                                {item.name}
                              </div>
                            ))}
                        </div>
                      </td>

                      {/* Subtotal */}
                      <td className="py-3.5 px-4 font-semibold text-gray-900">
                        ₹{s.grossSales.toFixed(2)}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4">
                        {s.status === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.6875rem] font-semibold bg-amber-100 text-amber-800">
                            <Clock className="w-3 h-3" /> Awaiting Dispatch
                          </span>
                        )}
                        {s.status === 'DISPATCHED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.6875rem] font-semibold bg-blue-100 text-blue-800">
                            <Truck className="w-3 h-3" /> In Transit
                          </span>
                        )}
                        {s.status === 'DELIVERED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.6875rem] font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle className="w-3 h-3" /> Delivered
                          </span>
                        )}
                        {s.status === 'CANCELLED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.6875rem] font-semibold bg-red-100 text-red-800">
                            Cancelled
                          </span>
                        )}
                      </td>

                      {/* Logistics / Tracking */}
                      <td className="py-3.5 px-4">
                        {s.trackingNumber ? (
                          <div className="space-y-0.5">
                            <span className="font-semibold text-gray-900 block">
                              {s.courierName || 'Courier Partner'}
                            </span>
                            <span className="font-mono text-emerald-700 font-medium block">
                              AWB: {s.trackingNumber}
                            </span>
                            {s.courierWebsite && (
                              <a
                                href={s.courierWebsite}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[0.6875rem] text-blue-600 hover:underline flex items-center gap-1"
                              >
                                Track on Website <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">No AWB entered yet</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Copy Magic Link */}
                          <button
                            onClick={() => copyMagicLink(s.dispatchUrl, s.id)}
                            title="Copy vendor zero-login dispatch magic link"
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
                          >
                            {copiedId === s.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Resend Packing Slip Email */}
                          <button
                            onClick={() => resendEmailMutation.mutate(s.id)}
                            disabled={resendEmailMutation.isPending}
                            title="Resend packing slip email to vendor"
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>

                          {/* Enter or Edit AWB */}
                          <button
                            onClick={() => handleOpenOverride(s)}
                            className="px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium flex items-center gap-1 transition-colors"
                          >
                            <Edit2 className="w-3 h-3" />
                            {s.trackingNumber ? 'Edit AWB' : 'Enter AWB'}
                          </button>

                          {/* Mark Delivered */}
                          {s.status === 'DISPATCHED' && (
                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    `Confirm delivery for Order #${s.orderNumber}? This will mark payout as ELIGIBLE.`
                                  )
                                ) {
                                  deliverMutation.mutate(s.id)
                                }
                              }}
                              disabled={deliverMutation.isPending}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-medium flex items-center gap-1 transition-colors shadow-xs"
                            >
                              <CheckCircle className="w-3 h-3" />
                              Delivered
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

      {/* Manual AWB Override Modal */}
      {activeShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-[#074139]" />
                Update Courier Dispatch Info
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Order <span className="font-bold text-gray-800">#{activeShipment.orderNumber}</span> • Vendor:{' '}
                <span className="font-semibold text-gray-800">{activeShipment.vendorName}</span>
              </p>
            </div>

            <form onSubmit={handleSaveOverride} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Courier / Logistics Partner *
                </label>
                <select
                  value={overrideCourier}
                  onChange={(e) => setOverrideCourier(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#074139] bg-white"
                >
                  {POPULAR_COURIERS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {overrideCourier === 'Other' && (
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Custom Courier Partner Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={overrideCustomCourier}
                    onChange={(e) => setOverrideCustomCourier(e.target.value)}
                    placeholder="e.g. Maruti Air Courier"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#074139]"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Tracking Number / Airway Bill (AWB) *
                </label>
                <input
                  type="text"
                  required
                  value={overrideTracking}
                  onChange={(e) => setOverrideTracking(e.target.value.toUpperCase())}
                  placeholder="e.g. DEL-772918239"
                  className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#074139]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Tracking Website URL (Optional)
                </label>
                <input
                  type="url"
                  value={overrideWebsite}
                  onChange={(e) => setOverrideWebsite(e.target.value)}
                  placeholder="https://delhivery.com/track/package/..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#074139]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setActiveShipment(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={overrideMutation.isPending}
                  className="px-4 py-2 text-xs font-semibold bg-[#074139] hover:bg-[#05302a] text-white rounded-lg transition-colors shadow-xs"
                >
                  {overrideMutation.isPending ? 'Saving...' : 'Save & Confirm Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
