import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { QueueService } from '../queue/queue.service'
import { ReturnReason, ReturnStatus, WarrantyStatus } from '@prisma/client'

export interface CreateReturnDto {
  orderId: string
  orderItemId: string
  customerId: string
  reason: ReturnReason
  description: string
  evidenceImages?: string[]
}

export interface UpdateReturnStatusDto {
  status: ReturnStatus
  pickupCourier?: string
  pickupAwb?: string
}

export interface InspectReturnDto {
  inspectionNotes: string
  isRestocked: boolean
}

export interface ProcessRefundDto {
  refundAmount: number
  refundRef: string
  isVendorResponsible?: boolean
}

export interface CreateWarrantyClaimDto {
  productId: string
  orderId?: string
  customerId: string
  serialNumber?: string
  issueDescription: string
  evidenceFiles?: string[]
}

export interface ResolveWarrantyClaimDto {
  status: WarrantyStatus
  resolutionNotes: string
}

@Injectable()
export class ReturnsService {
  private readonly logger = new Logger(ReturnsService.name)

  constructor(
    private prisma: PrismaService,
    private queueService: QueueService,
  ) {}

  async createReturnRequest(dto: CreateReturnDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: {
        items: true,
        shipments: true,
      },
    })
    if (!order) throw new NotFoundException(`Order ${dto.orderId} not found`)

    const item = order.items.find((i) => i.id === dto.orderItemId || i.productId === dto.orderItemId)
    if (!item) throw new BadRequestException(`Order item not found in order ${dto.orderId}`)

    // Find vendor for this item if any
    const product = await this.prisma.product.findFirst({
      where: { OR: [{ id: item.productId }, { productId: item.productId }] },
      select: { vendorId: true },
    })

    const returnNumber = `RET-${Date.now().toString().slice(-6)}`

    const ret = await this.prisma.returnRequest.create({
      data: {
        returnNumber,
        orderId: order.id,
        orderItemId: item.id,
        vendorId: product?.vendorId || null,
        customerId: dto.customerId,
        reason: dto.reason,
        description: dto.description.trim(),
        evidenceImages: dto.evidenceImages || [],
        status: ReturnStatus.REQUESTED,
      },
      include: {
        customer: { select: { firstName: true, lastName: true, email: true, phoneNumber: true } },
        order: { select: { orderNumber: true } },
        vendor: { select: { businessName: true, email: true } },
      },
    })

    // Publish to Outbox
    await this.queueService.publishEvent('RETURN_REQUESTED', ret.id, {
      returnNumber: ret.returnNumber,
      orderNumber: ret.order.orderNumber,
      reason: ret.reason,
      customerId: ret.customerId,
      vendorId: ret.vendorId,
    })

    return ret
  }

  async listReturns(filters?: {
    status?: ReturnStatus
    vendorId?: string
    search?: string
    page?: number
    limit?: number
  }) {
    const where: any = {}
    if (filters?.status) where.status = filters.status
    if (filters?.vendorId) where.vendorId = filters.vendorId
    if (filters?.search) {
      where.OR = [
        { returnNumber: { contains: filters.search, mode: 'insensitive' } },
        { order: { orderNumber: { contains: filters.search, mode: 'insensitive' } } },
        { customer: { email: { contains: filters.search, mode: 'insensitive' } } },
      ]
    }

    const page = Math.max(Number(filters?.page) || 1, 1)
    const limit = Math.min(Math.max(Number(filters?.limit) || 20, 1), 100)
    const skip = (page - 1) * limit

    const [returns, total] = await Promise.all([
      this.prisma.returnRequest.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          order: { select: { id: true, orderNumber: true, totalAmount: true } },
          customer: { select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true } },
          vendor: { select: { id: true, businessName: true, email: true } },
        },
      }),
      this.prisma.returnRequest.count({ where }),
    ])

    return {
      returns,
      total,
      page,
      limit,
    }
  }

  async getReturnStats() {
    const [requested, approved, received, refunded, rejected] = await Promise.all([
      this.prisma.returnRequest.count({ where: { status: ReturnStatus.REQUESTED } }),
      this.prisma.returnRequest.count({ where: { status: ReturnStatus.APPROVED } }),
      this.prisma.returnRequest.count({ where: { status: ReturnStatus.ITEM_RECEIVED } }),
      this.prisma.returnRequest.count({ where: { status: ReturnStatus.REFUNDED } }),
      this.prisma.returnRequest.count({ where: { status: ReturnStatus.REJECTED } }),
    ])

    return {
      requested,
      approved,
      received,
      refunded,
      rejected,
      total: requested + approved + received + refunded + rejected,
    }
  }

  async getReturnById(id: string) {
    const ret = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            items: true,
            user: true,
          },
        },
        customer: true,
        vendor: true,
      },
    })
    if (!ret) throw new NotFoundException(`Return request ${id} not found`)
    return ret
  }

  async updateReturnStatus(id: string, dto: UpdateReturnStatusDto) {
    const existing = await this.prisma.returnRequest.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Return ${id} not found`)

    const updated = await this.prisma.returnRequest.update({
      where: { id },
      data: {
        status: dto.status,
        pickupCourier: dto.pickupCourier?.trim() || existing.pickupCourier,
        pickupAwb: dto.pickupAwb?.trim().toUpperCase() || existing.pickupAwb,
      },
    })

    await this.queueService.publishEvent('RETURN_STATUS_UPDATED', updated.id, {
      returnNumber: updated.returnNumber,
      status: updated.status,
      pickupAwb: updated.pickupAwb,
    })

    return updated
  }

  async inspectItem(id: string, dto: InspectReturnDto) {
    const existing = await this.prisma.returnRequest.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Return ${id} not found`)

    const updated = await this.prisma.returnRequest.update({
      where: { id },
      data: {
        inspectionNotes: dto.inspectionNotes.trim(),
        isRestocked: dto.isRestocked,
        status: dto.isRestocked ? ReturnStatus.INSPECTED_RESTOCKED : ReturnStatus.ITEM_RECEIVED,
      },
    })

    this.logger.log(`Return ${id} inspected. Restocked: ${dto.isRestocked}`)
    return updated
  }

  async processRefund(id: string, dto: ProcessRefundDto) {
    if (!dto.refundAmount || dto.refundAmount <= 0) {
      throw new BadRequestException('Refund amount must be greater than zero')
    }
    if (!dto.refundRef || !dto.refundRef.trim()) {
      throw new BadRequestException('Refund payment reference / UTR is required')
    }

    const ret = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: { vendor: true },
    })
    if (!ret) throw new NotFoundException(`Return ${id} not found`)

    // Vendor deduction if the vendor supplied a defective/wrong item
    const vendorDeduction = dto.isVendorResponsible ? dto.refundAmount : 0

    const updated = await this.prisma.returnRequest.update({
      where: { id },
      data: {
        status: ReturnStatus.REFUNDED,
        refundAmount: dto.refundAmount,
        refundRef: dto.refundRef.trim(),
        refundDate: new Date(),
        vendorDeduction,
      },
    })

    // Emit event in transactional outbox
    await this.queueService.publishEvent('REFUND_PROCESSED', updated.id, {
      returnNumber: updated.returnNumber,
      orderId: updated.orderId,
      refundAmount: dto.refundAmount,
      refundRef: dto.refundRef,
      vendorDeduction,
    })

    return {
      success: true,
      message: `Refund of ₹${dto.refundAmount.toFixed(2)} processed with reference ${dto.refundRef}`,
      returnRequest: updated,
    }
  }

  /**
   * Warranty Claims Workflows
   */
  async createWarrantyClaim(dto: CreateWarrantyClaimDto) {
    const claimNumber = `WAR-${Date.now().toString().slice(-6)}`
    return this.prisma.warrantyClaim.create({
      data: {
        claimNumber,
        productId: dto.productId,
        orderId: dto.orderId,
        customerId: dto.customerId,
        serialNumber: dto.serialNumber?.trim() || null,
        issueDescription: dto.issueDescription.trim(),
        evidenceFiles: dto.evidenceFiles || [],
        status: WarrantyStatus.PENDING,
      },
      include: {
        customer: { select: { firstName: true, lastName: true, email: true, phoneNumber: true } },
      },
    })
  }

  async listWarrantyClaims(filters?: { status?: WarrantyStatus; search?: string; page?: number; limit?: number }) {
    const where: any = {}
    if (filters?.status) where.status = filters.status
    if (filters?.search) {
      where.OR = [
        { claimNumber: { contains: filters.search, mode: 'insensitive' } },
        { customer: { email: { contains: filters.search, mode: 'insensitive' } } },
        { serialNumber: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    const page = Math.max(Number(filters?.page) || 1, 1)
    const limit = Math.min(Math.max(Number(filters?.limit) || 20, 1), 100)
    const skip = (page - 1) * limit

    const [claims, total] = await Promise.all([
      this.prisma.warrantyClaim.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true } },
        },
      }),
      this.prisma.warrantyClaim.count({ where }),
    ])

    return {
      claims,
      total,
      page,
      limit,
    }
  }

  async resolveWarrantyClaim(id: string, dto: ResolveWarrantyClaimDto) {
    const claim = await this.prisma.warrantyClaim.findUnique({ where: { id } })
    if (!claim) throw new NotFoundException(`Warranty claim ${id} not found`)

    return this.prisma.warrantyClaim.update({
      where: { id },
      data: {
        status: dto.status,
        resolutionNotes: dto.resolutionNotes.trim(),
        resolvedAt: new Date(),
      },
    })
  }
}
