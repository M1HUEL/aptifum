import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Ip, Patch, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { getEnv } from '@aptifum/config';
import { AuthUser, ModuleName, permission } from '@aptifum/core';
import { AuthService, RequestContext } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/forgot-password.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const loginThrottleLimit = getEnv().LOGIN_THROTTLE_LIMIT;

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
  @Throttle({ default: { limit: loginThrottleLimit, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  login(@Body() dto: LoginDto, @Ip() ip?: string, @Headers('user-agent') userAgent?: string, @Req() req?: Request) {
    return this.authService.login(dto, this.context(ip, userAgent, req));
  }

  @Post('refresh')
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate access/refresh tokens' })
  refresh(@Body() dto: RefreshDto, @Ip() ip?: string, @Headers('user-agent') userAgent?: string, @Req() req?: Request) {
    return this.authService.refresh(dto, this.context(ip, userAgent, req));
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the refresh token family' })
  logout(@Body() dto: LogoutDto, @Ip() ip?: string, @Req() req?: Request) {
    return this.authService.logout(dto, this.context(ip, undefined, req));
  }

  @Post('forgot-password')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset token (demo: returns the token)' })
  forgotPassword(@Body() dto: ForgotPasswordDto, @Ip() ip?: string, @Req() req?: Request) {
    return this.authService.requestPasswordReset(dto, this.context(ip, undefined, req));
  }

  @Post('reset-password')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a new password using a reset token' })
  resetPassword(@Body() dto: ResetPasswordDto, @Ip() ip?: string, @Req() req?: Request) {
    return this.authService.resetPassword(dto, this.context(ip, undefined, req));
  }

  @Post('invite')
  @RequirePermissions(permission(ModuleName.USERS, 'write'))
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invite a user by email (demo: returns the invite token)' })
  invite(
    @Body() dto: InviteUserDto,
    @Ip() ip?: string,
    @Headers('user-agent') userAgent?: string,
    @Req() req?: Request,
  ) {
    return this.authService.inviteUser(
      { email: dto.email, name: dto.name, roleIds: dto.roleIds },
      this.context(ip, userAgent, req),
    );
  }

  @Post('accept-invite')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a password and activate a user from an invite token' })
  acceptInvite(@Body() dto: AcceptInviteDto, @Ip() ip?: string, @Req() req?: Request) {
    return this.authService.acceptInvite(dto, this.context(ip, undefined, req));
  }

  @Get('me')
  @ApiOperation({ summary: 'Current user profile' })
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own profile (name, password)' })
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto, @Ip() ip?: string, @Req() req?: Request) {
    return this.authService.updateProfile(user.id, dto, this.context(ip, undefined, req));
  }

  private context(ip?: string, userAgent?: string, req?: Request): RequestContext {
    return {
      ip,
      userAgent,
      requestId: (req as unknown as { requestId?: string })?.requestId,
    };
  }
}
