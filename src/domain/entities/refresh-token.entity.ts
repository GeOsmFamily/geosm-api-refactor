export interface RefreshTokenProps {
  id: string;
  token: string;
  userId: string;
  family: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByToken: string | null;
  createdAt: Date;
}

export class RefreshToken {
  readonly id: string;
  readonly token: string;
  readonly userId: string;
  readonly family: string;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly replacedByToken: string | null;
  readonly createdAt: Date;

  constructor(props: RefreshTokenProps) {
    this.id = props.id;
    this.token = props.token;
    this.userId = props.userId;
    this.family = props.family;
    this.expiresAt = props.expiresAt;
    this.revokedAt = props.revokedAt;
    this.replacedByToken = props.replacedByToken;
    this.createdAt = props.createdAt;
  }

  get isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  get isRevoked(): boolean {
    return this.revokedAt !== null;
  }

  get isValid(): boolean {
    return !this.isExpired && !this.isRevoked;
  }
}
