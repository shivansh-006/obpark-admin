import { Module } from '@nestjs/common'
import { ShipmentsService } from './shipments.service'
import { ShipmentsController } from './shipments.controller'
import { PrismaModule } from '../prisma/prisma.module'
import { MailModule } from '../mail/mail.module'

@Module({
  imports: [PrismaModule, MailModule],
  controllers: [ShipmentsController],
  providers: [ShipmentsService],
  exports: [ShipmentsService],
})
export class ShipmentsModule {}
