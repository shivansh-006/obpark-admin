import { QueueService } from './queue.service'
import { OutboxStatus } from '@prisma/client'
import { NotFoundException } from '@nestjs/common'

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

describe('QueueService', () => {
  let service: QueueService
  let prisma: any

  beforeEach(() => {
    prisma = {
      outboxEvent: {
        create: createMockFn(),
        findMany: createMockFn(),
        findUnique: createMockFn(),
        update: createMockFn(),
        updateMany: createMockFn(),
        delete: createMockFn(),
        count: createMockFn(),
      },
    }

    service = new QueueService(prisma)
  })

  afterEach(() => {
    service.onModuleDestroy()
  })

  describe('publishEvent', () => {
    it('should create an outbox event with status PENDING', async () => {
      prisma.outboxEvent.create.mockResolvedValue({
        id: 'outbox-1',
        eventType: 'ORDER_CONFIRMED',
        aggregateType: 'Order',
        aggregateId: 'ord-123',
        status: OutboxStatus.PENDING,
      })

      const event = await service.publishEvent(
        'ORDER_CONFIRMED',
        'ord-123',
        { customerId: 'cust-1', total: 4500 },
      )

      expect(event.id).toBe('outbox-1')
      expect(prisma.outboxEvent.create.mock.calls.length).toBe(1)
      const callArgs = prisma.outboxEvent.create.mock.calls[0][0]
      expect(callArgs.data.eventType).toBe('ORDER_CONFIRMED')
      expect(callArgs.data.entityId).toBe('ord-123')
      expect(callArgs.data.status).toBe(OutboxStatus.PENDING)
    })
  })

  describe('processOutboxBatch', () => {
    it('should successfully execute registered handlers and mark event COMPLETED', async () => {
      const mockEvent = {
        id: 'evt-1',
        eventType: 'PAYMENT_RECEIVED',
        aggregateType: 'Order',
        aggregateId: 'ord-1',
        payload: { amount: 1500 },
        status: OutboxStatus.PENDING,
        attempts: 0,
        maxAttempts: 5,
      }

      prisma.outboxEvent.findMany.mockResolvedValue([mockEvent])
      prisma.outboxEvent.update.mockResolvedValue({ ...mockEvent, status: OutboxStatus.COMPLETED })

      let handlerCalledWith: any = null
      service.registerHandler('PAYMENT_RECEIVED', async (payload) => {
        handlerCalledWith = payload
      })

      const processedCount = await service.processOutboxBatch(10)

      expect(processedCount).toBe(1)
      expect(handlerCalledWith).toEqual({ amount: 1500 })
      // 1st update to PROCESSING, 2nd update to COMPLETED
      expect(prisma.outboxEvent.update.mock.calls.length).toBe(2)
      expect(prisma.outboxEvent.update.mock.calls[1][0].data.status).toBe(OutboxStatus.COMPLETED)
    })

    it('should retry with backoff on handler failure when attempts < maxAttempts', async () => {
      const mockEvent = {
        id: 'evt-2',
        eventType: 'SEND_EMAIL',
        aggregateType: 'User',
        aggregateId: 'usr-1',
        payload: { email: 'fail@example.com' },
        status: OutboxStatus.PENDING,
        attempts: 1,
        maxAttempts: 5,
      }

      prisma.outboxEvent.findMany.mockResolvedValue([mockEvent])
      prisma.outboxEvent.update.mockResolvedValue(mockEvent)

      service.registerHandler('SEND_EMAIL', async () => {
        throw new Error('SMTP Timeout')
      })

      await service.processOutboxBatch(10)

      // 1st update to PROCESSING, 2nd update to PENDING with attempts=2
      expect(prisma.outboxEvent.update.mock.calls.length).toBe(2)
      const failureUpdate = prisma.outboxEvent.update.mock.calls[1][0].data
      expect(failureUpdate.status).toBe(OutboxStatus.PENDING)
      expect(failureUpdate.attempts).toBe(2)
      expect(failureUpdate.lastError).toBe('SMTP Timeout')
    })

    it('should move event to dead-letter queue (FAILED) when maxAttempts is reached', async () => {
      const mockEvent = {
        id: 'evt-3',
        eventType: 'WEBHOOK_DELIVERY',
        aggregateType: 'Webhook',
        aggregateId: 'wh-1',
        payload: { target: 'https://broken.endpoint.com' },
        status: OutboxStatus.PENDING,
        attempts: 4,
        maxAttempts: 5,
      }

      prisma.outboxEvent.findMany.mockResolvedValue([mockEvent])
      prisma.outboxEvent.update.mockResolvedValue(mockEvent)

      service.registerHandler('WEBHOOK_DELIVERY', async () => {
        throw new Error('500 Internal Server Error')
      })

      await service.processOutboxBatch(10)

      expect(prisma.outboxEvent.update.mock.calls.length).toBe(2)
      const dlqUpdate = prisma.outboxEvent.update.mock.calls[1][0].data
      expect(dlqUpdate.status).toBe(OutboxStatus.FAILED)
      expect(dlqUpdate.attempts).toBe(5)
      expect(dlqUpdate.lastError).toBe('500 Internal Server Error')
    })
  })

  describe('retryJob', () => {
    it('should throw NotFoundException if job does not exist', async () => {
      prisma.outboxEvent.findUnique.mockResolvedValue(null)

      await expect(service.retryJob('missing-job')).rejects.toThrow(NotFoundException)
    })

    it('should reset failed event to PENDING and clear error', async () => {
      prisma.outboxEvent.findUnique.mockResolvedValue({
        id: 'failed-1',
        status: OutboxStatus.FAILED,
      })
      prisma.outboxEvent.update.mockResolvedValue({
        id: 'failed-1',
        status: OutboxStatus.PENDING,
        attempts: 0,
      })

      const result = await service.retryJob('failed-1')

      expect(result.status).toBe(OutboxStatus.PENDING)
      expect(prisma.outboxEvent.update.mock.calls.length).toBe(1)
      const updateData = prisma.outboxEvent.update.mock.calls[0][0].data
      expect(updateData.status).toBe(OutboxStatus.PENDING)
      expect(updateData.attempts).toBe(0)
      expect(updateData.lastError).toBeNull()
    })
  })

  describe('retryAllFailed', () => {
    it('should update all FAILED events back to PENDING', async () => {
      prisma.outboxEvent.updateMany.mockResolvedValue({ count: 7 })

      const result = await service.retryAllFailed()

      expect(result.count).toBe(7)
      expect(prisma.outboxEvent.updateMany.mock.calls.length).toBe(1)
      expect(prisma.outboxEvent.updateMany.mock.calls[0][0].where.status).toBe(OutboxStatus.FAILED)
    })
  })
})
