import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Ip, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthUser } from '@aptifum/core';
import { AuthService, RequestContext } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a user (demo: demo tenant + seller role)' })
  register(
    @Body() dto: RegisterDto,
    @Ip() ip?: string,
    @Headers('user-agent') userAgent?: string,
    @Req() req?: Request,
  ) {
    return this.authService.register(dto, this.context(ip, userAgent, req));
  }

  @Post('login')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  login(
    @Body() dto: LoginDto,
    @Ip() ip?: string,
    @Headers('user-agent') userAgent?: string,
    @Req() req?: Request,
  ) {
    return this.authService.login(dto, this.context(ip, userAgent, req));
  }

  @Post('refresh')
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate access/refresh tokens' })
  refresh(
    @Body() dto: RefreshDto,
    @Ip() ip?: string,
    @Headers('user-agent') userAgent?: string,
    @Req() req?: Request,
  ) {
    return this.authService.refresh(dto, this.context(ip, userAgent, req));
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the refresh token family' })
  logout(@Body() dto: LogoutDto, @Ip() ip?: string, @Req() req?: Request) {
    return this.authService.logout(dto, this.context(ip, undefined, req));
  }

  @Get('me')
  @ApiOperation({ summary: 'Current user profile' })
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.id);
  }

  private context(ip?: string, userAgent?: string, req?: Request): RequestContext {
    return {
      ip,
      userAgent,
      requestId: (req as unknown as { requestId?: string })?.requestId,
    };
  }
}
