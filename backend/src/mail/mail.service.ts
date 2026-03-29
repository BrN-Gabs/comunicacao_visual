import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

type SendPasswordResetEmailParams = {
  to: string;
  userName: string;
  resetUrl: string;
  expiresInLabel: string;
};

@Injectable()
export class AppMailService {
  private readonly transporter: Transporter | null;
  private readonly fromAddress: string | null;

  constructor(private readonly configService: ConfigService) {
    const service = this.getTrimmedConfig('SMTP_SERVICE');
    const host = this.getTrimmedConfig('SMTP_HOST');
    const port = Number(this.configService.get<string>('SMTP_PORT') ?? '587');
    const secure = this.parseBoolean(
      this.configService.get<string>('SMTP_SECURE'),
      port === 465,
    );
    const user = this.getTrimmedConfig('SMTP_USER');
    const pass = this.getTrimmedConfig('SMTP_PASS');
    const fromAddress = this.getTrimmedConfig('SMTP_FROM') ?? user;

    this.fromAddress = fromAddress;

    if (!fromAddress || (!service && !host)) {
      this.transporter = null;
      return;
    }

    const transportOptions: SMTPTransport.Options = service
      ? { service }
      : {
          host: host!,
          port,
          secure,
        };

    if (user && pass) {
      transportOptions.auth = {
        user,
        pass,
      };
    }

    this.transporter = nodemailer.createTransport(transportOptions);
  }

  assertConfigured() {
    if (!this.transporter || !this.fromAddress) {
      throw new ServiceUnavailableException(
        'Serviço de e-mail não configurado. Defina as variáveis SMTP no backend.',
      );
    }
  }

  async sendPasswordResetEmail({
    to,
    userName,
    resetUrl,
    expiresInLabel,
  }: SendPasswordResetEmailParams) {
    this.assertConfigured();

    await this.transporter!.sendMail({
      from: this.fromAddress!,
      to,
      subject: 'Recuperação de senha - Gazin Comunicações Visuais',
      text: [
        `Olá, ${userName}.`,
        '',
        'Recebemos uma solicitação para redefinir a sua senha.',
        'Acesse o link abaixo para criar uma nova senha:',
        resetUrl,
        '',
        `Esse link expira em ${expiresInLabel}.`,
        'Se voce não solicitou a recuperação, ignore este e-mail.',
      ].join('\n'),
      html: `
        <div style="font-family: Arial, Helvetica, sans-serif; color: #16315c; line-height: 1.6; padding: 24px; background: #f4f8ff;">
          <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #d8e4f6; border-radius: 24px; overflow: hidden;">
            <div style="padding: 28px 32px; background: linear-gradient(135deg, #173a73 0%, #0c2044 100%); color: #edf4ff;">
              <p style="margin: 0 0 8px; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase;">Gazin Comunicacoes Visuais</p>
              <h1 style="margin: 0; font-size: 28px; line-height: 1.15;">Redefina sua senha</h1>
            </div>
            <div style="padding: 28px 32px;">
              <p style="margin: 0 0 16px;">Olá, <strong>${this.escapeHtml(userName)}</strong>.</p>
              <p style="margin: 0 0 16px;">
                Recebemos uma solicitação para redefinir a sua senha no painel.
                Clique no botão abaixo para criar uma nova senha com segurança.
              </p>
              <p style="margin: 24px 0;">
                <a
                  href="${this.escapeHtml(resetUrl)}"
                  style="display: inline-block; padding: 14px 22px; border-radius: 14px; background: linear-gradient(135deg, #2f6fed 0%, #1f56c2 100%); color: #ffffff; text-decoration: none; font-weight: 700;"
                >
                  Redefinir senha
                </a>
              </p>
              <p style="margin: 0 0 16px;">
                Se preferir, copie e cole este link no navegador:
              </p>
              <p style="margin: 0 0 18px; word-break: break-all; color: #36588f;">
                ${this.escapeHtml(resetUrl)}
              </p>
              <p style="margin: 0 0 8px; color: #5b6f91;">
                Esse link expira em ${this.escapeHtml(expiresInLabel)}.
              </p>
              <p style="margin: 0; color: #5b6f91;">
                Se voce não solicitou a recuperação, ignore este e-mail.
              </p>
            </div>
          </div>
        </div>
      `,
    });
  }

  private getTrimmedConfig(key: string) {
    const value = this.configService.get<string>(key)?.trim();
    return value ? value : null;
  }

  private parseBoolean(value: string | undefined, fallback: boolean) {
    if (typeof value !== 'string') {
      return fallback;
    }

    const normalized = value.trim().toLowerCase();

    if (normalized === 'true') {
      return true;
    }

    if (normalized === 'false') {
      return false;
    }

    return fallback;
  }

  private escapeHtml(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
