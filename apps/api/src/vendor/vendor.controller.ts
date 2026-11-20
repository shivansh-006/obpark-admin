import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  VendorService,
  CreateVendorDto,
  UpdateVendorDto,
} from './vendor.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('admin/vendors')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Post()
  create(@Body() dto: CreateVendorDto) {
    return this.vendorService.createVendor(dto);
  }

  @Get()
  list(@Query('search') search?: string, @Query('isActive') isActive?: string) {
    const activeBool = isActive !== undefined ? isActive === 'true' : undefined;
    return this.vendorService.listVendors(search, activeBool);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.vendorService.getVendorById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVendorDto) {
    return this.vendorService.updateVendor(id, dto);
  }

  @Patch(':id/toggle')
  toggleStatus(@Param('id') id: string) {
    return this.vendorService.toggleVendorStatus(id);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.vendorService.deleteVendor(id);
  }
}
