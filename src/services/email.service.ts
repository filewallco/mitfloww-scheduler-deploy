import { logger } from "../utils/logger.js";
import {
  getEmailBrandHeaderHtml,
  getEmailBrandFooterHtml,
  getEmailLogoAttachment,
  getEmailIconAttachment,
  type EmailAttachment,
} from "./email-logo.js";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
}

/**
 * Wraps content in a full-width, responsive, dark-mode safe email document
 * using the official MitFloww branded header strip and icon footer.
 */
function wrapEmailHtml(contentHtml: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <style>
      :root {
        color-scheme: light;
        supported-color-schemes: light;
      }
      body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
      table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
      img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
      body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; min-width: 100%; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }

      /* Force logo strip to always be 100% white, never inverting across any theme or dark mode */
      .logo-strip, .logo-strip td {
        background-color: #ffffff !important;
        background: #ffffff !important;
        background-image: linear-gradient(#ffffff, #ffffff) !important;
      }
      @media (prefers-color-scheme: dark) {
        .logo-strip, .logo-strip td {
          background-color: #ffffff !important;
          background: #ffffff !important;
          background-image: linear-gradient(#ffffff, #ffffff) !important;
        }
      }
      /* Gmail app dark mode override */
      u + .body .logo-strip, u + .body .logo-strip td {
        background-color: #ffffff !important;
        background: #ffffff !important;
        background-image: linear-gradient(#ffffff, #ffffff) !important;
      }
      /* Outlook dark mode override */
      [data-ogsc] .logo-strip, [data-ogsc] .logo-strip td,
      [data-ogsb] .logo-strip, [data-ogsb] .logo-strip td {
        background-color: #ffffff !important;
        background: #ffffff !important;
        background-image: linear-gradient(#ffffff, #ffffff) !important;
      }
      .btn {
        display: inline-block;
        background-color: #005bdd;
        color: #ffffff !important;
        text-decoration: none;
        padding: 13px 28px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        margin-top: 20px;
      }
    </style>
  </head>
  <body class="body" style="margin: 0; padding: 0; width: 100% !important; min-width: 100%; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
    <!-- Main Content Container with width-fitting Brand Header Strip -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width: 100%; min-width: 100%; background-color: #ffffff; border-collapse: collapse;">
      <tr>
        <td align="center" style="padding: 24px 16px 0 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; margin: 0 auto; border-collapse: collapse;">
            <!-- Width-fitting White Brand Header Strip -->
            <tr>
              <td style="padding: 0 0 24px 0;">
                ${getEmailBrandHeaderHtml()}
              </td>
            </tr>
            <!-- Email Body Content -->
            <tr>
              <td style="color: #0f172a; font-size: 15px; line-height: 1.6; text-align: left;">
                ${contentHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Footer with MitFloww icon logo, copyright and year -->
    ${getEmailBrandFooterHtml()}
  </body>
</html>
  `.trim();
}

export class EmailService {
  private apiKey: string;
  private defaultFrom: string;

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY || "";
    this.defaultFrom =
      process.env.EMAIL_FROM ||
      process.env.RESEND_FROM_EMAIL ||
      "MitFloww <notifications@mitfloww.com>";
  }

  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    if (!this.apiKey) {
      if (process.env.NODE_ENV !== "production") {
        logger.info(`[EmailService:DevMock] Dispatching email to ${options.to} | Subject: "${options.subject}"`);
        return true;
      }
      logger.warn("[EmailService] RESEND_API_KEY is not configured in production. Email dropped.", {
        to: options.to,
        subject: options.subject,
      });
      return false;
    }

    try {
      const attachments = [...(options.attachments || [])];

      // Automatically attach dark-mode safe MitFloww logo if referenced as CID
      if (
        options.html.includes("cid:mitfloww-logo") &&
        !attachments.some(
          (a) => a.contentId === "mitfloww-logo" || a.content_id === "mitfloww-logo",
        )
      ) {
        attachments.push(getEmailLogoAttachment());
      }

      // Automatically attach MitFloww icon mark if referenced as CID
      if (
        options.html.includes("cid:mitfloww-icon") &&
        !attachments.some(
          (a) => a.contentId === "mitfloww-icon" || a.content_id === "mitfloww-icon",
        )
      ) {
        attachments.push(getEmailIconAttachment());
      }

      const formattedAttachments = attachments.map((att) => ({
        filename: att.filename,
        content: Buffer.isBuffer(att.content) ? att.content.toString("base64") : att.content,
        content_id: att.content_id || att.contentId,
        contentId: att.contentId || att.content_id,
        contentType: att.contentType,
      }));

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.defaultFrom,
          to: [options.to],
          subject: options.subject,
          html: options.html,
          text: options.text,
          ...(formattedAttachments.length > 0 ? { attachments: formattedAttachments } : {}),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("[EmailService] Failed to send email via Resend", {
          status: response.status,
          error: errorText,
          to: options.to,
        });
        return false;
      }

      return true;
    } catch (err) {
      logger.error("[EmailService] Network exception sending email", { error: err, to: options.to });
      return false;
    }
  }

  async sendPlanExpiringSoonEmail(params: {
    userEmail: string;
    userName?: string | null;
    planName: string;
    daysRemaining: number;
    expiryDateFormatted: string;
    renewUrl: string;
  }): Promise<boolean> {
    const greetingName = params.userName ? ` ${params.userName}` : "";
    const subject = `Your MitFloww ${params.planName} plan expires in ${params.daysRemaining} days`;

    const contentHtml = `
      <h2 style="font-size: 20px; font-weight: 700; color: #d97706; margin-top: 0;">
        Your Subscription Is Expiring Soon
      </h2>
      <p style="font-size: 14px; line-height: 1.6; color: #475569;">
        Hello${greetingName}, your <strong>${params.planName}</strong> plan will expire on <strong>${params.expiryDateFormatted}</strong> (${params.daysRemaining} days remaining).
      </p>
      <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 16px 20px; margin: 20px 0;">
        <p style="font-size: 13px; color: #92400e; margin: 0; line-height: 1.5;">
          Renew or upgrade your subscription to keep uninterrupted access to active client links, expanded storage capacity, and monthly credits.
        </p>
      </div>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${params.renewUrl}" class="btn">
          Renew Subscription &rarr;
        </a>
      </div>
    `;

    return await this.sendEmail({
      to: params.userEmail,
      subject,
      html: wrapEmailHtml(contentHtml),
      text: `Hello${greetingName},\n\nYour MitFloww ${params.planName} plan expires on ${params.expiryDateFormatted} (${params.daysRemaining} days remaining).\n\nRenew your subscription here: ${params.renewUrl}`,
    });
  }

  async sendPlanExpiredEmail(params: {
    userEmail: string;
    userName?: string | null;
    planName: string;
    renewUrl: string;
  }): Promise<boolean> {
    const greetingName = params.userName ? ` ${params.userName}` : "";
    const subject = `Your MitFloww ${params.planName} plan has expired`;

    const contentHtml = `
      <h2 style="font-size: 20px; font-weight: 700; color: #dc2626; margin-top: 0;">
        Plan Expired & Downgraded to Free
      </h2>
      <p style="font-size: 14px; line-height: 1.6; color: #475569;">
        Hello${greetingName}, your <strong>${params.planName}</strong> plan has reached its expiration date and your account has been downgraded to the Free tier.
      </p>
      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px 20px; margin: 20px 0;">
        <p style="font-size: 13px; color: #991b1b; margin: 0; line-height: 1.5;">
          <strong>Your existing uploaded files are completely safe and preserved.</strong> However, you cannot upload new files if your stored data exceeds the Free tier limit until storage is cleaned or your plan is upgraded.
        </p>
      </div>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${params.renewUrl}" class="btn">
          Upgrade to Restore Benefits &rarr;
        </a>
      </div>
    `;

    return await this.sendEmail({
      to: params.userEmail,
      subject,
      html: wrapEmailHtml(contentHtml),
      text: `Hello${greetingName},\n\nYour MitFloww ${params.planName} plan has expired. Your account has returned to the Free tier. Existing files are safe, but new uploads require maintaining storage within your plan.\n\nRenew now: ${params.renewUrl}`,
    });
  }

  async sendPlanExpiredFollowupEmail(params: {
    userEmail: string;
    userName?: string | null;
    planName: string;
    renewUrl: string;
  }): Promise<boolean> {
    const greetingName = params.userName ? ` ${params.userName}` : "";
    const subject = `Restore your MitFloww ${params.planName} benefits`;

    const contentHtml = `
      <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0;">
        We miss you on ${params.planName}
      </h2>
      <p style="font-size: 14px; line-height: 1.6; color: #475569;">
        Hello${greetingName}, your MitFloww subscription ended yesterday. We'd love to have you back!
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #475569;">
        Upgrade anytime to restore your monthly credits, expanded storage limits, watermark removal, and custom invoice templates.
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${params.renewUrl}" class="btn">
          Reactivate ${params.planName} &rarr;
        </a>
      </div>
    `;

    return await this.sendEmail({
      to: params.userEmail,
      subject,
      html: wrapEmailHtml(contentHtml),
      text: `Hello${greetingName},\n\nYour MitFloww subscription ended recently. Re-activate anytime to restore full benefits: ${params.renewUrl}`,
    });
  }
}

export const emailService = new EmailService();

