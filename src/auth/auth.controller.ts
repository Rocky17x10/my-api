import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { EnvironmentVariables } from '../config/env.validation';
import {
  clearAuthCookies,
  CookieSettings,
  readCookie,
  REFRESH_COOKIE,
  setAuthCookies,
} from './auth-cookies';
import { AuthService, Session, SessionUser } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { SetActiveDto } from './dto/set-active.dto';
import { AllowPendingPasswordChange, JwtAuthGuard } from './jwt-auth.guard';
import type { AuthUser } from './jwt.strategy';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

@Controller('auth')
export class AuthController {
  private readonly cookies: CookieSettings;

  constructor(
    private readonly authService: AuthService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.cookies = {
      secure: config.get('NODE_ENV', { infer: true }) === 'production',
      accessTtlMinutes: config.get('JWT_ACCESS_TTL_MINUTES', { infer: true }),
    };
  }

  @Post('login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: SessionUser }> {
    return this.respond(res, await this.authService.login(dto.email, dto.password));
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: SessionUser }> {
    const token = readCookie(req, REFRESH_COOKIE);
    try {
      if (!token) throw new UnauthorizedException('Not logged in');
      return this.respond(res, await this.authService.refresh(token));
    } catch (error) {
      // A dead refresh cookie is useless to the browser; remove it.
      clearAuthCookies(res, this.cookies.secure);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(readCookie(req, REFRESH_COOKIE));
    clearAuthCookies(res, this.cookies.secure);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @AllowPendingPasswordChange()
  getProfile(@Req() req: AuthenticatedRequest) {
    return {
      message: 'You are authenticated!',
      user: req.user,
    };
  }

  @Patch('password')
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @AllowPendingPasswordChange()
  async changePassword(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: SessionUser }> {
    const session = await this.authService.changePassword(
      req.user,
      dto.currentPassword,
      dto.newPassword,
    );
    return this.respond(res, session);
  }

  @Post('users/:id/reset-password')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'admin')
  resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ temporaryPassword: string }> {
    return this.authService.resetPassword(req.user, id);
  }

  @Patch('users/:id/active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'admin')
  setActive(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetActiveDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ id: number; isActive: boolean }> {
    return this.authService.setActive(req.user, id, dto.active);
  }

  private respond(res: Response, session: Session): { user: SessionUser } {
    setAuthCookies(res, session, this.cookies);
    return { user: session.user };
  }
}
