'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  Package,
  Truck,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Clock,
  Phone,
  ShieldCheck,
} from 'lucide-react'

const COURIER_OPTIONS = [
  'Delhivery',
  'BlueDart',
  'DTDC',
  'India Post',
  'Ekart Logistics',
  'XpressBees',
  'Shadowfax',
  'Professional Couriers',
  'Other',
]

interface ShipmentData {
  shipmentId: string
  orderNumber: string
  vendorName: string
  status: string
  items: Array<{
    name: string
    sku?: string
    quantity: number
    unitPrice: number
    totalPrice: number
    variant?: string
  }>
  subtotal: number
  customer: {
    name: string
    phone: string
    streetAddress: string
    city: string
    state: string
    postalCode: string
  }
  courierName?: string
  trackingNumber?: string
  dispatchedAt?: string
  isDispatched: boolean
}

export default function DispatchPortalPage() {
  const params = useParams()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ShipmentData | null>(null)

  const [courierName, setCourierName] = useState('Delhivery')
  const [customCourier, setCustomCourier] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://admin-api.obpark.in'

  useEffect(() => {
    if (!token) return
    fetch(`${apiUrl}/dispatch/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.message || 'Invalid or expired dispatch link')
        }
        return res.json()
      })
      .then((shipment: ShipmentData) => {
        setData(shipment)
        if (shipment.isDispatched) {
          setSubmitSuccess(true)
        }
      })
      .catch((err) => {
        setError(err.message)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [token, apiUrl])

  const handleConfirmDispatch = async (e: React.FormEvent) => {
    e.preventDefault()
    const finalCourier = courierName === 'Other' ? customCourier.trim() : courierName
    if (!finalCourier) {
      alert('Please specify the courier partner')
      return
    }
    if (!trackingNumber.trim()) {
      alert('Please enter a valid AWB / Tracking number')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`${apiUrl}/dispatch/${token}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courierName: finalCourier,
          trackingNumber: trackingNumber.trim(),
        }),
      })

      const result = await res.json()
      if (!res.ok) {
        throw new Error(result.message || 'Failed to confirm dispatch')
      }

      setSubmitSuccess(true)
      if (data) {
        setData({
          ...data,
          status: 'DISPATCHED',
          isDispatched: true,
          courierName: finalCourier,
          trackingNumber: trackingNumber.trim(),
          dispatchedAt: new Date().toISOString(),
        })
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#074139] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Verifying dispatch credentials...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Dispatch Link Unavailable</h2>
          <p className="text-gray-600 text-sm mb-6">{error || 'This link may have expired or is invalid.'}</p>
          <p className="text-xs text-gray-400">If you believe this is an error, please contact OBPark support.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto">
        {/* Top Header */}
        <div className="bg-[#074139] text-white rounded-t-xl p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-wider text-white">OBPARK</span>
              <span className="text-xs bg-[#95D0CC] text-[#074139] font-bold px-2 py-0.5 rounded">
                FULFILLMENT
              </span>
            </div>
            <p className="text-xs text-[#95D0CC] mt-1">Vendor Dispatch Confirmation Portal</p>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-xs text-gray-300 uppercase tracking-wider block">Order Reference</span>
            <span className="text-lg font-bold text-white tracking-wide">{data.orderNumber}</span>
          </div>
        </div>

        {/* Vendor & Status Bar */}
        <div className="bg-white border-x border-b border-gray-200 p-4 px-6 flex flex-wrap justify-between items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#074139]" />
            <span className="text-gray-500">Fulfilled By:</span>
            <strong className="text-gray-900">{data.vendorName}</strong>
          </div>

          <div>
            {data.isDispatched ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                <CheckCircle2 className="w-3.5 h-3.5" /> Dispatched
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                <Clock className="w-3.5 h-3.5" /> Awaiting Dispatch
              </span>
            )}
          </div>
        </div>

        {/* Main Content Body */}
        <div className="bg-white border-x border-b border-gray-200 p-6 sm:p-8 space-y-8 rounded-b-xl shadow-sm">
          {/* Customer Destination Card */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-[#074139]" />
              Shipping Destination (Consignee)
            </h3>
            <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-5">
              <p className="text-base font-bold text-gray-900">{data.customer.name}</p>
              <p className="text-sm text-blue-900 flex items-center gap-1.5 mt-1 font-medium">
                <Phone className="w-3.5 h-3.5" /> {data.customer.phone}
              </p>
              <p className="text-sm text-gray-700 mt-2 leading-relaxed">
                {data.customer.streetAddress}
                <br />
                {data.customer.city}, {data.customer.state} - <strong>{data.customer.postalCode}</strong>
              </p>
            </div>
          </div>

          {/* Items Manifest */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-[#074139]" />
              Items to Pack
            </h3>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-medium">
                  <tr>
                    <th className="px-4 py-3 text-left">Product</th>
                    <th className="px-4 py-3 text-left">SKU</th>
                    <th className="px-4 py-3 text-center">Qty</th>
                    <th className="px-4 py-3 text-right">Unit Price</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-gray-800">
                  {data.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium">
                        {item.name}
                        {item.variant && (
                          <span className="block text-xs text-gray-500 font-normal">
                            Variant: {item.variant}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{item.sku || '—'}</td>
                      <td className="px-4 py-3 text-center font-bold">{item.quantity}</td>
                      <td className="px-4 py-3 text-right">₹{Number(item.unitPrice).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        ₹{Number(item.totalPrice).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dispatch Submission Card */}
          {submitSuccess || data.isDispatched ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-green-900 mb-1">Shipment Confirmed as Dispatched</h4>
              <p className="text-sm text-green-800 mb-4">
                Thank you! The customer has been notified with the tracking details below.
              </p>
              <div className="bg-white border border-green-200 rounded-lg p-4 max-w-sm mx-auto text-left text-sm">
                <p className="text-gray-500 text-xs">Courier Partner:</p>
                <p className="font-bold text-gray-900 mb-2">{data.courierName}</p>
                <p className="text-gray-500 text-xs">AWB / Tracking Number:</p>
                <p className="font-mono font-bold text-[#074139] text-base">{data.trackingNumber}</p>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
              <h4 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-1">
                <Truck className="w-5 h-5 text-[#074139]" />
                Record Dispatch &amp; Tracking
              </h4>
              <p className="text-xs text-gray-500 mb-5">
                Once the parcel is picked up by your courier, select the partner and enter the AWB tracking number.
              </p>

              <form onSubmit={handleConfirmDispatch} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                      Courier Partner <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={courierName}
                      onChange={(e) => setCourierName(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#074139]"
                    >
                      {COURIER_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {courierName === 'Other' && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                        Specify Courier Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Local Fast Cargo"
                        value={customCourier}
                        onChange={(e) => setCustomCourier(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#074139]"
                        required
                      />
                    </div>
                  )}

                  <div className={courierName === 'Other' ? 'sm:col-span-2' : ''}>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                      AWB / Tracking Docket Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. DEL789123456"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 font-mono text-sm tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-[#074139]"
                      required
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full sm:w-auto bg-[#074139] hover:bg-[#05302a] text-white font-bold px-8 py-3 rounded-lg text-sm transition-all shadow hover:shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? 'Confirming Dispatch...' : 'Confirm Shipment & Update Tracking'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Brand Footer */}
        <div className="text-center mt-6 text-xs text-gray-400">
          OBPark Marketplace Central &bull; Automated Merchant Operations
        </div>
      </div>
    </div>
  )
}
