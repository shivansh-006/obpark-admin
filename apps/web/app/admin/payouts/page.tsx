'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  CheckCircle2,
  Clock,
  Download,
  Building,
  ArrowRight,
  X,
  FileSpreadsheet,
  AlertCircle,
  Search,
} from 'lucide-react'

interface VendorLedgerSummary {
  vendorId: string
  businessName: string
  contactPerson: string
  email: string
  phone: string
  commissionRate: number
  bankAccountNo?: string
  bankIfsc?: string
  bankName?: string
  upiId?: string
  isActive: boolean
  totalShipments: number
  fulfilledShipments: number
  grossSales: number
  platformFee: number
  netPayable: number
  pendingAmount: number
  eligibleAmount: number
  settledAmount: number
}

interface PayoutsResponse {
  kpis: {
    totalGrossSales: number
    totalPlatformFee: number
    totalNetPayable: number
    totalSettledAmount: number
    totalEligibleAmount: number
    totalPendingAmount: number
    activeVendorsCount: number
  }
  ledger: VendorLedgerSummary[]
}

interface VendorShipmentDetail {
  id: string
  orderNumber: string
  orderStatus: string
  subtotal: number
  commissionRate: number
  platformFee: number
  netPayable: number
  status: 'PENDING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED'
  payoutStatus: 'PENDING' | 'ELIGIBLE' | 'SETTLED'
  settlementRef?: string
  settlementDate?: string
  createdAt: string
  deliveredAt?: string
}

interface VendorDetailsResponse {
  vendor: {
    id: string
    businessName: string
    contactPerson: string
    email: string
    phone: string
    commissionRate: number
    bankAccountNo?: string
    bankIfsc?: string
    bankName?: string
    upiId?: string
  }
  shipments: VendorShipmentDetail[]
}

export default function PayoutsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null)

  // Settlement Form State
  const [activeShipmentId, setActiveShipmentId] = useState<string | null>(null)
  const [settlementRef, setSettlementRef] = useState('')
  const [settlementNotes, setSettlementNotes] = useState('')

  // Query Payout Summary
  const { data, isLoading } = useQuery<PayoutsResponse>({
    queryKey: ['admin', 'payouts'],
    queryFn: () => api.get<PayoutsResponse>('/admin/payouts'),
  })

  // Query Vendor Breakdown Details (when a vendor is selected)
  const { data: vendorDetails, isLoading: isLoadingDetails } = useQuery<VendorDetailsResponse>({
    queryKey: ['admin', 'payouts', 'vendor', selectedVendorId],
    queryFn: () => api.get<VendorDetailsResponse>(`/admin/payouts/vendor/${selectedVendorId}`),
    enabled: !!selectedVendorId,
  })

  // Settle Mutation
  const settleMutation = useMutation({
    mutationFn: ({
      shipmentId,
      settlementRef,
      notes,
    }: {
      shipmentId: string
      settlementRef: string
      notes?: string
    }) =>
      api.post(`/admin/payouts/settle/${shipmentId}`, {
        settlementRef,
        notes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'payouts'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'shipments'] })
      setActiveShipmentId(null)
      setSettlementRef('')
      setSettlementNotes('')
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to record settlement')
    },
  })

  const ledger = data?.ledger || []
  const kpis = data?.kpis || {
    totalGrossSales: 0,
    totalPlatformFee: 0,
    totalNetPayable: 0,
    totalSettledAmount: 0,
    totalEligibleAmount: 0,
    totalPendingAmount: 0,
    activeVendorsCount: 0,
  }

  const filteredLedger = ledger.filter((v) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      v.businessName.toLowerCase().includes(q) ||
      v.contactPerson.toLowerCase().includes(q) ||
      v.email.toLowerCase().includes(q)
    )
  })

  // CSV Export
  const handleExportCsv = () => {
    if (ledger.length === 0) return
    const headers = [
      'Vendor ID',
      'Business Name',
      'Contact Person',
      'Email',
      'Phone',
      'Commission Rate (%)',
      'Fulfilled Shipments',
      'Total Shipments',
      'Gross Sales (INR)',
      'Platform Commission (INR)',
      'Net Payable (INR)',
      'Settled Amount (INR)',
      'Eligible Amount (INR)',
      'Pending Amount (INR)',
    ]

    const rows = ledger.map((v) => [
      v.vendorId,
      `"${v.businessName.replace(/"/g, '""')}"`,
      `"${v.contactPerson.replace(/"/g, '""')}"`,
      v.email,
      v.phone,
      v.commissionRate,
      v.fulfilledShipments,
      v.totalShipments,
      v.grossSales.toFixed(2),
      v.platformFee.toFixed(2),
      v.netPayable.toFixed(2),
      v.settledAmount.toFixed(2),
      v.eligibleAmount.toFixed(2),
      v.pendingAmount.toFixed(2),
    ])

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `OBPARK_Vendor_Payout_Ledger_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleConfirmSettle = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeShipmentId) return
    if (!settlementRef.trim()) {
      alert('Please enter a Bank UTR or Transaction Reference number.')
      return
    }

    settleMutation.mutate({
      shipmentId: activeShipmentId,
      settlementRef: settlementRef.trim(),
      notes: settlementNotes.trim() || undefined,
    })
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="w-7 h-7 text-[#074139]" />
            Vendor Payout Ledger & Settlement
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Financial reconciliation, commission retention, and net vendor settlement tracking.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          disabled={ledger.length === 0}
          className="border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4 text-emerald-700" />
          Export Ledger (CSV)
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <span className="text-[0.6875rem] font-semibold text-gray-500 uppercase tracking-wider block">
            Total Gross Sales
          </span>
          <span className="text-xl font-bold text-gray-900 mt-1 block">
            ₹{kpis.totalGrossSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
          <span className="text-[0.6875rem] font-semibold text-emerald-700 uppercase tracking-wider block">
            OBPark Commission
          </span>
          <span className="text-xl font-bold text-emerald-800 mt-1 block">
            ₹{kpis.totalPlatformFee.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <span className="text-[0.6875rem] font-semibold text-gray-500 uppercase tracking-wider block">
            Net Vendor Payable
          </span>
          <span className="text-xl font-bold text-gray-900 mt-1 block">
            ₹{kpis.totalNetPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-300 bg-emerald-50/40 shadow-xs">
          <span className="text-[0.6875rem] font-semibold text-emerald-800 uppercase tracking-wider block flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Total Settled
          </span>
          <span className="text-xl font-bold text-emerald-900 mt-1 block">
            ₹{kpis.totalSettledAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50/20 shadow-xs">
          <span className="text-[0.6875rem] font-semibold text-blue-700 uppercase tracking-wider block flex items-center gap-1">
            <CreditCard className="w-3 h-3 text-blue-600" /> Eligible to Pay
          </span>
          <span className="text-xl font-bold text-blue-900 mt-1 block">
            ₹{kpis.totalEligibleAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs">
          <span className="text-[0.6875rem] font-semibold text-amber-700 uppercase tracking-wider block flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-600" /> In-Transit / Pending
          </span>
          <span className="text-xl font-bold text-amber-900 mt-1 block">
            ₹{kpis.totalPendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Search and Table */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search vendor name, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#074139]"
          />
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading payout ledger...</div>
        ) : filteredLedger.length === 0 ? (
          <div className="p-12 text-center">
            <FileSpreadsheet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-800">No ledger entries</h3>
            <p className="text-sm text-gray-500 mt-1">
              Ledger calculations are automatically generated as vendor shipments are created.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Vendor Partner</th>
                  <th className="py-3 px-4">Shipments</th>
                  <th className="py-3 px-4">Comm. %</th>
                  <th className="py-3 px-4">Gross Sales</th>
                  <th className="py-3 px-4">OBPark Fee</th>
                  <th className="py-3 px-4">Net Payable</th>
                  <th className="py-3 px-4">Settled</th>
                  <th className="py-3 px-4">Eligible</th>
                  <th className="py-3 px-4">Pending</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLedger.map((v) => (
                  <tr key={v.vendorId} className="hover:bg-gray-50/80 transition-colors">
                    {/* Vendor */}
                    <td className="py-3.5 px-4 font-medium text-gray-900">
                      <div className="font-semibold text-gray-900">{v.businessName}</div>
                      <div className="text-[0.6875rem] text-gray-500">{v.contactPerson} • {v.phone}</div>
                    </td>

                    {/* Shipments */}
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-gray-900">{v.fulfilledShipments}</span>
                      <span className="text-gray-400"> / {v.totalShipments}</span>
                    </td>

                    {/* Comm Rate */}
                    <td className="py-3.5 px-4 font-mono font-semibold text-emerald-800">
                      {v.commissionRate}%
                    </td>

                    {/* Gross */}
                    <td className="py-3.5 px-4 font-semibold text-gray-900">
                      ₹{v.grossSales.toFixed(2)}
                    </td>

                    {/* Platform Fee */}
                    <td className="py-3.5 px-4 font-semibold text-emerald-700">
                      ₹{v.platformFee.toFixed(2)}
                    </td>

                    {/* Net Payable */}
                    <td className="py-3.5 px-4 font-bold text-gray-900">
                      ₹{v.netPayable.toFixed(2)}
                    </td>

                    {/* Settled */}
                    <td className="py-3.5 px-4 text-emerald-800 font-semibold">
                      ₹{v.settledAmount.toFixed(2)}
                    </td>

                    {/* Eligible */}
                    <td className="py-3.5 px-4">
                      {v.eligibleAmount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[0.6875rem] font-bold bg-blue-100 text-blue-800">
                          ₹{v.eligibleAmount.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-gray-400">₹0.00</span>
                      )}
                    </td>

                    {/* Pending */}
                    <td className="py-3.5 px-4 text-amber-700">
                      ₹{v.pendingAmount.toFixed(2)}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedVendorId(v.vendorId)}
                        className="px-3 py-1.5 rounded-lg bg-[#074139] hover:bg-[#05302a] text-white font-medium inline-flex items-center gap-1 shadow-xs transition-colors"
                      >
                        Breakdown <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Vendor Payout Detail & Settlement Modal */}
      {selectedVendorId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b pb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Building className="w-5 h-5 text-[#074139]" />
                  {vendorDetails?.vendor.businessName || 'Vendor Payout Ledger'}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Contact: {vendorDetails?.vendor.contactPerson} ({vendorDetails?.vendor.phone}) • Comm. Rate:{' '}
                  {vendorDetails?.vendor.commissionRate}%
                </p>
              </div>
              <button
                onClick={() => setSelectedVendorId(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Vendor Bank Details Card */}
            {vendorDetails?.vendor && (
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-gray-400 block font-medium">Bank Name</span>
                  <span className="font-semibold text-gray-800">
                    {vendorDetails.vendor.bankName || 'Not Provided'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block font-medium">Account Number</span>
                  <span className="font-semibold font-mono text-gray-800">
                    {vendorDetails.vendor.bankAccountNo || 'Not Provided'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block font-medium">IFSC Code</span>
                  <span className="font-semibold font-mono text-gray-800">
                    {vendorDetails.vendor.bankIfsc || 'Not Provided'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block font-medium">UPI ID</span>
                  <span className="font-semibold font-mono text-gray-800">
                    {vendorDetails.vendor.upiId || 'Not Provided'}
                  </span>
                </div>
              </div>
            )}

            {/* Shipments List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Fulfilled Shipments & Settlement Status
              </h4>

              {isLoadingDetails ? (
                <div className="p-8 text-center text-xs text-gray-500">Loading shipments...</div>
              ) : !vendorDetails?.shipments || vendorDetails.shipments.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-500">
                  No shipments recorded for this vendor yet.
                </div>
              ) : (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                        <th className="py-2.5 px-3">Order #</th>
                        <th className="py-2.5 px-3">Delivery Status</th>
                        <th className="py-2.5 px-3">Gross</th>
                        <th className="py-2.5 px-3">OBPark Fee</th>
                        <th className="py-2.5 px-3">Net Due</th>
                        <th className="py-2.5 px-3">Payout Status</th>
                        <th className="py-2.5 px-3 text-right">Settlement Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {vendorDetails.shipments.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50/60">
                          <td className="py-2.5 px-3 font-medium text-emerald-900">
                            #{s.orderNumber}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="text-gray-700 font-medium">{s.status}</span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-gray-800">
                            ₹{s.subtotal.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-emerald-700">
                            ₹{s.platformFee.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-gray-900">
                            ₹{s.netPayable.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3">
                            {s.payoutStatus === 'SETTLED' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.625rem] font-bold bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-2.5 h-2.5" /> SETTLED
                              </span>
                            )}
                            {s.payoutStatus === 'ELIGIBLE' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.625rem] font-bold bg-blue-100 text-blue-800">
                                <CreditCard className="w-2.5 h-2.5" /> ELIGIBLE
                              </span>
                            )}
                            {s.payoutStatus === 'PENDING' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.625rem] font-bold bg-amber-100 text-amber-800">
                                <Clock className="w-2.5 h-2.5" /> PENDING
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {s.payoutStatus === 'SETTLED' ? (
                              <div className="text-[0.625rem] text-gray-500">
                                <span className="font-mono text-emerald-800 font-semibold block">
                                  Ref: {s.settlementRef}
                                </span>
                                {s.settlementDate && (
                                  <span>
                                    {new Date(s.settlementDate).toLocaleDateString('en-IN')}
                                  </span>
                                )}
                              </div>
                            ) : s.payoutStatus === 'ELIGIBLE' ? (
                              <button
                                onClick={() => setActiveShipmentId(s.id)}
                                className="px-2.5 py-1 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-[0.6875rem] transition-colors shadow-xs"
                              >
                                Mark Settled
                              </button>
                            ) : (
                              <span className="text-[0.625rem] text-gray-400 italic">
                                Awaiting Delivery
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Close Modal Button */}
            <div className="flex justify-end pt-3 border-t">
              <button
                onClick={() => setSelectedVendorId(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settle Shipment Input Modal */}
      {activeShipmentId && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Record Vendor Bank Transfer
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Enter the Bank Transfer / NEFT / IMPS / UPI transaction reference to record this settlement.
              </p>
            </div>

            <form onSubmit={handleConfirmSettle} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Bank UTR / Transaction Ref *
                </label>
                <input
                  type="text"
                  required
                  value={settlementRef}
                  onChange={(e) => setSettlementRef(e.target.value.toUpperCase())}
                  placeholder="e.g. UTR1928374829"
                  className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#074139]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Internal Notes (Optional)
                </label>
                <input
                  type="text"
                  value={settlementNotes}
                  onChange={(e) => setSettlementNotes(e.target.value)}
                  placeholder="e.g. Settled via HDFC NetBanking"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#074139]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setActiveShipmentId(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={settleMutation.isPending}
                  className="px-3 py-1.5 text-xs font-semibold bg-[#074139] hover:bg-[#05302a] text-white rounded-lg transition-colors shadow-xs"
                >
                  {settleMutation.isPending ? 'Saving...' : 'Confirm Settlement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
