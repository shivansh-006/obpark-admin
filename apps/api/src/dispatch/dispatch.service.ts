import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

export interface ConfirmDispatchDto {
  courierName: string;
  trackingNumber: string;
  courierWebsite?: string;
}

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  async getShipmentByToken(token: string) {
    if (!token || token.trim().length === 0) {
      throw new BadRequestException('Dispatch token is required');
    }

    const shipment = await this.prisma.vendorShipment.findUnique({
      where: { dispatchToken: token },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            shippingAddress: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                phoneNumber: true,
              },
            },
          },
        },
        vendor: {
          select: {
            id: true,
            businessName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException('Invalid or expired dispatch link');
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

    return {
      shipmentId: shipment.id,
      orderNumber: shipment.order.orderNumber,
      vendorName: shipment.vendor.businessName,
      status: shipment.status,
      items: shipment.items,
      subtotal: Number(shipment.subtotal),
      customer,
      courierName: shipment.courierName,
      trackingNumber: shipment.trackingNumber,
      dispatchedAt: shipment.dispatchedAt,
      isDispatched:
        shipment.status === 'DISPATCHED' || shipment.status === 'DELIVERED',
    };
  }

  async confirmDispatch(token: string, dto: ConfirmDispatchDto) {
    if (!dto.courierName || !dto.courierName.trim()) {
      throw new BadRequestException('Courier partner name is required');
    }
    if (!dto.trackingNumber || !dto.trackingNumber.trim()) {
      throw new BadRequestException('AWB / Tracking number is required');
    }

    const shipment = await this.prisma.vendorShipment.findUnique({
      where: { dispatchToken: token },
      include: {
        order: {
          include: {
            user: true,
            shipments: true,
          },
        },
        vendor: true,
      },
    });

    if (!shipment) {
      throw new NotFoundException('Invalid or expired dispatch link');
    }

    if (shipment.status === 'DISPATCHED' || shipment.status === 'DELIVERED') {
      throw new ConflictException(
        'This shipment has already been confirmed and dispatched',
      );
    }

    const cleanCourier = dto.courierName.trim();
    const cleanTracking = dto.trackingNumber.trim().toUpperCase();

    // 1. Mark this vendor shipment as DISPATCHED
    const updatedShipment = await this.prisma.vendorShipment.update({
      where: { id: shipment.id },
      data: {
        status: 'DISPATCHED',
        courierName: cleanCourier,
        trackingNumber: cleanTracking,
        courierWebsite: dto.courierWebsite?.trim() || null,
        dispatchedAt: new Date(),
      },
    });

    // 2. Evaluate sibling shipments to update parent order status
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

    this.logger.log(
      `Shipment ${shipment.id} marked DISPATCHED via ${cleanCourier} (${cleanTracking}). Parent order ${shipment.order.orderNumber} is now ${parentStatus}.`,
    );

    // 3. Notify customer of their tracking details
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
          courierWebsite: dto.courierWebsite,
          items: itemsArr,
        })
        .catch((err) => {
          this.logger.error(
            `Failed to send tracking update to customer: ${err.message}`,
          );
        });
    }

    return {
      success: true,
      message:
        'Shipment dispatch recorded successfully. Customer has been notified.',
      shipmentId: updatedShipment.id,
      status: updatedShipment.status,
      courierName: updatedShipment.courierName,
      trackingNumber: updatedShipment.trackingNumber,
      dispatchedAt: updatedShipment.dispatchedAt,
    };
  }
}
