import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface VendorItem {
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
  productCount?: number
  shipmentCount?: number
  createdAt?: string
}

export function useVendors(params?: { search?: string; isActive?: boolean }) {
  const query = new URLSearchParams()
  if (params?.search) query.set('search', params.search)
  if (params?.isActive !== undefined) query.set('isActive', String(params.isActive))

  const qs = query.toString() ? `?${query.toString()}` : ''

  return useQuery<VendorItem[]>({
    queryKey: ['admin', 'vendors', params?.search, params?.isActive],
    queryFn: () => api.get<VendorItem[]>(`/admin/vendors${qs}`),
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  })
}
