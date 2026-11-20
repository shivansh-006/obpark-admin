import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common'
import { QueueService } from './queue.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'
import { OutboxStatus } from '@prisma/client'

@Controller('admin/queues')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class QueueController {
  constructor(private queueService: QueueService) {}

  @Get('stats')
  getStats() {
    return this.queueService.getQueueStats()
  }

  @Get('jobs')
  listJobs(
    @Query('status') status?: OutboxStatus,
    @Query('eventType') eventType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.queueService.listJobs({
      status,
      eventType,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    })
  }

  @Post('retry/:id')
  retryJob(@Param('id') id: string) {
    return this.queueService.retryJob(id)
  }

  @Post('retry-all')
  retryAllFailed() {
    return this.queueService.retryAllFailed()
  }

  @Delete(':id')
  purgeJob(@Param('id') id: string) {
    return this.queueService.purgeJob(id)
  }
}
