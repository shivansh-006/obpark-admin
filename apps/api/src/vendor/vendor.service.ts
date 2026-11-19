import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

export interface CreateVendorDto {
  businessName: string
  contactPerson: string
  email: string
  phone: string
  whatsappNumber?: string
  address: string
  city: string
  state: string
  postalCode: string
  country?: string
  gstin?: string
  commissionRate?: number
  bankAccountNo?: string
  bankIfsc?: string
  bankName?: string
  upiId?: string
  notes?: string
}

export interface UpdateVendorDto extends Partial<CreateVendorDto> {
  isActive?: boolean
}

@Injectable()
export class VendorService {
  constructor(private prisma: PrismaService) {}

  async createVendor(dto: CreateVendorDto) {
    const cleanEmail = dto.email.trim().toLowerCase()
    const existing = await this.prisma.vendor.findUnique({
      where: { email: cleanEmail },
    })
    if (existing) {
      throw new ConflictException(`Vendor with email '${cleanEmail}' already exists`)
    }

    return this.prisma.vendor.create({
      data: {
        businessName: dto.businessName.trim(),
        contactPerson: dto.contactPerson.trim(),
        email: cleanEmail,
        phone: dto.phone.trim(),
        whatsappNumber: dto.whatsappNumber?.trim() || null,
        address: dto.address.trim(),
        city: dto.city.trim(),
        state: dto.state.trim(),
        postalCode: dto.postalCode.trim(),
        country: dto.country?.trim() || 'India',
        gstin: dto.gstin?.trim().toUpperCase() || null,
        commissionRate: dto.commissionRate !== undefined ? Number(dto.commissionRate) : 10.0,
        bankAccountNo: dto.bankAccountNo?.trim() || null,
        bankIfsc: dto.bankIfsc?.trim().toUpperCase() || null,
        bankName: dto.bankName?.trim() || null,
        upiId: dto.upiId?.trim() || null,
        notes: dto.notes?.trim() || null,
      },
    })
  }

  async listVendors(search?: string, isActive?: boolean) {
    const where: any = {}
    if (isActive !== undefined) {
      where.isActive = isActive
    }
    if (search) {
      const q = search.trim()
      where.OR = [
        { businessName: { contains: q, mode: 'insensitive' } },
        { contactPerson: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { gstin: { contains: q, mode: 'insensitive' } },
      ]
    }

    const vendors = await this.prisma.vendor.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            products: true,
            shipments: true,
          },
        },
      },
    })

    return vendors.map((v) => ({
      ...v,
      commissionRate: Number(v.commissionRate),
      productCount: v._count.products,
      shipmentCount: v._count.shipments,
    }))
  }

  async getVendorById(id: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      include: {
        products: {
          select: {
            id: true,
            productId: true,
            productName: true,
            price: true,
            imagePath: true,
          },
          take: 20,
        },
        shipments: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            status: true,
            subtotal: true,
            courierName: true,
            trackingNumber: true,
            createdAt: true,
            order: {
              select: { orderNumber: true },
            },
          },
        },
        _count: {
          select: {
            products: true,
            shipments: true,
          },
        },
      },
    })

    if (!vendor) {
      throw new NotFoundException(`Vendor with ID '${id}' not found`)
    }

    return {
      ...vendor,
      commissionRate: Number(vendor.commissionRate),
      productCount: vendor._count.products,
      shipmentCount: vendor._count.shipments,
    }
  }

  async updateVendor(id: string, dto: UpdateVendorDto) {
    const existing = await this.prisma.vendor.findUnique({ where: { id } })
    if (!existing) {
      throw new NotFoundException(`Vendor with ID '${id}' not found`)
    }

    const data: any = {}
    if (dto.businessName !== undefined) data.businessName = dto.businessName.trim()
    if (dto.contactPerson !== undefined) data.contactPerson = dto.contactPerson.trim()
    if (dto.email !== undefined) {
      const cleanEmail = dto.email.trim().toLowerCase()
      if (cleanEmail !== existing.email) {
        const conflict = await this.prisma.vendor.findUnique({ where: { email: cleanEmail } })
        if (conflict) {
          throw new ConflictException(`Vendor with email '${cleanEmail}' already exists`)
        }
        data.email = cleanEmail
      }
    }
    if (dto.phone !== undefined) data.phone = dto.phone.trim()
    if (dto.whatsappNumber !== undefined) data.whatsappNumber = dto.whatsappNumber?.trim() || null
    if (dto.address !== undefined) data.address = dto.address.trim()
    if (dto.city !== undefined) data.city = dto.city.trim()
    if (dto.state !== undefined) data.state = dto.state.trim()
    if (dto.postalCode !== undefined) data.postalCode = dto.postalCode.trim()
    if (dto.country !== undefined) data.country = dto.country?.trim() || 'India'
    if (dto.gstin !== undefined) data.gstin = dto.gstin?.trim().toUpperCase() || null
    if (dto.commissionRate !== undefined) data.commissionRate = Number(dto.commissionRate)
    if (dto.bankAccountNo !== undefined) data.bankAccountNo = dto.bankAccountNo?.trim() || null
    if (dto.bankIfsc !== undefined) data.bankIfsc = dto.bankIfsc?.trim().toUpperCase() || null
    if (dto.bankName !== undefined) data.bankName = dto.bankName?.trim() || null
    if (dto.upiId !== undefined) data.upiId = dto.upiId?.trim() || null
    if (dto.isActive !== undefined) data.isActive = dto.isActive
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null

    const updated = await this.prisma.vendor.update({
      where: { id },
      data,
    })

    return {
      ...updated,
      commissionRate: Number(updated.commissionRate),
    }
  }

  async toggleVendorStatus(id: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id } })
    if (!vendor) {
      throw new NotFoundException(`Vendor with ID '${id}' not found`)
    }

    const updated = await this.prisma.vendor.update({
      where: { id },
      data: { isActive: !vendor.isActive },
    })

    return {
      id: updated.id,
      isActive: updated.isActive,
      message: `Vendor is now ${updated.isActive ? 'active' : 'inactive'}`,
    }
  }

  async deleteVendor(id: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true, shipments: true },
        },
      },
    })
    if (!vendor) {
      throw new NotFoundException(`Vendor with ID '${id}' not found`)
    }

    if (vendor._count.products > 0 || vendor._count.shipments > 0) {
      // Soft-deactivate if products or shipments exist to preserve transactional integrity
      await this.prisma.vendor.update({
        where: { id },
        data: { isActive: false },
      })
      return {
        success: true,
        softDeleted: true,
        message: `Vendor has ${vendor._count.products} product(s) and ${vendor._count.shipments} shipment(s). Deactivated instead of deleted.`,
      }
    }

    await this.prisma.vendor.delete({ where: { id } })
    return { success: true, softDeleted: false, message: 'Vendor deleted successfully' }
  }
}
