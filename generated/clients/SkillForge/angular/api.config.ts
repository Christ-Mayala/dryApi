
import { InjectionToken } from '@angular/core';

export interface ApiConfig {
  baseUrl: string;
  tokenGetter?: () => string | null;
}

export const API_CONFIG = new InjectionToken<ApiConfig>('SkillForgeApiConfig');
