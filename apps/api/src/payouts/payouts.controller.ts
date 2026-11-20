import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PayoutsService, SettleShipmentDto } from './payouts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('admin/payouts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Get()
  getSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.payoutsService.getPayoutSummary({ startDate, endDate });
  }

  @Get('vendor/:vendorId')
  getVendorDetails(@Param('vendorId') vendorId: string) {
    return this.payoutsService.getVendorLedgerDetails(vendorId);
  }

  @Post('settle/:shipmentId')
  settle(
    @Param('shipmentId') shipmentId: string,
    @Body() dto: SettleShipmentDto,
  ) {
    return this.payoutsService.settleShipment(shipmentId, dto);
  }
}
