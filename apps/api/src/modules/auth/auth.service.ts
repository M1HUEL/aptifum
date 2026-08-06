import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { StringValue } from 'ms';
import { RoleName, UserProfile } from '@aptifum/core';
import { DEFAULT_TENANT_ID } from '@aptifum/database';
import { ConfigService } from '../../config/config.module';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends TokenPair {
  user: UserProfile;
}

interface TokenPayload {
  sub: string;
  email: string;
  tenantId: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const user = await this.usersService.create({
      email: dto.email,
      password: dto.password,
      name: dto.name,
      tenantId: DEFAULT_TENANT_ID,
      roleName: RoleName.SELLER,
    });
    return this.issueTokens(user.id, user.email, user.defaultTenantId);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    if (!user || !user.active) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueTokens(user.id, user.email, user.defaultTenantId);
  }

  async refresh(dto: RefreshDto): Promise<TokenPair> {
    try {
      const payload = await this.jwtService.verifyAsync<TokenPayload>(dto.refreshToken, {
        secret: this.config.env.JWT_REFRESH_SECRET,
      });
      const user = await this.usersService.getProfile(payload.sub);
      if (!user.active) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      return this.issueTokens(payload.sub, payload.email, payload.tenantId ?? null);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async me(userId: string): Promise<UserProfile> {
    return this.usersService.getProfile(userId);
  }

  private async issueTokens(
    userId: string,
    email: string,
    tenantId: string | null,
  ): Promise<AuthResult> {
    const payload: TokenPayload = { sub: userId, email, tenantId };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.env.JWT_ACCESS_SECRET,
        expiresIn: this.config.env.JWT_ACCESS_TTL as StringValue,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.env.JWT_REFRESH_SECRET,
        expiresIn: this.config.env.JWT_REFRESH_TTL as StringValue,
      }),
    ]);
    const user = await this.usersService.getProfile(userId);
    return { accessToken, refreshToken, user };
  }
}
