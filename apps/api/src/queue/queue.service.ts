import { Injectable, Logger, OnModuleInit, OnModuleDestroy, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { OutboxStatus } from '@prisma/client'

export type EventHandler = (payload: any, event: any) => Promise<void>

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name)
  private readonly handlers = new Map<string, EventHandler[]>()
  private pollingTimer: NodeJS.Timeout | null = null
  private isProcessing = false

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    // Start automated outbox processor (every 5 seconds)
    this.pollingTimer = setInterval(() => {
      this.processOutboxBatch().catch((err) => {
        this.logger.error(`Error processing background outbox queue: ${err.message}`)
      })
    }, 5000)
    this.logger.log('QueueService initialized with transactional outbox processor.')
  }

  onModuleDestroy() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer)
      this.pollingTimer = null
    }
  }

  /**
   * Register an idempotent event consumer for a specific eventType.
   */
  registerHandler(eventType: string, handler: EventHandler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, [])
    }
    this.handlers.get(eventType)!.push(handler)
  }

  /**
   * Publishes an event to the transactional outbox.
   * Can be passed inside an existing Prisma transaction or executed standalone.
   */
  async publishEvent(
    eventType: string,
    entityId: string,
    payload: any,
    options?: { correlationId?: string; scheduledFor?: Date; tx?: any },
  ) {
    const client = options?.tx || this.prisma
    const event = await client.outboxEvent.create({
      data: {
        eventType,
        entityId,
        correlationId: options?.correlationId,
        payload,
        status: OutboxStatus.PENDING,
        scheduledFor: options?.scheduledFor || new Date(),
      },
    })

    this.logger.log(`Outbox event published [${eventType}] ID: ${event.id} Entity: ${entityId}`)
    return event
  }

  /**
   * Fetches and processes pending events with exponential backoff and dead-letter queue.
   */
  async processOutboxBatch(batchSize = 10): Promise<number> {
    if (this.isProcessing) return 0
    this.isProcessing = true

    try {
      const now = new Date()
      const pendingEvents = await this.prisma.outboxEvent.findMany({
        where: {
          status: OutboxStatus.PENDING,
          scheduledFor: { lte: now },
        },
        take: batchSize,
        orderBy: { createdAt: 'asc' },
      })

      if (pendingEvents.length === 0) {
        return 0
      }

      for (const event of pendingEvents) {
        await this.processSingleEvent(event)
      }

      return pendingEvents.length
    } finally {
      this.isProcessing = false
    }
  }

  private async processSingleEvent(event: any) {
    // Mark as PROCESSING
    await this.prisma.outboxEvent.update({
      where: { id: event.id },
      data: { status: OutboxStatus.PROCESSING },
    })

    const registeredHandlers = this.handlers.get(event.eventType) || []

    try {
      if (registeredHandlers.length > 0) {
        for (const handler of registeredHandlers) {
          await handler(event.payload, event)
        }
      } else {
        // No explicit handler registered — logged and completed
        this.logger.debug(`No handler registered for event type ${event.eventType}. Marked completed.`)
      }

      // Mark COMPLETED
      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: OutboxStatus.COMPLETED,
          processedAt: new Date(),
        },
      })
    } catch (err: any) {
      const nextAttempt = event.attempts + 1
      const isDead = nextAttempt >= event.maxAttempts

      // Exponential backoff: 2^attempt * 10 seconds
      const backoffSeconds = Math.pow(2, nextAttempt) * 10
      const nextScheduled = new Date()
      nextScheduled.setSeconds(nextScheduled.getSeconds() + backoffSeconds)

      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: isDead ? OutboxStatus.FAILED : OutboxStatus.PENDING,
          attempts: nextAttempt,
          lastError: err?.message || 'Unknown processing error',
          scheduledFor: isDead ? undefined : nextScheduled,
        },
      })

      if (isDead) {
        this.logger.error(`[DEAD-LETTER QUEUE] Job ${event.id} permanently failed after ${nextAttempt} attempts: ${err.message}`)
      } else {
        this.logger.warn(`Job ${event.id} failed attempt ${nextAttempt}. Retrying in ${backoffSeconds}s...`)
      }
    }
  }

  /**
   * Queue Statistics & Dead-Letter Management
   */
  async getQueueStats() {
    const [pending, processing, completed, failed] = await Promise.all([
      this.prisma.outboxEvent.count({ where: { status: OutboxStatus.PENDING } }),
      this.prisma.outboxEvent.count({ where: { status: OutboxStatus.PROCESSING } }),
      this.prisma.outboxEvent.count({ where: { status: OutboxStatus.COMPLETED } }),
      this.prisma.outboxEvent.count({ where: { status: OutboxStatus.FAILED } }),
    ])

    return {
      pending,
      processing,
      completed,
      failed,
      total: pending + processing + completed + failed,
    }
  }

  async listJobs(filters?: { status?: OutboxStatus; eventType?: string; page?: number; limit?: number }) {
    const where: any = {}
    if (filters?.status) where.status = filters.status
    if (filters?.eventType) where.eventType = { contains: filters.eventType, mode: 'insensitive' }

    const page = Math.max(Number(filters?.page) || 1, 1)
    const limit = Math.min(Math.max(Number(filters?.limit) || 20, 1), 100)
    const skip = (page - 1) * limit

    const [jobs, total] = await Promise.all([
      this.prisma.outboxEvent.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.outboxEvent.count({ where }),
    ])

    return {
      jobs,
      total,
      page,
      limit,
    }
  }

  async retryJob(id: string) {
    const job = await this.prisma.outboxEvent.findUnique({ where: { id } })
    if (!job) throw new NotFoundException(`Job ${id} not found`)

    return this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: OutboxStatus.PENDING,
        attempts: 0,
        lastError: null,
        scheduledFor: new Date(),
      },
    })
  }

  async retryAllFailed() {
    return this.prisma.outboxEvent.updateMany({
      where: { status: OutboxStatus.FAILED },
      data: {
        status: OutboxStatus.PENDING,
        attempts: 0,
        lastError: null,
        scheduledFor: new Date(),
      },
    })
  }

  async purgeJob(id: string) {
    return this.prisma.outboxEvent.delete({ where: { id } })
  }
}
