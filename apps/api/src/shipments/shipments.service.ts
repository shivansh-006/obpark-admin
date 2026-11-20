import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class ShipmentsService {
  private readonly logger = new Logger(ShipmentsService.name);

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  async listShipments(filters: {
    status?: string;
    vendorId?: string;
    payoutStatus?: string;
    limit?: number;
    page?: number;
  }) {
    const where: any = {};
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.vendorId) {
      where.vendorId = filters.vendorId;
    }
    if (filters.payoutStatus) {
      where.payoutStatus = filters.payoutStatus;
    }

    const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
    const page = Math.max(Number(filters.page) || 1, 1);
    const skip = (page - 1) * limit;

    const [shipments, total] = await Promise.all([
      this.prisma.vendorShipment.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          vendor: {
            select: {
              id: true,
              businessName: true,
              contactPerson: true,
              email: true,
              phone: true,
              commissionRate: true,
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              totalAmount: true,
              shippingAddress: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.vendorShipment.count({ where }),
    ]);

    const mapped = shipments.map((s) => {
      const gross = Number(s.subtotal);
      const commissionRate = Number(s.vendor?.commissionRate || 10);
      const platformFee = Number(((gross * commissionRate) / 100).toFixed(2));
      const netPayable = Number((gross - platformFee).toFixed(2));

      return {
        id: s.id,
        orderId: s.orderId,
        orderNumber: s.order?.orderNumber || '—',
        vendorId: s.vendorId,
        vendorName: s.vendor?.businessName || 'Vendor',
        vendorEmail: s.vendor?.email || '—',
        status: s.status,
        courierName: s.courierName,
        trackingNumber: s.trackingNumber,
        items: s.items,
        grossSales: gross,
        commissionRate,
        platformFee,
        netPayable,
        payoutStatus: s.payoutStatus,
        settlementRef: s.settlementRef,
        settlementDate: s.settlementDate,
        dispatchedAt: s.dispatchedAt,
        deliveredAt: s.deliveredAt,
        createdAt: s.createdAt,
        dispatchUrl: `${(process.env.ADMIN_FRONTEND_URL || 'https://admin.obpark.in').replace(/\/$/, '')}/dispatch/${s.dispatchToken}`,
      };
    });

    return {
      shipments: mapped,
      total,
      page,
      limit,
    };
  }

  async overrideDispatch(
    id: string,
    dto: {
      courierName: string;
      trackingNumber: string;
      courierWebsite?: string;
    },
  ) {
    const shipment = await this.prisma.vendorShipment.findUnique({
      where: { id },
      include: { order: { include: { user: true } } },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment ${id} not found`);
    }

    const cleanCourier = dto.courierName.trim();
    const cleanTracking = dto.trackingNumber.trim().toUpperCase();

    const updated = await this.prisma.vendorShipment.update({
      where: { id },
      data: {
        status: 'DISPATCHED',
        courierName: cleanCourier,
        trackingNumber: cleanTracking,
        courierWebsite: dto.courierWebsite?.trim() || null,
        dispatchedAt: new Date(),
      },
    });

    // Check sibling shipments to adjust parent order status
    const remainingPending = await this.prisma.vendorShipment.count({
      where: {
        orderId: shipment.orderId,
        status: { in: ['PENDING', 'READY_FOR_PICKUP'] },
      },
    });

    const parentStatus =
      remainingPending === 0 ? 'SHIPPED' : 'PARTIALLY_SHIPPED';
    await this.prisma.order.update({
      where: { id: shipment.orderId },
      data: { status: parentStatus as any },
    });

    // Trigger customer notification
    if (shipment.order.user?.email) {
      const itemsArr = Array.isArray(shipment.items)
        ? (shipment.items as any[]).map((it) => ({
            name: it.name,
            quantity: it.quantity,
          }))
        : [];

      const customerName =
        `${shipment.order.user.firstName || ''} ${shipment.order.user.lastName || ''}`.trim() ||
        'Customer';

      this.mailService
        .sendCustomerTrackingAlert({
          customerEmail: shipment.order.user.email,
          customerName,
          orderNumber: shipment.order.orderNumber,
          courierName: cleanCourier,
          trackingNumber: cleanTracking,
          items: itemsArr,
        })
        .catch((err) => {
          this.logger.error(`Error notifying customer: ${err.message}`);
        });
    }

    return {
      success: true,
      message: 'Shipment dispatched manually by Admin.',
      shipment: updated,
    };
  }

  async markDelivered(id: string) {
    const shipment = await this.prisma.vendorShipment.findUnique({
      where: { id },
    });
    if (!shipment) {
      throw new NotFoundException(`Shipment ${id} not found`);
    }

    // Mark as DELIVERED and transition payoutStatus to ELIGIBLE
    const updated = await this.prisma.vendorShipment.update({
      where: { id },
      data: {
        status: 'DELIVERED',
        deliveredAt: new Date(),
        payoutStatus: 'ELIGIBLE', // Eligible for financial settlement!
      },
    });

    // If all shipments for this order are delivered, set parent order to DELIVERED
    const remainingUndelivered = await this.prisma.vendorShipment.count({
      where: {
        orderId: shipment.orderId,
        status: { not: 'DELIVERED' },
      },
    });

    if (remainingUndelivered === 0) {
      await this.prisma.order.update({
        where: { id: shipment.orderId },
        data: { status: 'DELIVERED' },
      });
    }

    return {
      success: true,
      message:
        'Shipment marked as DELIVERED. Vendor payout status transitioned to ELIGIBLE.',
      shipment: updated,
    };
  }

  async resendDispatchEmail(id: string) {
    const shipment = await this.prisma.vendorShipment.findUnique({
      where: { id },
      include: {
        vendor: true,
        order: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment ${id} not found`);
    }

    const rawAddress: any = shipment.order.shippingAddress || {};
    const customer = {
      name:
        `${shipment.order.user?.firstName || ''} ${shipment.order.user?.lastName || ''}`.trim() ||
        shipment.order.user?.email ||
        'Valued Customer',
      phone:
        rawAddress.phone ||
        rawAddress.phoneNumber ||
        shipment.order.user?.phoneNumber ||
        '—',
      streetAddress:
        rawAddress.streetAddress || rawAddress.address || 'Address on file',
      city: rawAddress.city || '—',
      state: rawAddress.state || '—',
      postalCode: rawAddress.zipCode || rawAddress.postalCode || '—',
    };

    const items = Array.isArray(shipment.items)
      ? (shipment.items as any[])
      : [];

    const sent = await this.mailService.sendVendorDispatchAlert({
      vendorEmail: shipment.vendor.email,
      vendorName: shipment.vendor.businessName,
      orderNumber: shipment.order.orderNumber,
      shipmentId: shipment.id,
      dispatchToken: shipment.dispatchToken,
      subtotal: Number(shipment.subtotal),
      items,
      customer,
    });

    return {
      success: sent,
      message: sent
        ? `Dispatch email resent to ${shipment.vendor.email}`
        : `Failed to resend dispatch email to ${shipment.vendor.email}`,
    };
  }
}
