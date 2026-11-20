import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { QueueService } from '../queue/queue.service'
import {
  TicketCategory,
  TicketPriority,
  TicketStatus,
  SenderType,
} from '@prisma/client'

export interface CreateTicketDto {
  customerId: string
  orderId?: string
  vendorId?: string
  subject: string
  category?: TicketCategory
  priority?: TicketPriority
  initialMessage: string
  attachments?: string[]
}

export interface AddTicketMessageDto {
  senderType: SenderType
  senderId?: string
  senderName: string
  message: string
  attachments?: string[]
  isInternalNote?: boolean
}

export interface UpdateTicketDto {
  status?: TicketStatus
  priority?: TicketPriority
  assignedTo?: string
  assignedToName?: string
  resolvedAt?: Date
  closedAt?: Date
}

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name)

  constructor(
    private prisma: PrismaService,
    private queueService: QueueService,
  ) {}

  async createTicket(dto: CreateTicketDto) {
    if (!dto.subject || !dto.subject.trim()) {
      throw new BadRequestException('Ticket subject is required')
    }
    if (!dto.initialMessage || !dto.initialMessage.trim()) {
      throw new BadRequestException('Initial ticket message is required')
    }

    const customer = await this.prisma.users.findUnique({ where: { id: dto.customerId } })
    if (!customer) throw new NotFoundException(`Customer ${dto.customerId} not found`)

    const ticketNumber = `TCK-${Date.now().toString().slice(-6)}`

    const ticket = await this.prisma.supportTicket.create({
      data: {
        ticketNumber,
        customerId: dto.customerId,
        orderId: dto.orderId || null,
        vendorId: dto.vendorId || null,
        subject: dto.subject.trim(),
        category: dto.category || TicketCategory.ORDER_ISSUE,
        priority: dto.priority || TicketPriority.MEDIUM,
        status: TicketStatus.OPEN,
        messages: {
          create: {
            senderType: SenderType.CUSTOMER,
            senderId: dto.customerId,
            senderName: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email || 'Customer',
            message: dto.initialMessage.trim(),
            attachments: dto.attachments || [],
            isInternalNote: false,
          },
        },
      },
      include: {
        customer: { select: { firstName: true, lastName: true, email: true, phoneNumber: true } },
        order: { select: { orderNumber: true } },
        vendor: { select: { businessName: true } },
        messages: true,
      },
    })

    // Publish event to outbox
    await this.queueService.publishEvent('TICKET_CREATED', ticket.id, {
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      priority: ticket.priority,
      customerId: ticket.customerId,
    })

    return ticket
  }

  async listTickets(filters?: {
    status?: TicketStatus
    priority?: TicketPriority
    category?: TicketCategory
    assignedTo?: string
    search?: string
    page?: number
    limit?: number
  }) {
    const where: any = {}
    if (filters?.status) where.status = filters.status
    if (filters?.priority) where.priority = filters.priority
    if (filters?.category) where.category = filters.category
    if (filters?.assignedTo) where.assignedTo = filters.assignedTo
    if (filters?.search) {
      where.OR = [
        { ticketNumber: { contains: filters.search, mode: 'insensitive' } },
        { subject: { contains: filters.search, mode: 'insensitive' } },
        { customer: { email: { contains: filters.search, mode: 'insensitive' } } },
        { order: { orderNumber: { contains: filters.search, mode: 'insensitive' } } },
      ]
    }

    const page = Math.max(Number(filters?.page) || 1, 1)
    const limit = Math.min(Math.max(Number(filters?.limit) || 20, 1), 100)
    const skip = (page - 1) * limit

    const [tickets, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        take: limit,
        skip,
        orderBy: { updatedAt: 'desc' },
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true } },
          order: { select: { id: true, orderNumber: true } },
          vendor: { select: { id: true, businessName: true } },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.supportTicket.count({ where }),
    ])

    return {
      tickets,
      total,
      page,
      limit,
    }
  }

  async getTicketStats() {
    const [open, inProgress, waiting, resolved, closed] = await Promise.all([
      this.prisma.supportTicket.count({ where: { status: TicketStatus.OPEN } }),
      this.prisma.supportTicket.count({ where: { status: TicketStatus.IN_PROGRESS } }),
      this.prisma.supportTicket.count({ where: { status: TicketStatus.WAITING_ON_CUSTOMER } }),
      this.prisma.supportTicket.count({ where: { status: TicketStatus.RESOLVED } }),
      this.prisma.supportTicket.count({ where: { status: TicketStatus.CLOSED } }),
    ])

    return {
      open,
      inProgress,
      waiting,
      resolved,
      closed,
      total: open + inProgress + waiting + resolved + closed,
    }
  }

  async getTicketById(id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        customer: true,
        order: {
          include: {
            items: true,
            shipments: true,
          },
        },
        vendor: true,
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    if (!ticket) throw new NotFoundException(`Ticket ${id} not found`)
    return ticket
  }

  async addMessage(ticketId: string, dto: AddTicketMessageDto) {
    if (!dto.message || !dto.message.trim()) {
      throw new BadRequestException('Message content is required')
    }

    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } })
    if (!ticket) throw new NotFoundException(`Ticket ${ticketId} not found`)

    // Determine status transition based on sender
    let newStatus = ticket.status
    if (dto.senderType === SenderType.CUSTOMER) {
      newStatus = TicketStatus.IN_PROGRESS
    } else if (dto.senderType === SenderType.ADMIN && !dto.isInternalNote) {
      newStatus = TicketStatus.WAITING_ON_CUSTOMER
    }

    const [message, updatedTicket] = await this.prisma.$transaction([
      this.prisma.ticketMessage.create({
        data: {
          ticketId,
          senderType: dto.senderType,
          senderId: dto.senderId,
          senderName: dto.senderName.trim(),
          message: dto.message.trim(),
          attachments: dto.attachments || [],
          isInternalNote: dto.isInternalNote || false,
        },
      }),
      this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: newStatus,
          updatedAt: new Date(),
        },
      }),
    ])

    // Emit event in transactional outbox for public customer communication
    if (!dto.isInternalNote) {
      await this.queueService.publishEvent('TICKET_REPLIED', message.id, {
        ticketId,
        ticketNumber: ticket.ticketNumber,
        senderType: dto.senderType,
      })
    }

    return {
      message,
      ticketStatus: updatedTicket.status,
    }
  }

  async updateTicket(id: string, dto: UpdateTicketDto) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } })
    if (!ticket) throw new NotFoundException(`Ticket ${id} not found`)

    const data: any = {}
    if (dto.status) {
      data.status = dto.status
      if (dto.status === TicketStatus.RESOLVED && !ticket.resolvedAt) {
        data.resolvedAt = new Date()
      }
      if (dto.status === TicketStatus.CLOSED && !ticket.closedAt) {
        data.closedAt = new Date()
      }
    }
    if (dto.priority) data.priority = dto.priority
    if (dto.assignedTo !== undefined) data.assignedTo = dto.assignedTo
    if (dto.assignedToName !== undefined) data.assignedToName = dto.assignedToName

    return this.prisma.supportTicket.update({
      where: { id },
      data,
      include: {
        customer: { select: { firstName: true, lastName: true, email: true } },
      },
    })
  }
}
