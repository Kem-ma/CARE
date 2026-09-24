const env = import.meta.env;

// All of these come from the values `cdk deploy` prints. They are public identifiers, not secrets.
export const config = {
  apiUrl: (env.VITE_API_URL || '').replace(/\/+$/, ''),
  wsUrl: env.VITE_WS_URL || '',
  citizen: { poolId: env.VITE_CITIZEN_POOL_ID || '', clientId: env.VITE_CITIZEN_CLIENT_ID || '' },
  admin: { poolId: env.VITE_ADMIN_POOL_ID || '', clientId: env.VITE_ADMIN_CLIENT_ID || '' },
};

export const isConfigured = Boolean(
  config.apiUrl && config.citizen.poolId && config.citizen.clientId,
);
export const isAdminConfigured = Boolean(
  config.apiUrl && config.wsUrl && config.admin.poolId && config.admin.clientId,
);

// Shown on the landing page. Confirm the real number before launch.
export const EMERGENCY_NUMBER = '117';
