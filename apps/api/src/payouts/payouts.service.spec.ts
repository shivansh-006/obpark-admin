import { PayoutsService } from './payouts.service'
import { NotFoundException, BadRequestException } from '@nestjs/common'

// Support both Jest and Bun test environments
const createMockFn = () => {
  let mockImpl: any = null
  const fn: any = (...args: any[]) => {
    fn.mock.calls.push(args)
    if (fn._mockResolvedValueOnce && fn._mockResolvedValueOnce.length > 0) {
      return Promise.resolve(fn._mockResolvedValueOnce.shift())
    }
    if (fn._mockResolvedValue !== undefined) {
      return Promise.resolve(fn._mockResolvedValue)
    }
    if (mockImpl) return mockImpl(...args)
    return undefined
  }
  fn.mock = { calls: [] }
  fn._mockResolvedValueOnce = []
  fn.mockResolvedValue = (val: any) => {
    fn._mockResolvedValue = val
    return fn
  }
  fn.mockResolvedValueOnce = (val: any) => {
    fn._mockResolvedValueOnce.push(val)
    return fn
  }
  fn.mockImplementation = (impl: any) => {
    mockImpl = impl
    return fn
  }
  return fn
}

describe('PayoutsService', () => {
  let service: PayoutsService
  let prisma: any

  beforeEach(() => {
    prisma = {
      vendor: {
        findMany: createMockFn(),
        findUnique: createMockFn(),
      },
      vendorShipment: {
        findMany: createMockFn(),
        findUnique: createMockFn(),
        update: createMockFn(),
        groupBy: createMockFn(),
      },
    }

    service = new PayoutsService(prisma)
  })

  describe('getPayoutSummary', () => {
    it('should aggregate gross sales, platform fees, and net payable accurately', async () => {
      prisma.vendor.findMany.mockResolvedValue([
        {
          id: 'vendor-1',
          businessName: 'Apex Autocare',
          contactPerson: 'Rahul',
          email: 'rahul@apex.com',
          phone: '9876543210',
          commissionRate: 15,
          isActive: true,
        },
      ])

      prisma.vendorShipment.groupBy
        .mockResolvedValueOnce([
          {
            vendorId: 'vendor-1',
            payoutStatus: 'ELIGIBLE',
            _sum: { subtotal: 1000 },
            _count: { id: 2 },
          },
          {
            vendorId: 'vendor-1',
            payoutStatus: 'SETTLED',
            _sum: { subtotal: 2000 },
            _count: { id: 3 },
          },
        ])
        .mockResolvedValueOnce([
          {
            vendorId: 'vendor-1',
            _count: { id: 5 },
          },
        ])

      const summary = await service.getPayoutSummary()

      expect(summary.ledger).toHaveLength(1)
      const v1 = summary.ledger[0]

      // Gross sales = 1000 + 2000 = 3000
      expect(v1.grossSales).toBe(3000)
      // 15% platform fee of 3000 = 450
      expect(v1.platformFee).toBe(450)
      // Net payable = 3000 - 450 = 2550
      expect(v1.netPayable).toBe(2550)

      // Eligible: 1000 - 150 = 850
      expect(v1.eligibleAmount).toBe(850)
      // Settled: 2000 - 300 = 1700
      expect(v1.settledAmount).toBe(1700)
      // Pending: 0
      expect(v1.pendingAmount).toBe(0)

      // Total KPIs
      expect(summary.kpis.totalGrossSales).toBe(3000)
      expect(summary.kpis.totalPlatformFee).toBe(450)
      expect(summary.kpis.totalNetPayable).toBe(2550)
      expect(summary.kpis.totalSettledAmount).toBe(1700)
      expect(summary.kpis.totalEligibleAmount).toBe(850)
    })
  })

  describe('settleShipment', () => {
    it('should throw BadRequestException if shipment is not ELIGIBLE', async () => {
      prisma.vendorShipment.findUnique.mockResolvedValue({
        id: 'ship-1',
        payoutStatus: 'PENDING',
        status: 'PENDING',
      })

      try {
        await service.settleShipment('ship-1', { settlementRef: 'UTR123' })
        expect(true).toBe(false) // Should not reach here
      } catch (err: any) {
        expect(err instanceof BadRequestException).toBe(true)
      }
    })

    it('should mark shipment as SETTLED with reference and timestamp', async () => {
      prisma.vendorShipment.findUnique.mockResolvedValue({
        id: 'ship-1',
        payoutStatus: 'ELIGIBLE',
        status: 'DELIVERED',
        subtotal: 1000,
        vendor: { commissionRate: 10 },
      })

      prisma.vendorShipment.update.mockResolvedValue({
        id: 'ship-1',
        payoutStatus: 'SETTLED',
        settlementRef: 'UTR998877',
      })

      const res = await service.settleShipment('ship-1', {
        settlementRef: 'UTR998877',
        notes: 'Bank NEFT',
      })

      expect(res.success).toBe(true)
      expect(prisma.vendorShipment.update.mock.calls.length).toBe(1)
      expect(prisma.vendorShipment.update.mock.calls[0][0].data.payoutStatus).toBe('SETTLED')
      expect(prisma.vendorShipment.update.mock.calls[0][0].data.settlementRef).toBe('UTR998877')
    })
  })
})
