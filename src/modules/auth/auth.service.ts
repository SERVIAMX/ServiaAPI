import { MailerService } from '@nestjs-modules/mailer';
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { LoginDto } from './dto/login.dto';
import { JwtAccessPayload, JwtRefreshPayload } from '../../common/interfaces/jwt-payload.interface';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mailer: MailerService,
    private readonly dataSource: DataSource,
  ) {}

  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
      relations: { client: true, role: true },
    });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Usuario inactivo');
    }
    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    const tokens = await this.issueTokens(user, ip, userAgent);
    return {
      ...tokens,
      user: this.sanitizeUser(user),
    };
  }

  async refresh(
    refreshTokenPlain: string,
    ip?: string,
    userAgent?: string,
  ) {
    let payload: JwtRefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(
        refreshTokenPlain,
        { secret: this.config.get<string>('JWT_REFRESH_SECRET', '') },
      );
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const rows = await this.refreshTokenRepository.find({
      where: {
        user: { id: payload.sub },
        isRevoked: 0,
        expiresAt: MoreThan(new Date()),
      },
      relations: { user: { client: true, role: true } },
      order: { id: 'DESC' },
    });

    let matched: RefreshToken | null = null;
    for (const row of rows) {
      const same = await bcrypt.compare(refreshTokenPlain, row.token);
      if (same) {
        matched = row;
        break;
      }
    }
    if (!matched?.user) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const user = matched.user;
    if (user.deletedAt || !user.isActive) {
      throw new UnauthorizedException('Usuario no disponible');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      matched.isRevoked = 1;
      await queryRunner.manager.save(RefreshToken, matched);

      const accessToken = await this.signAccessToken(user);
      const newRefreshPlain = await this.signRefreshToken(user.id);
      const expiresAt = this.refreshExpiresDate();
      const hashed = await bcrypt.hash(newRefreshPlain, 10);
      const newRow = queryRunner.manager.create(RefreshToken, {
        user,
        token: hashed,
        expiresAt,
        isRevoked: 0,
        ipAddress: ip ?? null,
        userAgent: userAgent ?? null,
      });
      await queryRunner.manager.save(RefreshToken, newRow);
      await queryRunner.commitTransaction();

      return {
        accessToken,
        refreshToken: newRefreshPlain,
        user: this.sanitizeUser(user),
      };
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async logout(userId: number, refreshTokenPlain: string) {
    const rows = await this.refreshTokenRepository.find({
      where: { user: { id: userId }, isRevoked: 0 },
    });
    for (const row of rows) {
      const same = await bcrypt.compare(refreshTokenPlain, row.token);
      if (same) {
        row.isRevoked = 1;
        await this.refreshTokenRepository.save(row);
        return { revoked: true };
      }
    }
    throw new BadRequestException('Refresh token no encontrado');
  }

  async forgotPassword(email: string) {
    const user = await this.userRepository.findOne({ where: { email } });
    if (user && !user.deletedAt) {
      const plain = uuidv4();
      const hash = await bcrypt.hash(plain, 10);
      user.resetPasswordToken = hash;
      user.resetPasswordExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await this.userRepository.save(user);

      const base = this.config.get<string>(
        'APP_FRONTEND_URL',
        'http://localhost:3001',
      );
      const link = `${base.replace(/\/$/, '')}/reset-password?token=${plain}`;

      try {
        await this.mailer.sendMail({
          to: email,
          subject: 'Restablecer contraseña — ServiaAPI',
          text: `Usa este enlace para restablecer tu contraseña (válido 1 hora): ${link}`,
          html: `<p>Restablece tu contraseña haciendo clic <a href="${link}">aquí</a>.</p><p>El enlace expira en 1 hora.</p>`,
        });
      } catch (err) {
        // No revelar fallo de correo al cliente
        console.error('Mailer error', err);
      }
    }
    return { ok: true };
  }

  async resetPassword(token: string, newPassword: string) {
    const users = await this.userRepository
      .createQueryBuilder('u')
      .where('u.resetPasswordToken IS NOT NULL')
      .andWhere('u.resetPasswordExpiresAt > :now', { now: new Date() })
      .getMany();

    let target: User | null = null;
    for (const u of users) {
      if (u.resetPasswordToken && (await bcrypt.compare(token, u.resetPasswordToken))) {
        target = u;
        break;
      }
    }
    if (!target) {
      throw new BadRequestException('Token inválido o expirado');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      target.password = await bcrypt.hash(newPassword, 10);
      target.resetPasswordToken = null;
      target.resetPasswordExpiresAt = null;
      await queryRunner.manager.save(User, target);

      await queryRunner.manager
        .createQueryBuilder()
        .update(RefreshToken)
        .set({ isRevoked: 1 })
        .where('userId = :id', { id: target.id })
        .execute();

      await queryRunner.commitTransaction();
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }

    return { ok: true };
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { client: true, role: true },
    });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException();
    }
    const ok = await bcrypt.compare(dto.currentPassword, user.password);
    if (!ok) {
      throw new BadRequestException('Contraseña actual incorrecta');
    }

    user.password = await bcrypt.hash(dto.newPassword, 10);
    await this.userRepository.save(user);

    const rows = await this.refreshTokenRepository.find({
      where: { user: { id: userId }, isRevoked: 0 },
    });

    for (const row of rows) {
      if (dto.currentRefreshToken) {
        const keep = await bcrypt.compare(dto.currentRefreshToken, row.token);
        if (keep) {
          continue;
        }
      }
      row.isRevoked = 1;
      await this.refreshTokenRepository.save(row);
    }

    return { ok: true };
  }

  private sanitizeUser(user: User) {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      isActive: user.isActive,
      isVerified: user.isVerified,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      clientId: user.client?.id,
      roleId: user.role?.id,
    };
  }

  private async issueTokens(user: User, ip?: string, userAgent?: string) {
    const accessToken = await this.signAccessToken(user);
    const refreshToken = await this.signRefreshToken(user.id);
    const expiresAt = this.refreshExpiresDate();
    const hashed = await bcrypt.hash(refreshToken, 10);
    await this.refreshTokenRepository.save(
      this.refreshTokenRepository.create({
        user,
        token: hashed,
        expiresAt,
        isRevoked: 0,
        ipAddress: ip ?? null,
        userAgent: userAgent ?? null,
      }),
    );
    return { accessToken, refreshToken };
  }

  private async signAccessToken(user: User) {
    if (!user.role?.id || !user.client?.id) {
      throw new UnauthorizedException('Usuario sin rol o cliente asignado');
    }
    const payload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      roleId: user.role.id,
      clientId: user.client.id,
      type: 'access',
    };
    return this.jwtService.signAsync(payload, {
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
    });
  }

  private async signRefreshToken(userId: number) {
    const payload: JwtRefreshPayload = { sub: userId, type: 'refresh' };
    return this.jwtService.signAsync(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET', ''),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    });
  }

  private refreshExpiresDate(): Date {
    const raw = this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d').trim();
    const m = /^(\d+)([dhms])$/i.exec(raw);
    if (!m) {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
    const n = parseInt(m[1], 10);
    const u = m[2].toLowerCase();
    let ms = 0;
    if (u === 'd') ms = n * 86400000;
    else if (u === 'h') ms = n * 3600000;
    else if (u === 'm') ms = n * 60000;
    else if (u === 's') ms = n * 1000;
    return new Date(Date.now() + ms);
  }
}
