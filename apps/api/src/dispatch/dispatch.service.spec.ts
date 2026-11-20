import { DispatchService } from './dispatch.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

// Support both Jest and Bun test environments
const createMockFn = () => {
  let mockImpl: any = null;
  const fn: any = (...args: any[]) => {
    fn.mock.calls.push(args);
    if (fn._mockResolvedValueOnce && fn._mockResolvedValueOnce.length > 0) {
      return Promise.resolve(fn._mockResolvedValueOnce.shift());
    }
    if (fn._mockResolvedValue !== undefined) {
      return Promise.resolve(fn._mockResolvedValue);
    }
    if (mockImpl) return mockImpl(...args);
    return undefined;
  };
  fn.mock = { calls: [] };
  fn._mockResolvedValueOnce = [];
  fn.mockResolvedValue = (val: any) => {
    fn._mockResolvedValue = val;
    return fn;
  };
  fn.mockResolvedValueOnce = (val: any) => {
    fn._mockResolvedValueOnce.push(val);
    return fn;
  };
  fn.mockImplementation = (impl: any) => {
    mockImpl = impl;
    return fn;
  };
  return fn;
};

describe('DispatchService', () => {
  let service: DispatchService;
  let prisma: any;
  let mailService: any;

  beforeEach(() => {
    prisma = {
      vendorShipment: {
        findUnique: createMockFn(),
        update: createMockFn(),
        count: createMockFn(),
      },
      order: {
        update: createMockFn(),
      },
    };

    mailService = {
      sendCustomerTrackingAlert: createMockFn().mockResolvedValue(true),
    };

    service = new DispatchService(prisma, mailService);
  });

  describe('confirmDispatch', () => {
    it('should throw BadRequestException if courier or AWB is missing', async () => {
      try {
        await service.confirmDispatch('token-1', {
          courierName: '',
          trackingNumber: '',
        });
        expect(true).toBe(false);
      } catch (err: any) {
        expect(err instanceof BadRequestException).toBe(true);
      }
    });

    it('should throw NotFoundException if token is invalid', async () => {
      prisma.vendorShipment.findUnique.mockResolvedValue(null);

      try {
        await service.confirmDispatch('invalid-token', {
          courierName: 'Blue Dart',
          trackingNumber: 'AWB123',
        });
        expect(true).toBe(false);
      } catch (err: any) {
        expect(err instanceof NotFoundException).toBe(true);
      }
    });

    it('should throw ConflictException if shipment is already dispatched', async () => {
      prisma.vendorShipment.findUnique.mockResolvedValue({
        id: 'ship-1',
        status: 'DISPATCHED',
      });

      try {
        await service.confirmDispatch('token-1', {
          courierName: 'Blue Dart',
          trackingNumber: 'AWB123',
        });
        expect(true).toBe(false);
      } catch (err: any) {
        expect(err instanceof ConflictException).toBe(true);
      }
    });

    it('should transition shipment to DISPATCHED and trigger tracking notification', async () => {
      prisma.vendorShipment.findUnique.mockResolvedValue({
        id: 'ship-1',
        orderId: 'order-1',
        status: 'PENDING',
        items: [{ name: 'LED Headlamp', quantity: 1 }],
        order: {
          orderNumber: 'OB-1001',
          user: {
            email: 'customer@obpark.in',
            firstName: 'Aman',
            lastName: 'Kumar',
          },
        },
        vendor: { businessName: 'AutoTech' },
      });

      prisma.vendorShipment.update.mockResolvedValue({
        id: 'ship-1',
        status: 'DISPATCHED',
        courierName: 'Delhivery',
        trackingNumber: 'DEL-9988',
      });

      prisma.vendorShipment.count.mockResolvedValue(0);
      prisma.order.update.mockResolvedValue({});

      const result = await service.confirmDispatch('valid-token', {
        courierName: 'Delhivery',
        trackingNumber: 'DEL-9988',
      });

      expect(result.success).toBe(true);
      expect(prisma.vendorShipment.update.mock.calls.length).toBe(1);
      expect(prisma.vendorShipment.update.mock.calls[0][0].data.status).toBe(
        'DISPATCHED',
      );
      expect(
        prisma.vendorShipment.update.mock.calls[0][0].data.courierName,
      ).toBe('Delhivery');
      expect(
        prisma.vendorShipment.update.mock.calls[0][0].data.trackingNumber,
      ).toBe('DEL-9988');
      expect(prisma.order.update.mock.calls.length).toBe(1);
      expect(prisma.order.update.mock.calls[0][0].data.status).toBe('SHIPPED');
      expect(mailService.sendCustomerTrackingAlert.mock.calls.length).toBe(1);
    });
  });
});
