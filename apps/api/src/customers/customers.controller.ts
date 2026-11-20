import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('admin/customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @Get('count')
  getTotalCustomers() {
    return this.customersService.getTotalCustomers();
  }

  @Get()
  list(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.customersService.listCustomers(
      search,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
    );
  }
}
