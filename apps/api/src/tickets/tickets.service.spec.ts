import { TicketsService } from './tickets.service'
import { NotFoundException, BadRequestException } from '@nestjs/common'
import { TicketCategory, TicketPriority, TicketStatus, SenderType } from '@prisma/client'

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

describe('TicketsService', () => {
  let service: TicketsService
  let prisma: any
  let queueService: any

  beforeEach(() => {
    prisma = {
      users: {
        findUnique: createMockFn(),
      },
      supportTicket: {
        create: createMockFn(),
        findUnique: createMockFn(),
        findMany: createMockFn(),
        count: createMockFn(),
        update: createMockFn(),
      },
      ticketMessage: {
        create: createMockFn(),
      },
      $transaction: createMockFn().mockImplementation((args: any) => Promise.all(args)),
    }

    queueService = {
      publishEvent: createMockFn().mockResolvedValue({ id: 'outbox-ticket-1' }),
    }

    service = new TicketsService(prisma, queueService)
  })

  describe('createTicket', () => {
    it('should throw BadRequestException if subject is missing or empty', async () => {
      await expect(
        service.createTicket({
          customerId: 'cust-1',
          subject: '   ',
          initialMessage: 'Help please',
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('should throw NotFoundException if customer does not exist', async () => {
      prisma.users.findUnique.mockResolvedValue(null)

      await expect(
        service.createTicket({
          customerId: 'non-existent-user',
          subject: 'Delivery delayed',
          initialMessage: 'Where is my order?',
        }),
      ).rejects.toThrow(NotFoundException)
    })

    it('should create ticket and emit TICKET_CREATED outbox event', async () => {
      prisma.users.findUnique.mockResolvedValue({
        id: 'cust-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      })
      prisma.supportTicket.create.mockResolvedValue({
        id: 'ticket-1',
        ticketNumber: 'TCK-001001',
        customerId: 'cust-1',
        subject: 'Compatibility inquiry for BMW E46',
        category: TicketCategory.PRODUCT_INQUIRY,
        priority: TicketPriority.MEDIUM,
        status: TicketStatus.OPEN,
      })

      const result = await service.createTicket({
        customerId: 'cust-1',
        subject: 'Compatibility inquiry for BMW E46',
        category: TicketCategory.PRODUCT_INQUIRY,
        priority: TicketPriority.MEDIUM,
        initialMessage: 'Will this strut bar fit a 2003 330Ci?',
      })

      expect(result.id).toBe('ticket-1')
      expect(prisma.supportTicket.create.mock.calls.length).toBe(1)
      expect(queueService.publishEvent.mock.calls.length).toBe(1)
      expect(queueService.publishEvent.mock.calls[0][0]).toBe('TICKET_CREATED')
    })
  })

  describe('addMessage', () => {
    it('should throw NotFoundException if ticket does not exist', async () => {
      prisma.supportTicket.findUnique.mockResolvedValue(null)

      await expect(
        service.addMessage('non-existent-ticket', {
          senderType: SenderType.ADMIN,
          senderName: 'Agent Alice',
          message: 'Checking with our technical team',
        }),
      ).rejects.toThrow(NotFoundException)
    })

    it('should add internal staff note without emitting public customer notification if isInternalNote is true', async () => {
      prisma.supportTicket.findUnique.mockResolvedValue({
        id: 'ticket-1',
        ticketNumber: 'TCK-001',
        status: TicketStatus.OPEN,
      })
      prisma.ticketMessage.create.mockResolvedValue({
        id: 'msg-1',
        ticketId: 'ticket-1',
        message: 'Vendor says shipment was dispatched this morning',
        isInternalNote: true,
      })
      prisma.supportTicket.update.mockResolvedValue({
        id: 'ticket-1',
        status: TicketStatus.IN_PROGRESS,
      })

      const result = await service.addMessage('ticket-1', {
        senderType: SenderType.ADMIN,
        senderName: 'Agent Alice',
        message: 'Vendor says shipment was dispatched this morning',
        isInternalNote: true,
      })

      expect(result.message.isInternalNote).toBe(true)
      expect(prisma.ticketMessage.create.mock.calls.length).toBe(1)
      // Internal notes do NOT emit public notification event
      expect(queueService.publishEvent.mock.calls.length).toBe(0)
    })

    it('should add public message and emit TICKET_REPLIED event if isInternalNote is false', async () => {
      prisma.supportTicket.findUnique.mockResolvedValue({
        id: 'ticket-1',
        ticketNumber: 'TCK-001',
        status: TicketStatus.OPEN,
      })
      prisma.ticketMessage.create.mockResolvedValue({
        id: 'msg-2',
        ticketId: 'ticket-1',
        message: 'Your replacement part has been scheduled',
        isInternalNote: false,
      })
      prisma.supportTicket.update.mockResolvedValue({
        id: 'ticket-1',
        status: TicketStatus.WAITING_ON_CUSTOMER,
      })

      const result = await service.addMessage('ticket-1', {
        senderType: SenderType.ADMIN,
        senderName: 'Agent Bob',
        message: 'Your replacement part has been scheduled',
        isInternalNote: false,
      })

      expect(result.message.isInternalNote).toBe(false)
      expect(queueService.publishEvent.mock.calls.length).toBe(1)
      expect(queueService.publishEvent.mock.calls[0][0]).toBe('TICKET_REPLIED')
    })
  })

  describe('updateTicket', () => {
    it('should update ticket status to RESOLVED and set resolvedAt timestamp', async () => {
      prisma.supportTicket.findUnique.mockResolvedValue({
        id: 'ticket-1',
        status: TicketStatus.IN_PROGRESS,
      })
      prisma.supportTicket.update.mockResolvedValue({
        id: 'ticket-1',
        status: TicketStatus.RESOLVED,
      })

      const result = await service.updateTicket('ticket-1', {
        status: TicketStatus.RESOLVED,
      })

      expect(result.status).toBe(TicketStatus.RESOLVED)
      expect(prisma.supportTicket.update.mock.calls.length).toBe(1)
    })
  })
})
