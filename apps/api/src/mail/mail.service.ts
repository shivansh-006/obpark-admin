import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { env } from '../config/env';

export interface VendorDispatchEmailPayload {
  vendorEmail: string;
  vendorName: string;
  orderNumber: string;
  shipmentId: string;
  dispatchToken: string;
  subtotal: number;
  items: Array<{
    name: string;
    sku?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    variant?: string;
  }>;
  customer: {
    name: string;
    phone: string;
    streetAddress: string;
    city: string;
    state: string;
    postalCode: string;
  };
}

export interface CustomerTrackingEmailPayload {
  customerEmail: string;
  customerName: string;
  orderNumber: string;
  courierName: string;
  trackingNumber: string;
  courierWebsite?: string;
  items: Array<{
    name: string;
    quantity: number;
  }>;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    if (!env.SMTP_PASS) {
      this.logger.warn(
        '⚠️ SMTP_PASS is not configured. Outbound emails will be simulated and logged to console.',
      );
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE, // true for port 465, false for 587
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: env.NODE_ENV === 'production',
        },
      });
      this.logger.log(
        `SMTP Transporter initialized successfully with ${env.SMTP_HOST}:${env.SMTP_PORT}`,
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to initialize SMTP transporter: ${err.message}`,
      );
    }
  }

  async sendVendorDispatchAlert(
    payload: VendorDispatchEmailPayload,
  ): Promise<boolean> {
    const baseUrl = (
      env.ADMIN_FRONTEND_URL || 'https://admin.obpark.in'
    ).replace(/\/$/, '');
    const dispatchUrl = `${baseUrl}/dispatch/${payload.dispatchToken}`;
    const html = this.buildVendorPackingSlipHtml(payload, dispatchUrl);

    if (!this.transporter) {
      this.logger.log(
        `[SIMULATED EMAIL] To: ${payload.vendorEmail} | Subject: [OBPark] New Order ${payload.orderNumber} - Action Required`,
      );
      this.logger.log(`Dispatch URL: ${dispatchUrl}`);
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: env.SMTP_FROM,
        to: payload.vendorEmail,
        cc: env.SMTP_ADMIN_CC || undefined,
        subject: `[OBPark Dispatch] New Order ${payload.orderNumber} - Pack & Ship Request`,
        html,
      });
      this.logger.log(
        `Dispatch packing slip sent to vendor ${payload.vendorEmail} for order ${payload.orderNumber}`,
      );
      return true;
    } catch (err: any) {
      this.logger.error(
        `Failed to send dispatch email to ${payload.vendorEmail}: ${err.message}`,
      );
      return false;
    }
  }

  async sendCustomerTrackingAlert(
    payload: CustomerTrackingEmailPayload,
  ): Promise<boolean> {
    const html = this.buildCustomerTrackingHtml(payload);

    if (!this.transporter) {
      this.logger.log(
        `[SIMULATED EMAIL] To: ${payload.customerEmail} | Subject: Your OBPark Order ${payload.orderNumber} has been dispatched!`,
      );
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: env.SMTP_FROM,
        to: payload.customerEmail,
        subject: `Your OBPark Order ${payload.orderNumber} Has Shipped! (${payload.courierName})`,
        html,
      });
      this.logger.log(
        `Tracking notification sent to customer ${payload.customerEmail} for order ${payload.orderNumber}`,
      );
      return true;
    } catch (err: any) {
      this.logger.error(
        `Failed to send tracking email to ${payload.customerEmail}: ${err.message}`,
      );
      return false;
    }
  }

  private buildVendorPackingSlipHtml(
    payload: VendorDispatchEmailPayload,
    dispatchUrl: string,
  ): string {
    const itemRows = payload.items
      .map(
        (it) => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px; font-size: 14px; color: #1f2937;">
            <strong>${this.escapeHtml(it.name)}</strong>
            ${it.variant ? `<br><span style="font-size: 12px; color: #6b7280;">Variant: ${this.escapeHtml(it.variant)}</span>` : ''}
          </td>
          <td style="padding: 12px; font-size: 13px; color: #4b5563; font-family: monospace;">
            ${this.escapeHtml(it.sku || 'OB-SKU')}
          </td>
          <td style="padding: 12px; font-size: 14px; color: #1f2937; text-align: center; font-weight: bold;">
            ${it.quantity}
          </td>
          <td style="padding: 12px; font-size: 14px; color: #1f2937; text-align: right;">
            ₹${Number(it.totalPrice).toLocaleString('en-IN')}
          </td>
        </tr>`,
      )
      .join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OBPark Vendor Dispatch Request</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <!-- Brand Header -->
          <tr>
            <td style="background-color: #074139; padding: 28px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 1px;">OBPARK</h1>
                    <p style="color: #95D0CC; margin: 4px 0 0 0; font-size: 13px;">Merchant Fulfillment & Dispatch Order</p>
                  </td>
                  <td align="right">
                    <span style="background-color: #95D0CC; color: #074139; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 700;">
                      ACTION REQUIRED
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 36px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #1f2937;">
                Dear <strong>${this.escapeHtml(payload.vendorName)}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #4b5563; line-height: 1.5;">
                A new customer order has been confirmed on OBPark. Please prepare, securely package, and dispatch the items listed below to the customer address.
              </p>

              <!-- Order Summary Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
                <tr>
                  <td width="50%">
                    <span style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Master Order Number</span><br>
                    <strong style="font-size: 16px; color: #074139;">${this.escapeHtml(payload.orderNumber)}</strong>
                  </td>
                  <td width="50%" align="right">
                    <span style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Shipment Value</span><br>
                    <strong style="font-size: 16px; color: #1f2937;">₹${Number(payload.subtotal).toLocaleString('en-IN')}</strong>
                  </td>
                </tr>
              </table>

              <!-- Packing Slip Items Table -->
              <h3 style="margin: 0 0 12px 0; font-size: 15px; color: #111827; border-bottom: 2px solid #074139; padding-bottom: 6px;">
                Items to Pack
              </h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px; border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">
                    <th style="padding: 10px 12px; font-size: 12px; color: #6b7280; text-align: left; text-transform: uppercase;">Item</th>
                    <th style="padding: 10px 12px; font-size: 12px; color: #6b7280; text-align: left; text-transform: uppercase;">SKU</th>
                    <th style="padding: 10px 12px; font-size: 12px; color: #6b7280; text-align: center; text-transform: uppercase;">Qty</th>
                    <th style="padding: 10px 12px; font-size: 12px; color: #6b7280; text-align: right; text-transform: uppercase;">Price</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRows}
                </tbody>
              </table>

              <!-- Customer Shipping Destination Card -->
              <h3 style="margin: 0 0 12px 0; font-size: 15px; color: #111827;">
                Ship To (Delivery Destination)
              </h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 16px; margin-bottom: 32px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: bold; color: #1e3a8a;">
                      ${this.escapeHtml(payload.customer.name)}
                    </p>
                    <p style="margin: 0 0 4px 0; font-size: 14px; color: #1e40af;">
                      📞 Phone: <strong>${this.escapeHtml(payload.customer.phone)}</strong>
                    </p>
                    <p style="margin: 0; font-size: 13px; color: #1f2937; line-height: 1.4;">
                      ${this.escapeHtml(payload.customer.streetAddress)}<br>
                      ${this.escapeHtml(payload.customer.city)}, ${this.escapeHtml(payload.customer.state)} - <strong>${this.escapeHtml(payload.customer.postalCode)}</strong>
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Call To Action Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${dispatchUrl}" style="background-color: #074139; color: #ffffff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-size: 15px; font-weight: 700; display: inline-block; box-shadow: 0 2px 4px rgba(7, 65, 57, 0.2);">
                      Enter Courier &amp; AWB Number &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0 0; font-size: 12px; color: #9ca3af; text-align: center;">
                Click above to submit your Courier and AWB tracking details once the box is dispatched.<br>
                This link is unique to your shipment. No login or password is required.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 36px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #6b7280;">
                OBPark Central Fulfillment System &bull; <a href="https://obpark.in" style="color: #074139; text-decoration: none;">obpark.in</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private buildCustomerTrackingHtml(
    payload: CustomerTrackingEmailPayload,
  ): string {
    const itemsList = payload.items
      .map(
        (it) =>
          `<li><strong>${this.escapeHtml(it.name)}</strong> (Qty: ${it.quantity})</li>`,
      )
      .join('');

    return `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, sans-serif; background-color: #f9fafb; padding: 24px; color: #1f2937;">
  <div style="max-width: 560px; margin: 0 auto; background: #fff; padding: 32px; border-radius: 8px; border: 1px solid #e5e7eb;">
    <h2 style="color: #074139; margin-top: 0;">Good news! Your order is on its way.</h2>
    <p>Dear ${this.escapeHtml(payload.customerName)},</p>
    <p>Items from your OBPark order <strong>${this.escapeHtml(payload.orderNumber)}</strong> have been packed and dispatched.</p>

    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0 0 6px 0; font-size: 13px; color: #166534; text-transform: uppercase;">Shipment Tracking</p>
      <p style="margin: 0; font-size: 15px; color: #14532d;">
        Courier: <strong>${this.escapeHtml(payload.courierName)}</strong><br>
        AWB / Tracking Number: <strong style="font-family: monospace;">${this.escapeHtml(payload.trackingNumber)}</strong>
      </p>
    </div>

    <h3>Dispatched Items:</h3>
    <ul style="padding-left: 20px; color: #4b5563;">
      ${itemsList}
    </ul>

    <p style="font-size: 13px; color: #6b7280; margin-top: 24px;">
      Thank you for shopping with OBPark!
    </p>
  </div>
</body>
</html>`;
  }

  private escapeHtml(str: string): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
