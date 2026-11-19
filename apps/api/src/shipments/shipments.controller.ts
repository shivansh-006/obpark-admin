import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ShipmentsService } from './shipments.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'

@Controller('admin/shipments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Get()
  list(
    @Query('status') status?: string,
    @Query('vendorId') vendorId?: string,
    @Query('payoutStatus') payoutStatus?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.shipmentsService.listShipments({
      status,
      vendorId,
      payoutStatus,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Patch(':id/override')
  override(
    @Param('id') id: string,
    @Body() dto: { courierName: string; trackingNumber: string; courierWebsite?: string },
  ) {
    return this.shipmentsService.overrideDispatch(id, dto)
  }

  @Patch(':id/deliver')
  markDelivered(@Param('id') id: string) {
    return this.shipmentsService.markDelivered(id)
  }

  @Post(':id/resend-email')
  resendEmail(@Param('id') id: string) {
    return this.shipmentsService.resendDispatchEmail(id)
  }
}
