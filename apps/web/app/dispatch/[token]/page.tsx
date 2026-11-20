'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { microgrammaBold } from '@/lib/fonts'
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
      <div className="min-h-screen bg-[#F0FAF5] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#074139] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#074139] font-medium font-michroma text-sm">Verifying dispatch credentials...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#F0FAF5] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-[#CAEDE6] p-8 text-center">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className={`text-xl font-bold text-[#074139] mb-2 ${microgrammaBold.className}`}>Dispatch Link Unavailable</h2>
          <p className="text-gray-600 text-sm mb-6">{error || 'This link may have expired or is invalid.'}</p>
          <p className="text-xs text-gray-400">If you believe this is an error, please contact Obrive support.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F0FAF5] py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto">
        {/* Top Header */}
        <div className="bg-[#074139] text-white rounded-t-2xl p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm border border-[#074139]">
          <div className="flex items-center gap-4">
            <div className="h-10 w-28 relative">
              <Image
                src="/obrive-white-logo.svg"
                alt="Obrive Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <div className="h-6 w-px bg-white/20" />
            <div>
              <span className="text-xs bg-[#A2F1DF] text-[#074139] font-michroma font-bold px-2.5 py-0.5 rounded-full inline-block">
                FULFILLMENT
              </span>
              <p className="text-[11px] text-[#A2F1DF]/80 mt-0.5 font-sans">Merchant Dispatch Portal</p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-[11px] text-[#A2F1DF]/70 uppercase tracking-wider block font-michroma">Order Reference</span>
            <span className={`text-lg font-bold text-white tracking-wide ${microgrammaBold.className}`}>{data.orderNumber}</span>
          </div>
        </div>

        {/* Vendor & Status Bar */}
        <div className="bg-white border-x border-b border-[#CAEDE6] p-4 px-6 flex flex-wrap justify-between items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#074139]" />
            <span className="text-gray-500">Fulfilled By:</span>
            <strong className="text-[#074139] font-michroma text-xs">{data.vendorName}</strong>
          </div>

          <div>
            {data.isDispatched ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E6F5F2] text-[#074139] border border-[#CAEDE6]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Dispatched
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                <Clock className="w-3.5 h-3.5" /> Awaiting Dispatch
              </span>
            )}
          </div>
        </div>

        {/* Main Content Body */}
        <div className="bg-white border-x border-b border-[#CAEDE6] p-6 sm:p-8 space-y-8 rounded-b-2xl shadow-sm">
          {/* Customer Destination Card */}
          <div>
            <h3 className={`text-xs font-bold text-[#074139] uppercase tracking-wider flex items-center gap-2 mb-3 ${microgrammaBold.className}`}>
              <MapPin className="w-4 h-4 text-[#074139]" />
              Shipping Destination (Consignee)
            </h3>
            <div className="bg-[#E6F5F2]/80 border border-[#CAEDE6] rounded-xl p-5">
              <p className="text-base font-bold text-[#074139] font-michroma">{data.customer.name}</p>
              <p className="text-sm text-[#074139]/80 flex items-center gap-1.5 mt-1 font-medium">
                <Phone className="w-3.5 h-3.5 text-[#074139]" /> {data.customer.phone}
              </p>
              <p className="text-sm text-gray-700 mt-2 leading-relaxed">
                {data.customer.streetAddress}
                <br />
                {data.customer.city}, {data.customer.state} - <strong className="text-[#074139]">{data.customer.postalCode}</strong>
              </p>
            </div>
          </div>

          {/* Items Manifest */}
          <div>
            <h3 className={`text-xs font-bold text-[#074139] uppercase tracking-wider flex items-center gap-2 mb-3 ${microgrammaBold.className}`}>
              <Package className="w-4 h-4 text-[#074139]" />
              Items to Pack
            </h3>
            <div className="border border-[#CAEDE6] rounded-xl overflow-hidden">
              <table className="min-w-full divide-y divide-[#CAEDE6] text-sm">
                <thead className="bg-[#E6F5F2] text-[#074139] text-xs uppercase font-michroma">
                  <tr>
                    <th className="px-4 py-3 text-left">Product</th>
                    <th className="px-4 py-3 text-left">SKU</th>
                    <th className="px-4 py-3 text-center">Qty</th>
                    <th className="px-4 py-3 text-right">Unit Price</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#CAEDE6]/60 text-gray-800">
                  {data.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-[#E6F5F2]/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {item.name}
                        {item.variant && (
                          <span className="block text-xs text-gray-500 font-normal">
                            Variant: {item.variant}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{item.sku || '—'}</td>
                      <td className="px-4 py-3 text-center font-bold text-[#074139]">{item.quantity}</td>
                      <td className="px-4 py-3 text-right">₹{Number(item.unitPrice).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right font-medium text-[#074139]">
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
            <div className="bg-[#E6F5F2]/80 border border-[#CAEDE6] rounded-2xl p-6 text-center">
              <div className="w-12 h-12 bg-white text-[#074139] rounded-full flex items-center justify-center mx-auto mb-3 shadow-xs border border-[#CAEDE6]">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <h4 className={`text-lg font-bold text-[#074139] mb-1 ${microgrammaBold.className}`}>Shipment Confirmed as Dispatched</h4>
              <p className="text-sm text-gray-600 mb-4">
                Thank you! The customer has been notified with the tracking details below.
              </p>
              <div className="bg-white border border-[#CAEDE6] rounded-xl p-4 max-w-sm mx-auto text-left text-sm shadow-xs">
                <p className="text-gray-500 text-xs uppercase font-michroma">Courier Partner:</p>
                <p className="font-bold text-[#074139] mb-2">{data.courierName}</p>
                <p className="text-gray-500 text-xs uppercase font-michroma">AWB / Tracking Number:</p>
                <p className="font-mono font-bold text-[#074139] text-base">{data.trackingNumber}</p>
              </div>
            </div>
          ) : (
            <div className="bg-[#E6F5F2]/40 border border-[#CAEDE6] rounded-2xl p-6">
              <h4 className={`text-sm font-bold text-[#074139] flex items-center gap-2 mb-1 uppercase tracking-wide ${microgrammaBold.className}`}>
                <Truck className="w-5 h-5 text-[#074139]" />
                Record Dispatch &amp; Tracking
              </h4>
              <p className="text-xs text-gray-500 mb-5">
                Once the parcel is picked up by your courier, select the partner and enter the AWB tracking number.
              </p>

              <form onSubmit={handleConfirmDispatch} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#074139] uppercase mb-1 font-michroma">
                      Courier Partner <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={courierName}
                      onChange={(e) => setCourierName(e.target.value)}
                      className="w-full bg-white border border-[#CAEDE6] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#074139]"
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
                      <label className="block text-xs font-semibold text-[#074139] uppercase mb-1 font-michroma">
                        Specify Courier Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Local Fast Cargo"
                        value={customCourier}
                        onChange={(e) => setCustomCourier(e.target.value)}
                        className="w-full bg-white border border-[#CAEDE6] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#074139]"
                        required
                      />
                    </div>
                  )}

                  <div className={courierName === 'Other' ? 'sm:col-span-2' : ''}>
                    <label className="block text-xs font-semibold text-[#074139] uppercase mb-1 font-michroma">
                      AWB / Tracking Docket Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. DEL789123456"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      className="w-full bg-white border border-[#CAEDE6] rounded-xl px-3 py-2.5 font-mono text-sm tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-[#074139]"
                      required
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full sm:w-auto bg-[#074139] hover:bg-[#05302a] text-white font-michroma text-xs font-bold px-8 py-3 rounded-xl transition-all shadow hover:shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? 'Confirming Dispatch...' : 'Confirm Shipment & Update Tracking'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Brand Footer */}
        <div className="text-center mt-6 text-xs text-gray-400 font-michroma">
          Obrive Central &bull; Automated Merchant Operations
        </div>
      </div>
    </div>
  )
}
