import { MailService } from './mail.service';
import { env } from '../config/env';

describe('MailService', () => {
  let mailService: MailService;
  const originalFetch = global.fetch;

  beforeEach(() => {
    mailService = new MailService();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete (env as any).BREVO_API_KEY;
  });

  it('should simulate vendor dispatch email when neither Brevo nor SMTP is configured', async () => {
    const result = await mailService.sendVendorDispatchAlert({
      vendorEmail: 'vendor@example.com',
      vendorName: 'Super Seller',
      orderNumber: 'ORD-101',
      shipmentId: 'ship-1',
      dispatchToken: 'token-abc',
      subtotal: 1200,
      items: [
        {
          name: 'OBPark Product',
          quantity: 2,
          unitPrice: 600,
          totalPrice: 1200,
        },
      ],
      customer: {
        name: 'John Doe',
        phone: '9876543210',
        streetAddress: '123 Park Lane',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001',
      },
    });

    expect(result).toBe(true);
  });

  it('should simulate customer tracking email when neither Brevo nor SMTP is configured', async () => {
    const result = await mailService.sendCustomerTrackingAlert({
      customerEmail: 'customer@example.com',
      customerName: 'Jane Doe',
      orderNumber: 'ORD-102',
      courierName: 'Delhivery',
      trackingNumber: 'DEL123456789',
      items: [{ name: 'OBPark Product', quantity: 1 }],
    });

    expect(result).toBe(true);
  });

  it('should send email via Brevo REST API when BREVO_API_KEY is present', async () => {
    (env as any).BREVO_API_KEY = 'test-brevo-key';
    (env as any).BREVO_SENDER_EMAIL = 'orders@obpark.in';
    (env as any).BREVO_SENDER_NAME = 'OBPark Orders';

    let capturedUrl = '';
    let capturedOptions: any = null;

    global.fetch = jest.fn().mockImplementation(async (url: string, options: any) => {
      capturedUrl = url;
      capturedOptions = options;
      return {
        ok: true,
        status: 201,
        json: async () => ({ messageId: 'brevo-msg-123' }),
        text: async () => JSON.stringify({ messageId: 'brevo-msg-123' }),
      };
    }) as any;

    const result = await mailService.sendVendorDispatchAlert({
      vendorEmail: 'vendor@example.com',
      vendorName: 'Super Seller',
      orderNumber: 'ORD-101',
      shipmentId: 'ship-1',
      dispatchToken: 'token-abc',
      subtotal: 1200,
      items: [
        {
          name: 'OBPark Product',
          quantity: 2,
          unitPrice: 600,
          totalPrice: 1200,
        },
      ],
      customer: {
        name: 'John Doe',
        phone: '9876543210',
        streetAddress: '123 Park Lane',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001',
      },
    });

    expect(result).toBe(true);
    expect(capturedUrl).toBe('https://api.brevo.com/v3/smtp/email');
    expect(capturedOptions.headers['api-key']).toBe('test-brevo-key');
    const body = JSON.parse(capturedOptions.body);
    expect(body.to[0].email).toBe('vendor@example.com');
    expect(body.sender.email).toBe('orders@obpark.in');
    expect(body.subject).toContain('ORD-101');
  });

  it('should handle Brevo API errors gracefully without crashing', async () => {
    (env as any).BREVO_API_KEY = 'test-brevo-key';

    global.fetch = jest.fn().mockImplementation(async () => {
      return {
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ code: 'unauthorized', message: 'Invalid API key' }),
      };
    }) as any;

    const result = await mailService.sendCustomerTrackingAlert({
      customerEmail: 'customer@example.com',
      customerName: 'Jane Doe',
      orderNumber: 'ORD-102',
      courierName: 'Delhivery',
      trackingNumber: 'DEL123456789',
      items: [{ name: 'OBPark Product', quantity: 1 }],
    });

    expect(result).toBe(false);
  });
});
