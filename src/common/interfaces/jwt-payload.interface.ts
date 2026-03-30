export interface JwtAccessPayload {
  sub: number;
  email: string;
  roleId: number;
  clientId: number;
  type: 'access';
}

export interface JwtRefreshPayload {
  sub: number;
  type: 'refresh';
}
