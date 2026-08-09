import { Injectable, UnauthorizedException } from '@nestjs/common';
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
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';

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

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly auditService: AuditService,
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
    await this.recordAuth(
      AuditAction.LOGIN,
      'login',
      user.id,
      user.defaultTenantId,
      ctx,
      { email: user.email },
    );
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
    const { refreshToken } = await this.createSession(
      user.id,
      user.email,
      user.tenantId,
      session.familyId,
      ctx,
    );
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
      await this.recordAuth(
        AuditAction.LOGIN,
        'logout',
        payload.sub,
        payload.tenantId,
        ctx,
      );
    } catch {
      // idempotent: invalid or already-revoked tokens are ignored
    }
    return { success: true };
  }

  async me(userId: string): Promise<UserProfile> {
    return this.usersService.getProfile(userId);
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

  private async signAccess(
    userId: string,
    email: string,
    tenantId: string | null,
  ): Promise<string> {
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

  private async revokeFamily(familyId: string): Promise<void> {
    await this.sessionsRepo.update(
      { familyId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
