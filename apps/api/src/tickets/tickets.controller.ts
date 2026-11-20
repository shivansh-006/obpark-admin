import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  TicketsService,
  CreateTicketDto,
  AddTicketMessageDto,
  UpdateTicketDto,
} from './tickets.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';

@Controller('admin/tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class TicketsController {
  constructor(private ticketsService: TicketsService) {}

  @Get('stats')
  getStats() {
    return this.ticketsService.getTicketStats();
  }

  @Get()
  listTickets(
    @Query('status') status?: TicketStatus,
    @Query('priority') priority?: TicketPriority,
    @Query('category') category?: TicketCategory,
    @Query('assignedTo') assignedTo?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ticketsService.listTickets({
      status,
      priority,
      category,
      assignedTo,
      search,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Post()
  createTicket(@Body() dto: CreateTicketDto) {
    return this.ticketsService.createTicket(dto);
  }

  @Get(':id')
  getTicket(@Param('id') id: string) {
    return this.ticketsService.getTicketById(id);
  }

  @Post(':id/messages')
  addMessage(@Param('id') id: string, @Body() dto: AddTicketMessageDto) {
    return this.ticketsService.addMessage(id, dto);
  }

  @Patch(':id')
  updateTicket(@Param('id') id: string, @Body() dto: UpdateTicketDto) {
    return this.ticketsService.updateTicket(id, dto);
  }
}
