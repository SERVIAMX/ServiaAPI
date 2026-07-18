import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtAccessPayload } from '../../common/interfaces/jwt-payload.interface';

export type BitacoraCreatedPayload = {
  id: number;
  fhRegister: Date;
  operationType: string;
  operationLabel: string;
  status: string;
  clientId: number | null;
  cliente: string | null;
  userId: number | null;
  referenceId: string | null;
  amount: string | null;
  requestPayload: unknown | null;
  responsePayload: unknown | null;
  message: string | null;
};

@WebSocketGateway({
  namespace: '/bitacora',
  /** Path del engine Socket.IO (no confundir con el namespace). Bajo `/api` para proxies típicos. */
  path: '/api/socket.io',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class BitacoraGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(BitacoraGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(@ConnectedSocket() client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) {
        this.logger.warn(`WS bitacora: sin token (${client.id})`);
        client.emit('bitacora:error', { message: 'Token requerido' });
        client.disconnect(true);
        return;
      }

      const payload = await this.jwtService.verifyAsync<JwtAccessPayload>(token);
      if (payload.type !== 'access') {
        client.emit('bitacora:error', { message: 'Token inválido' });
        client.disconnect(true);
        return;
      }

      client.data.user = {
        userId: payload.sub,
        email: payload.email,
        roleId: payload.roleId,
        clientId: payload.clientId,
      };

      this.logger.log(
        `WS bitacora conectado: client=${client.id} userId=${payload.sub}`,
      );
      client.emit('bitacora:connected', { ok: true });
    } catch (err) {
      this.logger.warn(
        `WS bitacora: auth fallida (${client.id}): ${err instanceof Error ? err.message : err}`,
      );
      client.emit('bitacora:error', { message: 'No autorizado' });
      client.disconnect(true);
    }
  }

  handleDisconnect(@ConnectedSocket() client: Socket): void {
    this.logger.log(`WS bitacora desconectado: ${client.id}`);
  }

  /** Emite un nuevo registro de bitácora a todos los clientes del namespace. */
  emitCreated(payload: BitacoraCreatedPayload): void {
    if (!this.server) return;
    this.server.emit('bitacora:created', payload);
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth as { token?: string } | undefined;
    if (auth?.token?.trim()) {
      return auth.token.trim().replace(/^Bearer\s+/i, '');
    }

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.trim()) {
      return header.trim().replace(/^Bearer\s+/i, '');
    }

    const q = client.handshake.query?.token;
    if (typeof q === 'string' && q.trim()) {
      return q.trim().replace(/^Bearer\s+/i, '');
    }
    if (Array.isArray(q) && typeof q[0] === 'string' && q[0].trim()) {
      return q[0].trim().replace(/^Bearer\s+/i, '');
    }

    return null;
  }
}
