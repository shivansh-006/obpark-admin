import { ReturnsService } from './returns.service'
import { NotFoundException, BadRequestException } from '@nestjs/common'
import { ReturnReason, ReturnStatus } from '@prisma/client'

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

describe('ReturnsService', () => {
  let service: ReturnsService
  let prisma: any
  let queueService: any

  beforeEach(() => {
    prisma = {
      order: {
        findUnique: createMockFn(),
      },
      product: {
        findFirst: createMockFn(),
      },
      returnRequest: {
        create: createMockFn(),
        findUnique: createMockFn(),
        findMany: createMockFn(),
        count: createMockFn(),
        update: createMockFn(),
      },
      vendorShipment: {
        findFirst: createMockFn(),
        update: createMockFn(),
      },
      warrantyClaim: {
        create: createMockFn(),
        findUnique: createMockFn(),
        findMany: createMockFn(),
        count: createMockFn(),
        update: createMockFn(),
      },
    }

    queueService = {
      publishEvent: createMockFn().mockResolvedValue({ id: 'outbox-1' }),
    }

    service = new ReturnsService(prisma, queueService)
  })

  describe('createReturnRequest', () => {
    it('should throw NotFoundException if order does not exist', async () => {
      prisma.order.findUnique.mockResolvedValue(null)

      await expect(
        service.createReturnRequest({
          orderId: 'non-existent-order',
          orderItemId: 'item-1',
          customerId: 'cust-1',
          reason: ReturnReason.DEFECTIVE,
          description: 'Screen does not power on',
        }),
      ).rejects.toThrow(NotFoundException)
    })

    it('should throw BadRequestException if order item is not found in the order', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        items: [{ id: 'item-999', productId: 'prod-999' }],
      })

      await expect(
        service.createReturnRequest({
          orderId: 'ord-1',
          orderItemId: 'item-different',
          customerId: 'cust-1',
          reason: ReturnReason.DEFECTIVE,
          description: 'Faulty unit',
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('should successfully create return request and emit RETURN_REQUESTED outbox event', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-1',
        items: [{ id: 'item-1', productId: 'prod-10' }],
      })
      prisma.product.findFirst.mockResolvedValue({
        vendorId: 'vendor-42',
      })
      prisma.returnRequest.create.mockResolvedValue({
        id: 'ret-123',
        returnNumber: 'RET-000123',
        orderId: 'ord-1',
        order: { orderNumber: 'OB-9999' },
        vendorId: 'vendor-42',
        reason: ReturnReason.DEFECTIVE,
      })

      const result = await service.createReturnRequest({
        orderId: 'ord-1',
        orderItemId: 'item-1',
        customerId: 'cust-1',
        reason: ReturnReason.DEFECTIVE,
        description: 'Blown capacitor on arrival',
      })

      expect(result.id).toBe('ret-123')
      expect(prisma.returnRequest.create.mock.calls.length).toBe(1)
      expect(queueService.publishEvent.mock.calls.length).toBe(1)
      expect(queueService.publishEvent.mock.calls[0][0]).toBe('RETURN_REQUESTED')
    })
  })

  describe('inspectItem', () => {
    it('should update inspection notes and restocking flag', async () => {
      prisma.returnRequest.findUnique.mockResolvedValue({
        id: 'ret-1',
        status: ReturnStatus.ITEM_RECEIVED,
      })
      prisma.returnRequest.update.mockResolvedValue({
        id: 'ret-1',
        status: ReturnStatus.INSPECTED_RESTOCKED,
        inspectionNotes: 'No physical damage, restored to inventory',
        isRestocked: true,
      })

      const result = await service.inspectItem('ret-1', {
        inspectionNotes: 'No physical damage, restored to inventory',
        isRestocked: true,
      })

      expect(result.status).toBe(ReturnStatus.INSPECTED_RESTOCKED)
      expect(prisma.returnRequest.update.mock.calls.length).toBe(1)
    })
  })

  describe('processRefund', () => {
    it('should process refund, deduct from vendor if responsible, and emit REFUND_PROCESSED event', async () => {
      prisma.returnRequest.findUnique.mockResolvedValue({
        id: 'ret-1',
        returnNumber: 'RET-001',
        orderId: 'ord-1',
        customerId: 'cust-1',
        vendorId: 'vendor-1',
        status: ReturnStatus.INSPECTED_RESTOCKED,
      })
      prisma.vendorShipment.findFirst.mockResolvedValue({
        id: 'ship-1',
        vendorPayoutAmount: 5000,
      })
      prisma.vendorShipment.update.mockResolvedValue({
        id: 'ship-1',
        vendorPayoutAmount: 3500,
      })
      prisma.returnRequest.update.mockResolvedValue({
        id: 'ret-1',
        status: ReturnStatus.REFUNDED,
        refundAmount: 1500,
        refundRef: 'REF-BANK-778899',
        vendorDeduction: 1500,
      })

      const result = await service.processRefund('ret-1', {
        refundAmount: 1500,
        refundRef: 'REF-BANK-778899',
        isVendorResponsible: true,
      })

      expect(result.returnRequest.status).toBe(ReturnStatus.REFUNDED)
      expect(result.returnRequest.vendorDeduction).toBe(1500)
      expect(queueService.publishEvent.mock.calls.length).toBe(1)
      expect(queueService.publishEvent.mock.calls[0][0]).toBe('REFUND_PROCESSED')
    })
  })
})
