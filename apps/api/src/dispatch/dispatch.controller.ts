import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { DispatchService, ConfirmDispatchDto } from './dispatch.service';

@Controller('dispatch')
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  @Get(':token')
  getShipment(@Param('token') token: string) {
    return this.dispatchService.getShipmentByToken(token);
  }

  @Post(':token/confirm')
  confirm(@Param('token') token: string, @Body() dto: ConfirmDispatchDto) {
    return this.dispatchService.confirmDispatch(token, dto);
  }
}
