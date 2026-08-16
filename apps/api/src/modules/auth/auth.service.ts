import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import ms from 'ms';
import type { StringValue } from 'ms';
import { In, IsNull, LessThan, Repository } from 'typeorm';
import { AuditAction, RoleName, UserProfile } from '@aptifum/core';
import { DEFAULT_TENANT_ID, RefreshSession } from '@aptifum/database';
import { ConfigService } from '../../config/config.module';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/forgot-password.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends TokenPair {
  user: UserProfile;
}

export interface RequestContext {
  ip?: string;
  userAgent?: string;
  requestId?: string;
}

interface AccessTokenPayload {
  sub: string;
  email: string;
  tenantId: string | null;
}

interface RefreshTokenPayload extends AccessTokenPayload {
  jti: string;
}

interface SignedTokenPayload {
  sub: string;
  type: 'password_reset' | 'invite';
  jti: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
    @InjectRepository(RefreshSession)
    private readonly sessionsRepo: Repository<RefreshSession>,
  ) {}

  async register(dto: RegisterDto, ctx?: RequestContext): Promise<AuthResult> {
    const user = await this.usersService.create({
      email: dto.email,
      password: dto.password,
      name: dto.name,
      tenantId: DEFAULT_TENANT_ID,
      roleName: RoleName.SELLER,
    });
    await this.recordAuth(AuditAction.LOGIN, 'register', user.id, user.tenantId, ctx);
    return this.issueTokens(user.id, user.email, user.tenantId, ctx);
  }

  async login(dto: LoginDto, ctx?: RequestContext): Promise<AuthResult> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    if (!user || !user.active) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.recordAuth(AuditAction.LOGIN, 'login', user.id, user.defaultTenantId, ctx, { email: user.email });
    return this.issueTokens(user.id, user.email, user.defaultTenantId, ctx);
  }

  async refresh(dto: RefreshDto, ctx?: RequestContext): Promise<AuthResult> {
    const payload = await this.verifyRefreshToken(dto.refreshToken);
    const user = await this.usersService.getProfile(payload.sub).catch(() => null);
    if (!user || !user.active) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = await this.sessionsRepo.findOneBy({ id: payload.jti });
    if (!session || session.revokedAt) {
      if (session?.familyId) {
        await this.revokeFamily(session.familyId);
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (this.hashToken(dto.refreshToken) !== session.tokenHash) {
      await this.revokeFamily(session.familyId);
      throw new UnauthorizedException('Invalid refresh token');
    }

    session.revokedAt = new Date();
    await this.sessionsRepo.save(session);
    const { refreshToken } = await this.createSession(user.id, user.email, user.tenantId, session.familyId, ctx);
    const accessToken = await this.signAccess(user.id, user.email, user.tenantId);
    return { accessToken, refreshToken, user };
  }

  async logout(dto: LogoutDto, ctx?: RequestContext): Promise<{ success: boolean }> {
    try {
      const payload = await this.verifyRefreshToken(dto.refreshToken);
      const session = await this.sessionsRepo.findOneBy({ id: payload.jti });
      if (session && !session.revokedAt) {
        await this.revokeFamily(session.familyId);
      }
      await this.recordAuth(AuditAction.LOGIN, 'logout', payload.sub, payload.tenantId, ctx);
    } catch {
      // idempotent: invalid or already-revoked tokens are ignored
    }
    return { success: true };
  }

  async me(userId: string): Promise<UserProfile> {
    return this.usersService.getProfile(userId);
  }

  async requestPasswordReset(
    dto: ForgotPasswordDto,
    ctx?: RequestContext,
  ): Promise<{ sent: boolean; resetToken: string | null }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.active) {
      return { sent: true, resetToken: null };
    }
    const payload: SignedTokenPayload = { sub: user.id, type: 'password_reset', jti: randomUUID() };
    const resetToken = await this.jwtService.signAsync(payload, {
      secret: this.config.env.JWT_ACCESS_SECRET,
      expiresIn: this.config.env.PASSWORD_RESET_TTL as StringValue,
    });
    await this.recordAuth(AuditAction.UPDATE, 'password-reset-request', user.id, user.defaultTenantId, ctx);
    if (this.emailService.isConfigured()) {
      try {
        await this.sendPasswordResetEmail(user, resetToken);
        return { sent: true, resetToken: null };
      } catch (error) {
        console.error('Failed to send password reset email', error);
      }
    }
    return { sent: true, resetToken };
  }

  private async sendPasswordResetEmail(
    user: { email: string; name?: string | null },
    resetToken: string,
  ): Promise<void> {
    const link = `${this.config.env.APP_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;
    await this.emailService.sendMail({
      to: user.email,
      subject: 'Reset your Aptifum password',
      html: `<p>Hi ${user.name ?? 'there'},</p>
<p>We received a request to reset your Aptifum password.</p>
<p><a href="${link}">Click here to reset your password</a></p>
<p>This link expires in ${this.config.env.PASSWORD_RESET_TTL}. If you did not request this, you can ignore this email.</p>`,
    });
  }

  async resetPassword(dto: ResetPasswordDto, ctx?: RequestContext): Promise<{ success: boolean }> {
    const payload = await this.verifyPasswordResetToken(dto.token);
    const user = await this.usersService.getProfile(payload.sub).catch(() => null);
    if (!user || !user.active) {
      throw new BadRequestException('Invalid or expired reset token');
    }
    await this.usersService.setPassword(user.id, dto.newPassword);
    await this.sessionsRepo.update({ userId: user.id, revokedAt: IsNull() }, { revokedAt: new Date() });
    await this.recordAuth(AuditAction.UPDATE, 'password-reset', user.id, user.tenantId, ctx);
    return { success: true };
  }

  async inviteUser(
    input: { email: string; name?: string; roleIds?: string[] },
    ctx?: RequestContext,
  ): Promise<{ user: UserProfile; inviteToken: string | null }> {
    const user = await this.usersService.create({
      email: input.email,
      name: input.name,
      roleIds: input.roleIds,
      tenantId: DEFAULT_TENANT_ID,
    });
    const payload: SignedTokenPayload = { sub: user.id, type: 'invite', jti: randomUUID() };
    const inviteToken = await this.jwtService.signAsync(payload, {
      secret: this.config.env.JWT_ACCESS_SECRET,
      expiresIn: this.config.env.INVITE_TTL as StringValue,
    });
    await this.recordAuth(AuditAction.UPDATE, 'user-invite', user.id, user.tenantId, ctx);
    if (this.emailService.isConfigured()) {
      try {
        await this.sendInviteEmail(user, inviteToken);
        return { user, inviteToken: null };
      } catch (error) {
        console.error('Failed to send invite email', error);
      }
    }
    return { user, inviteToken };
  }

  private async sendInviteEmail(user: UserProfile, inviteToken: string): Promise<void> {
    const link = `${this.config.env.APP_URL}/accept-invite?token=${encodeURIComponent(inviteToken)}`;
    await this.emailService.sendMail({
      to: user.email,
      subject: `You've been invited to Aptifum`,
      html: `<p>Hi ${user.name ?? 'there'},</p>
<p>You've been invited to join Aptifum.</p>
<p><a href="${link}">Accept your invitation</a></p>
<p>This invite expires in ${this.config.env.INVITE_TTL}.</p>`,
    });
  }

  async acceptInvite(dto: AcceptInviteDto, ctx?: RequestContext): Promise<{ success: boolean }> {
    const payload = await this.verifySignedToken(dto.token, 'invite');
    const user = await this.usersService.getProfile(payload.sub).catch(() => null);
    if (!user || !user.active) {
      throw new BadRequestException('Invalid or expired invite token');
    }
    await this.usersService.setPassword(user.id, dto.newPassword);
    await this.sessionsRepo.update({ userId: user.id, revokedAt: IsNull() }, { revokedAt: new Date() });
    await this.recordAuth(AuditAction.UPDATE, 'invite-accepted', user.id, user.tenantId, ctx);
    return { success: true };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto, ctx?: RequestContext): Promise<UserProfile> {
    if (dto.name !== undefined && dto.name.trim()) {
      await this.usersService.updateName(userId, dto.name.trim());
    }
    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Current password is required');
      }
      await this.usersService.changePassword(userId, dto.currentPassword, dto.newPassword);
    }
    const profile = await this.usersService.getProfile(userId);
    await this.auditService.record({
      tenantId: profile.tenantId,
      userId,
      module: 'auth',
      entity: 'profile',
      entityId: null,
      action: AuditAction.UPDATE,
      after: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        passwordChanged: Boolean(dto.newPassword),
      },
      requestId: ctx?.requestId ?? null,
      ip: ctx?.ip ?? null,
    });
    return profile;
  }

  private async recordAuth(
    action: AuditAction,
    entity: string,
    userId: string,
    tenantId: string | null,
    ctx?: RequestContext,
    after?: unknown,
  ): Promise<void> {
    await this.auditService.record({
      tenantId,
      userId,
      module: 'auth',
      entity,
      entityId: null,
      action,
      after,
      requestId: ctx?.requestId ?? null,
      ip: ctx?.ip ?? null,
    });
  }

  private async issueTokens(
    userId: string,
    email: string,
    tenantId: string | null,
    ctx?: RequestContext,
  ): Promise<AuthResult> {
    const { refreshToken } = await this.createSession(userId, email, tenantId, randomUUID(), ctx);
    const accessToken = await this.signAccess(userId, email, tenantId);
    const user = await this.usersService.getProfile(userId);
    return { accessToken, refreshToken, user };
  }

  private async signAccess(userId: string, email: string, tenantId: string | null): Promise<string> {
    const payload: AccessTokenPayload = { sub: userId, email, tenantId };
    return this.jwtService.signAsync(payload, {
      secret: this.config.env.JWT_ACCESS_SECRET,
      expiresIn: this.config.env.JWT_ACCESS_TTL as StringValue,
    });
  }

  private async createSession(
    userId: string,
    email: string,
    tenantId: string | null,
    familyId: string,
    ctx?: RequestContext,
  ): Promise<{ session: RefreshSession; refreshToken: string }> {
    const jti = randomUUID();
    const payload: RefreshTokenPayload = { sub: userId, email, tenantId, jti };
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.config.env.JWT_REFRESH_SECRET,
      expiresIn: this.config.env.JWT_REFRESH_TTL as StringValue,
    });
    const session = this.sessionsRepo.create({
      id: jti,
      userId,
      familyId,
      tokenHash: this.hashToken(refreshToken),
      ip: ctx?.ip ?? null,
      userAgent: ctx?.userAgent ?? null,
      expiresAt: new Date(Date.now() + ms(this.config.env.JWT_REFRESH_TTL as StringValue)),
    });
    await this.sessionsRepo.save(session);
    await this.pruneUserSessions(userId);
    return { session, refreshToken };
  }

  private async pruneUserSessions(userId: string): Promise<void> {
    const now = new Date();
    await this.sessionsRepo.delete({ userId, expiresAt: LessThan(now) });

    const maxActive = this.config.env.MAX_ACTIVE_SESSIONS_PER_USER;
    const active = await this.sessionsRepo.find({
      where: { userId, revokedAt: IsNull() },
      order: { createdAt: 'ASC' },
      select: { id: true },
    });
    if (active.length > maxActive) {
      const excess = active.length - maxActive;
      const toRevoke = active.slice(0, excess).map((session) => session.id);
      await this.sessionsRepo.update({ id: In(toRevoke) }, { revokedAt: now });
    }
  }

  private async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.config.env.JWT_REFRESH_SECRET,
      });
      if (!payload.jti) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async verifySignedToken(token: string, type: SignedTokenPayload['type']): Promise<SignedTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<SignedTokenPayload>(token, {
        secret: this.config.env.JWT_ACCESS_SECRET,
      });
      if (payload.type !== type || !payload.jti) {
        throw new BadRequestException('Invalid or expired token');
      }
      return payload;
    } catch {
      throw new BadRequestException('Invalid or expired token');
    }
  }

  private verifyPasswordResetToken(token: string): Promise<SignedTokenPayload> {
    return this.verifySignedToken(token, 'password_reset');
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.sessionsRepo.update({ familyId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
