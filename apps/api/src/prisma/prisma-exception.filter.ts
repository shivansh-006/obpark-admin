import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus, Logger } from '@nestjs/common'
import { Response } from 'express'
import { Prisma } from '@prisma/client'

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name)

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let message = 'An unexpected database error occurred'

    switch (exception.code) {
      case 'P2002': {
        status = HttpStatus.CONFLICT
        const target = (exception.meta?.target as string[]) || []
        message = target.length > 0
          ? `Unique constraint failed on field(s): ${target.join(', ')}`
          : 'A record with this unique value already exists'
        break
      }
      case 'P2025': {
        status = HttpStatus.NOT_FOUND
        message = (exception.meta?.cause as string) || 'Record not found in the database'
        break
      }
      case 'P2003': {
        status = HttpStatus.BAD_REQUEST
        message = 'Foreign key constraint violation: referenced record does not exist'
        break
      }
      case 'P2014': {
        status = HttpStatus.BAD_REQUEST
        message = 'Relation constraint violation: operation would break required relationship'
        break
      }
      default: {
        this.logger.error(`Prisma error ${exception.code}: ${exception.message}`, exception.stack)
        message = `Database request error (${exception.code})`
        break
      }
    }

    response.status(status).json({
      statusCode: status,
      error: HttpStatus[status],
      message,
      timestamp: new Date().toISOString(),
    })
  }
}
