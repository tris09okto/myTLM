import type { RowDataPacket } from "mysql2";

export interface MobileUser {
  id: string;
  username: string;
  role: string;
  jabatan: string;
}

export interface MobileSession {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  user: MobileUser;
}

export interface RefreshTokenRow extends RowDataPacket {
  id: string;
  user_id: number;
  expires_at: Date;
  revoked_at: Date | null;
}

export interface MobileUserRow extends RowDataPacket {
  id: number;
  username: string;
  role: string;
  jabatan: string;
}
