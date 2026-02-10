const runtimeEnv = (window as any).__env || {};

export const environment = {
  apiBaseUrl: runtimeEnv.API_BASE_URL || 'http://localhost:5000',
  appSlug: 'mediadl'
};
