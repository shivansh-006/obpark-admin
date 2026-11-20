import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async listCustomers(search?: string, page?: number, limit?: number) {
    const where: any = search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { phoneNumber: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const isPaginated = page !== undefined || limit !== undefined;
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const safePage = Math.max(Number(page) || 1, 1);
    const skip = isPaginated ? (safePage - 1) * safeLimit : 0;
    const take = isPaginated ? safeLimit : 100; // Cap unpaginated queries to 100 to prevent OOM

    const [users, total] = await Promise.all([
      this.prisma.users.findMany({
        where,
        take,
        skip,
        include: {
          orders: {
            select: {
              totalAmount: true,
            },
          },
          addresses: {
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.users.count({ where }),
    ]);

    const mapped = users.map((u, index) => {
      const orderCount = u.orders.length;
      const totalSpend = u.orders.reduce(
        (sum, order) => sum + Number(order.totalAmount),
        0,
      );
      const name =
        `${u.firstName || ''} ${u.lastName || ''}`.trim() ||
        u.email ||
        'Customer';
      const primaryAddress = u.addresses[0];

      const rawImage = u.profileImage?.trim();
      const avatarUrl =
        rawImage && rawImage !== 'null' && rawImage !== 'undefined'
          ? rawImage.startsWith('http://') || rawImage.startsWith('https://')
            ? rawImage
            : rawImage.startsWith('/uploads/')
              ? rawImage
              : `/uploads/${rawImage.replace(/^\/?(uploads\/)?/, '')}`
          : null;

      return {
        id: String(index + 1),
        userId: u.id,
        name,
        email: u.email ?? '—',
        phone: u.phoneNumber ?? '—',
        orderCount,
        totalSpend,
        avatar: avatarUrl,
        city: u.city || (primaryAddress ? primaryAddress.city : '—'),
        status: u.isActive ? 'Active' : 'Inactive',
        createdAt: u.createdAt,
        addresses: u.addresses.map((a) => ({
          id: a.id,
          label: a.label,
          type: a.label,
          streetAddress: a.streetAddress,
          apartmentSuite: a.apartmentSuite,
          city: a.city,
          zipCode: a.zipCode,
          country: a.country,
          isDefault: a.isDefault,
        })),
      };
    });

    return isPaginated
      ? { customers: mapped, total, page: safePage, limit: safeLimit }
      : mapped;
  }

  async getCustomerCount() {
    return this.prisma.users.count();
  }

  async getTotalCustomers() {
    return this.prisma.users.count();
  }
}
