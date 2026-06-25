import { config } from './env.config.js';

export const jwtConfig = {
  accessSecret: config.JWT_ACCESS_SECRET,
  refreshSecret: config.JWT_REFRESH_SECRET,
  accessExpiration: config.JWT_ACCESS_EXPIRATION,
  refreshExpiration: config.JWT_REFRESH_EXPIRATION,
};
