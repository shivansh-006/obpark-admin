import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SettleShipmentDto {
  settlementRef: string;
  notes?: string;
}

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(private prisma: PrismaService) {}

  async getPayoutSummary(filters?: { startDate?: string; endDate?: string }) {
    const where: any = {};
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    const [vendors, shipmentAggs, fulfilledAggs] = await Promise.all([
      this.prisma.vendor.findMany({
        orderBy: { businessName: 'asc' },
        select: {
          id: true,
          businessName: true,
          contactPerson: true,
          email: true,
          phone: true,
          commissionRate: true,
          bankAccountNo: true,
          bankIfsc: true,
          bankName: true,
          upiId: true,
          isActive: true,
        },
      }),
      // Aggregate totals grouped by vendorId and payoutStatus directly in PostgreSQL
      this.prisma.vendorShipment.groupBy({
        by: ['vendorId', 'payoutStatus'],
        where,
        _sum: { subtotal: true },
        _count: { id: true },
      }),
      // Count fulfilled shipments per vendor in DB
      this.prisma.vendorShipment.groupBy({
        by: ['vendorId'],
        where: {
          ...where,
          status: { in: ['DISPATCHED', 'DELIVERED'] },
        },
        _count: { id: true },
      }),
    ]);

    // Initialize vendor summary map
    const vendorMap = new Map<string, any>();
    for (const v of vendors) {
      vendorMap.set(v.id, {
        vendorId: v.id,
        businessName: v.businessName,
        contactPerson: v.contactPerson,
        email: v.email,
        phone: v.phone,
        commissionRate: Number(v.commissionRate),
        bankAccountNo: v.bankAccountNo,
        bankIfsc: v.bankIfsc,
        bankName: v.bankName,
        upiId: v.upiId,
        isActive: v.isActive,
        totalShipments: 0,
        fulfilledShipments: 0,
        grossSales: 0,
        platformFee: 0,
        netPayable: 0,
        pendingAmount: 0,
        eligibleAmount: 0,
        settledAmount: 0,
      });
    }

    const fulfilledMap = new Map<string, number>();
    for (const f of fulfilledAggs) {
      fulfilledMap.set(f.vendorId, f._count.id);
    }

    for (const agg of shipmentAggs) {
      const entry = vendorMap.get(agg.vendorId);
      if (!entry) continue;

      const subtotal = Number(agg._sum?.subtotal || 0);
      const commission = Number(
        ((subtotal * entry.commissionRate) / 100).toFixed(2),
      );
      const net = Number((subtotal - commission).toFixed(2));

      entry.totalShipments += agg._count.id;
      entry.grossSales = Number((entry.grossSales + subtotal).toFixed(2));
      entry.platformFee = Number((entry.platformFee + commission).toFixed(2));
      entry.netPayable = Number((entry.netPayable + net).toFixed(2));

      if (agg.payoutStatus === 'SETTLED') {
        entry.settledAmount = Number((entry.settledAmount + net).toFixed(2));
      } else if (agg.payoutStatus === 'ELIGIBLE') {
        entry.eligibleAmount = Number((entry.eligibleAmount + net).toFixed(2));
      } else {
        entry.pendingAmount = Number((entry.pendingAmount + net).toFixed(2));
      }
    }

    for (const [vendorId, count] of fulfilledMap.entries()) {
      const entry = vendorMap.get(vendorId);
      if (entry) entry.fulfilledShipments = count;
    }

    const ledger = Array.from(vendorMap.values());

    // Overall KPI Totals
    const totalGrossSales = ledger.reduce((acc, v) => acc + v.grossSales, 0);
    const totalPlatformFee = ledger.reduce((acc, v) => acc + v.platformFee, 0);
    const totalNetPayable = ledger.reduce((acc, v) => acc + v.netPayable, 0);
    const totalSettledAmount = ledger.reduce(
      (acc, v) => acc + v.settledAmount,
      0,
    );
    const totalEligibleAmount = ledger.reduce(
      (acc, v) => acc + v.eligibleAmount,
      0,
    );
    const totalPendingAmount = ledger.reduce(
      (acc, v) => acc + v.pendingAmount,
      0,
    );

    return {
      kpis: {
        totalGrossSales: Number(totalGrossSales.toFixed(2)),
        totalPlatformFee: Number(totalPlatformFee.toFixed(2)),
        totalNetPayable: Number(totalNetPayable.toFixed(2)),
        totalSettledAmount: Number(totalSettledAmount.toFixed(2)),
        totalEligibleAmount: Number(totalEligibleAmount.toFixed(2)),
        totalPendingAmount: Number(totalPendingAmount.toFixed(2)),
        activeVendorsCount: vendors.filter((v) => v.isActive).length,
      },
      ledger,
    };
  }

  async getVendorLedgerDetails(vendorId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
    });
    if (!vendor) {
      throw new NotFoundException(`Vendor with ID ${vendorId} not found`);
    }

    const shipments = await this.prisma.vendorShipment.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: {
            orderNumber: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    const commissionRate = Number(vendor.commissionRate);
    const items = shipments.map((s) => {
      const gross = Number(s.subtotal);
      const fee = Number(((gross * commissionRate) / 100).toFixed(2));
      const net = Number((gross - fee).toFixed(2));

      return {
        id: s.id,
        orderId: s.orderId,
        orderNumber: s.order?.orderNumber || '—',
        orderStatus: s.order?.status,
        shipmentStatus: s.status,
        payoutStatus: s.payoutStatus,
        grossSales: gross,
        commissionRate,
        platformFee: fee,
        netPayable: net,
        courierName: s.courierName,
        trackingNumber: s.trackingNumber,
        settlementRef: s.settlementRef,
        settlementDate: s.settlementDate,
        dispatchedAt: s.dispatchedAt,
        deliveredAt: s.deliveredAt,
        createdAt: s.createdAt,
      };
    });

    return {
      vendor: {
        ...vendor,
        commissionRate,
      },
      shipments: items,
    };
  }

  async settleShipment(shipmentId: string, dto: SettleShipmentDto) {
    if (!dto.settlementRef || !dto.settlementRef.trim()) {
      throw new BadRequestException(
        'Settlement transaction reference / UTR is required',
      );
    }

    const shipment = await this.prisma.vendorShipment.findUnique({
      where: { id: shipmentId },
      include: { vendor: true },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment with ID ${shipmentId} not found`);
    }

    if (shipment.payoutStatus !== 'ELIGIBLE') {
      throw new BadRequestException(
        `Shipment ${shipmentId} is currently ${shipment.payoutStatus}. Only ELIGIBLE (delivered) shipments can be marked as settled.`,
      );
    }

    const updated = await this.prisma.vendorShipment.update({
      where: { id: shipmentId },
      data: {
        payoutStatus: 'SETTLED',
        settlementRef: dto.settlementRef.trim(),
        settlementDate: new Date(),
      },
    });

    this.logger.log(
      `Shipment ${shipmentId} settled for Vendor ${shipment.vendor.businessName} with Ref: ${dto.settlementRef.trim()}`,
    );

    return {
      success: true,
      message: `Payout successfully marked as SETTLED for shipment ${shipmentId}`,
      shipment: updated,
    };
  }
}
