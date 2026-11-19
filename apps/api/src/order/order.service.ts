import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { MailService } from '../mail/mail.service'
import { OrderStatus } from '@prisma/client'

const COMPLETED_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
]

const CANCELED_STATUSES: OrderStatus[] = [
  OrderStatus.CANCELLED,
  OrderStatus.REFUNDED,
]

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name)

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  async listOrders(limit = 10, offset = 0) {
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        take: Number(limit),
        skip: Number(offset),
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          items: { select: { productName: true, quantity: true, unitPrice: true, totalPrice: true } },
          payments: { select: { status: true, amount: true, gateway: true } },
        },
      }),
      this.prisma.order.count(),
    ])

    const mapped = orders.map((o) => {
      const customerName = o.user
        ? `${o.user.firstName || ''} ${o.user.lastName || ''}`.trim() || o.user.email
        : 'Customer'

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        customerName,
        email: o.user?.email,
        subtotal: Number(o.subtotal),
        discount: Number(o.discount),
        tax: Number(o.tax),
        shippingCharge: Number(o.shippingCharge),
        totalAmount: Number(o.totalAmount),
        total: Number(o.totalAmount), // alias
        status: o.status,
        shippingAddress: o.shippingAddress,
        items: o.items,
        paymentStatus: o.payments[0]?.status || 'PENDING',
        payment: o.payments[0] ? { status: o.payments[0].status } : null,
        createdAt: o.createdAt,
      }
    })

    return { orders: mapped, total }
  }

  async getOrderCounts() {
    const since = new Date()
    since.setDate(since.getDate() - 7)

    const [newOrders, completed, canceled] = await Promise.all([
      this.prisma.order.count({ where: { createdAt: { gte: since } } }),
      this.prisma.order.count({ where: { status: { in: COMPLETED_STATUSES } } }),
      this.prisma.order.count({ where: { status: { in: CANCELED_STATUSES } } }),
    ])

    return { newOrders, completed, canceled }
  }

  async updateStatus(orderId: string, status: OrderStatus | string) {
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: status as OrderStatus },
    })

    if (status === OrderStatus.CONFIRMED || status === 'CONFIRMED') {
      this.processOrderFulfillment(orderId).catch((err) => {
        this.logger.error(`Error processing vendor fulfillment for order ${orderId}: ${err.message}`, err.stack)
      })
    }

    return updated
  }

  /**
   * Decomposes order items by vendorId, creates isolated VendorShipments,
   * and triggers automated Hostinger SMTP emails with single-use magic links.
   */
  async processOrderFulfillment(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        user: true,
        shipments: true,
      },
    })
    if (!order) return

    // Idempotency: skip if shipments have already been partitioned
    if (order.shipments && order.shipments.length > 0) {
      return
    }

    // Resolve products and their assigned vendors
    const productIds = order.items.map((i) => i.productId)
    const products = await this.prisma.product.findMany({
      where: {
        OR: [{ id: { in: productIds } }, { productId: { in: productIds } }],
      },
      include: { vendor: true },
    })

    const productVendorMap = new Map<string, any>()
    for (const p of products) {
      productVendorMap.set(p.id, p)
      productVendorMap.set(p.productId, p)
    }

    const vendorItemsMap = new Map<string, any[]>()
    for (const item of order.items) {
      const prod = productVendorMap.get(item.productId)
      const vendorId = prod?.vendorId || 'obpark-internal'
      if (!vendorItemsMap.has(vendorId)) {
        vendorItemsMap.set(vendorId, [])
      }
      vendorItemsMap.get(vendorId)!.push({
        productId: item.productId,
        name: item.productName,
        sku: prod?.productId || 'OB-SKU',
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
      })
    }

    // Parse shipping address
    const rawAddress: any = order.shippingAddress || {}
    const customer = {
      name: `${order.user?.firstName || ''} ${order.user?.lastName || ''}`.trim() || order.user?.email || 'Valued Customer',
      phone: rawAddress.phone || rawAddress.phoneNumber || order.user?.phoneNumber || '—',
      streetAddress: rawAddress.streetAddress || rawAddress.address || 'Address on file',
      city: rawAddress.city || '—',
      state: rawAddress.state || '—',
      postalCode: rawAddress.zipCode || rawAddress.postalCode || '—',
    }

    // Partition and create shipments per vendor
    for (const [vendorId, items] of vendorItemsMap.entries()) {
      if (vendorId === 'obpark-internal') {
        // Internal product handled directly by central operations
        continue
      }

      const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } })
      if (!vendor || !vendor.isActive) continue

      const subtotal = items.reduce((sum, it) => sum + it.totalPrice, 0)
      const shipment = await this.prisma.vendorShipment.create({
        data: {
          orderId: order.id,
          vendorId: vendor.id,
          items: items,
          subtotal: subtotal,
          status: 'PENDING',
        },
      })

      this.logger.log(`Created VendorShipment ${shipment.id} for Vendor ${vendor.businessName} on Order ${order.orderNumber}`)

      // Fire outbound HTML packing slip email via Hostinger SMTP
      await this.mailService.sendVendorDispatchAlert({
        vendorEmail: vendor.email,
        vendorName: vendor.businessName,
        orderNumber: order.orderNumber,
        shipmentId: shipment.id,
        dispatchToken: shipment.dispatchToken,
        subtotal: subtotal,
        items: items,
        customer,
      }).catch((err) => {
        this.logger.error(`Failed to send dispatch email to ${vendor.email}: ${err.message}`)
      })
    }
  }
}
