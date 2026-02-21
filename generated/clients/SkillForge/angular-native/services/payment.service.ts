import { Injectable } from '@angular/core';
import { BaseApiService } from '@dry/sdk/services/base-api.service';


@Injectable({ providedIn: 'root' })
export class PaymentService extends BaseApiService<any> {
  protected resourcePath = '/payment';

  // Override baseUrl to target the SkillForge app instead of the current configured app
  protected override get baseUrl(): string {
    const rootApi = this.configService.apiUrl.replace(/\/[^\/]+$/, '');
    return `${rootApi}/skillforge${this.resourcePath}`;
  }
}
