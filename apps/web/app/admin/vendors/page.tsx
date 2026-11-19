'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  Store,
  Plus,
  Search,
  Mail,
  Phone,
  MapPin,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  DollarSign,
  Package,
  X,
} from 'lucide-react'

interface Vendor {
  id: string
  businessName: string
  contactPerson: string
  email: string
  phone: string
  whatsappNumber?: string
  address: string
  city: string
  state: string
  postalCode: string
  gstin?: string
  commissionRate: number
  bankAccountNo?: string
  bankIfsc?: string
  bankName?: string
  upiId?: string
  isActive: boolean
  notes?: string
  productCount: number
  shipmentCount: number
  createdAt: string
}

export default function VendorsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)

  // Form State
  const [formData, setFormData] = useState({
    businessName: '',
    contactPerson: '',
    email: '',
    phone: '',
    whatsappNumber: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    gstin: '',
    commissionRate: 10,
    bankAccountNo: '',
    bankIfsc: '',
    bankName: '',
    upiId: '',
    notes: '',
  })

  // Fetch Vendors Query
  const { data: vendors = [], isLoading } = useQuery<Vendor[]>({
    queryKey: ['admin', 'vendors', search, statusFilter],
    queryFn: () => {
      const activeParam =
        statusFilter === 'all' ? '' : `&isActive=${statusFilter === 'active'}`
      return api.get<Vendor[]>(`/admin/vendors?search=${encodeURIComponent(search)}${activeParam}`)
    },
  })

  // Create / Update Mutation
  const saveMutation = useMutation({
    mutationFn: (data: typeof formData) => {
      if (editingVendor) {
        return api.patch(`/admin/vendors/${editingVendor.id}`, data)
      }
      return api.post('/admin/vendors', data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'vendors'] })
      closeModal()
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to save vendor')
    },
  })

  // Toggle Active Status Mutation
  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/vendors/${id}/toggle`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'vendors'] })
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to toggle status')
    },
  })

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/vendors/${id}`),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'vendors'] })
      if (res?.message) alert(res.message)
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to delete vendor')
    },
  })

  const openCreateModal = () => {
    setEditingVendor(null)
    setFormData({
      businessName: '',
      contactPerson: '',
      email: '',
      phone: '',
      whatsappNumber: '',
      address: '',
      city: '',
      state: '',
      postalCode: '',
      gstin: '',
      commissionRate: 10,
      bankAccountNo: '',
      bankIfsc: '',
      bankName: '',
      upiId: '',
      notes: '',
    })
    setIsModalOpen(true)
  }

  const openEditModal = (vendor: Vendor) => {
    setEditingVendor(vendor)
    setFormData({
      businessName: vendor.businessName,
      contactPerson: vendor.contactPerson,
      email: vendor.email,
      phone: vendor.phone,
      whatsappNumber: vendor.whatsappNumber || '',
      address: vendor.address,
      city: vendor.city,
      state: vendor.state,
      postalCode: vendor.postalCode,
      gstin: vendor.gstin || '',
      commissionRate: vendor.commissionRate,
      bankAccountNo: vendor.bankAccountNo || '',
      bankIfsc: vendor.bankIfsc || '',
      bankName: vendor.bankName || '',
      upiId: vendor.upiId || '',
      notes: vendor.notes || '',
    })
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingVendor(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMutation.mutate(formData)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Store className="w-7 h-7 text-[#074139]" />
            Vendor Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage marketplace merchant partners, commission terms, and dispatch contacts.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="bg-[#074139] hover:bg-[#05302a] text-white px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Onboard New Vendor
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by vendor name, email, city, GST..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#074139]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-gray-500 font-medium">Status:</span>
          {(['all', 'active', 'inactive'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                statusFilter === s
                  ? 'bg-[#074139] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Vendors Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500 text-sm">Loading vendors...</div>
        ) : vendors.length === 0 ? (
          <div className="p-12 text-center">
            <Store className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-800">No vendors found</h3>
            <p className="text-xs text-gray-500 mt-1">
              {search ? 'Try adjusting your search terms' : 'Click "Onboard New Vendor" to add your first partner.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4">Vendor / Business</th>
                  <th className="px-6 py-4">Contact Info</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4 text-center">Commission</th>
                  <th className="px-6 py-4 text-center">Products</th>
                  <th className="px-6 py-4 text-center">Shipments</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-700">
                {vendors.map((vendor) => (
                  <tr key={vendor.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{vendor.businessName}</div>
                      <div className="text-xs text-gray-500">Contact: {vendor.contactPerson}</div>
                      {vendor.gstin && (
                        <div className="text-[11px] font-mono text-gray-400 mt-0.5">GST: {vendor.gstin}</div>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-xs text-gray-700">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        {vendor.email}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-700 mt-1">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        {vendor.phone}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-xs text-gray-700">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        {vendor.city}, {vendor.state}
                      </div>
                      <div className="text-[11px] text-gray-400">{vendor.postalCode}</div>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <span className="font-bold text-[#074139] bg-green-50 px-2 py-0.5 rounded text-xs">
                        {vendor.commissionRate}%
                      </span>
                    </td>

                    <td className="px-6 py-4 text-center font-medium">
                      {vendor.productCount}
                    </td>

                    <td className="px-6 py-4 text-center font-medium">
                      {vendor.shipmentCount}
                    </td>

                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => toggleMutation.mutate(vendor.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          vendor.isActive
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {vendor.isActive ? (
                          <>
                            <CheckCircle className="w-3 h-3" /> Active
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" /> Inactive
                          </>
                        )}
                      </button>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(vendor)}
                          className="p-1.5 text-gray-500 hover:text-[#074139] hover:bg-gray-100 rounded-lg transition-colors"
                          title="Edit Vendor"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete/deactivate vendor "${vendor.businessName}"?`)) {
                              deleteMutation.mutate(vendor.id)
                            }
                          }}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Vendor"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Vendor Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto my-8">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Store className="w-5 h-5 text-[#074139]" />
                {editingVendor ? 'Edit Vendor Partner' : 'Onboard New Vendor Partner'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Business / Shop Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    placeholder="e.g. Apex Auto Components Pvt Ltd"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#074139]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Contact Person Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    placeholder="e.g. Rajesh Kumar"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#074139]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Dispatch Notification Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="orders@vendor.com"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#074139]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Contact Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. +91 9876543210"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#074139]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Warehouse / Pickup Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Plot No. 12, Industrial Area, Sector 5"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#074139]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. Pune"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#074139]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    State <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="e.g. Maharashtra"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#074139]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Postal Code (PIN) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    placeholder="411001"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#074139]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    GSTIN (Tax ID)
                  </label>
                  <input
                    type="text"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                    placeholder="27AAAAA0000A1Z5"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#074139]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    OBPark Platform Fee / Commission (%) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    required
                    value={formData.commissionRate}
                    onChange={(e) => setFormData({ ...formData, commissionRate: Number(e.target.value) })}
                    placeholder="10"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold text-[#074139] focus:outline-none focus:ring-2 focus:ring-[#074139]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Bank Account Number
                  </label>
                  <input
                    type="text"
                    value={formData.bankAccountNo}
                    onChange={(e) => setFormData({ ...formData, bankAccountNo: e.target.value })}
                    placeholder="Account Number"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#074139]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Bank IFSC Code
                  </label>
                  <input
                    type="text"
                    value={formData.bankIfsc}
                    onChange={(e) => setFormData({ ...formData, bankIfsc: e.target.value })}
                    placeholder="HDFC0001234"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#074139]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    placeholder="HDFC Bank"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#074139]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="bg-[#074139] hover:bg-[#05302a] text-white px-6 py-2 text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  {saveMutation.isPending ? 'Saving...' : editingVendor ? 'Update Vendor' : 'Onboard Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
