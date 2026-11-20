import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common'
import {
  ReturnsService,
  CreateReturnDto,
  UpdateReturnStatusDto,
  InspectReturnDto,
  ProcessRefundDto,
  CreateWarrantyClaimDto,
  ResolveWarrantyClaimDto,
} from './returns.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'
import { ReturnStatus, WarrantyStatus } from '@prisma/client'

@Controller('admin/returns')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ReturnsController {
  constructor(private returnsService: ReturnsService) {}

  @Get('stats')
  getStats() {
    return this.returnsService.getReturnStats()
  }

  @Get()
  listReturns(
    @Query('status') status?: ReturnStatus,
    @Query('vendorId') vendorId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.returnsService.listReturns({
      status,
      vendorId,
      search,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    })
  }

  @Post()
  createReturn(@Body() dto: CreateReturnDto) {
    return this.returnsService.createReturnRequest(dto)
  }

  @Get(':id')
  getReturn(@Param('id') id: string) {
    return this.returnsService.getReturnById(id)
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateReturnStatusDto) {
    return this.returnsService.updateReturnStatus(id, dto)
  }

  @Patch(':id/inspect')
  inspectItem(@Param('id') id: string, @Body() dto: InspectReturnDto) {
    return this.returnsService.inspectItem(id, dto)
  }

  @Post(':id/refund')
  processRefund(@Param('id') id: string, @Body() dto: ProcessRefundDto) {
    return this.returnsService.processRefund(id, dto)
  }

  // Warranty Claims Endpoints
  @Get('warranty/claims')
  listWarrantyClaims(
    @Query('status') status?: WarrantyStatus,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.returnsService.listWarrantyClaims({
      status,
      search,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    })
  }

  @Post('warranty/claims')
  createWarrantyClaim(@Body() dto: CreateWarrantyClaimDto) {
    return this.returnsService.createWarrantyClaim(dto)
  }

  @Patch('warranty/claims/:id')
  resolveWarrantyClaim(
    @Param('id') id: string,
    @Body() dto: ResolveWarrantyClaimDto,
  ) {
    return this.returnsService.resolveWarrantyClaim(id, dto)
  }
}
