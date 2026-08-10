import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { ConfigService } from '../../config/config.module';

export interface EmailMessage {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

@Injectable()
export class EmailService {
  private readonly transporter: Transporter | null;

  constructor(private readonly config: ConfigService) {
    this.transporter = config.env.SMTP_HOST
      ? nodemailer.createTransport({
          host: config.env.SMTP_HOST,
          port: config.env.SMTP_PORT,
          secure: config.env.SMTP_PORT === 465,
          auth: config.env.SMTP_USER
            ? { user: config.env.SMTP_USER, pass: config.env.SMTP_PASS }
            : undefined,
        })
      : null;
  }

  isConfigured(): boolean {
    return this.transporter !== null;
  }

  async sendMail(message: EmailMessage): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }
    const from = this.config.env.SMTP_FROM_NAME
      ? `"${this.config.env.SMTP_FROM_NAME}" <${this.config.env.SMTP_FROM_EMAIL}>`
      : this.config.env.SMTP_FROM_EMAIL;
    await this.transporter.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return true;
  }
}
