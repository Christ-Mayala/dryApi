import { Injectable } from '@angular/core';
import { BaseApiService } from '@dry/sdk/services/base-api.service';
import { Orders } from '../models/orders.model';

@Injectable({ providedIn: 'root' })
export class OrdersService extends BaseApiService<Orders> {
  protected resourcePath = '/orders';

  // Override baseUrl to target the SkillForge app instead of the current configured app
  protected override get baseUrl(): string {
    const rootApi = this.configService.apiUrl.replace(/\/[^\/]+$/, '');
    return `${rootApi}/skillforge${this.resourcePath}`;
  }
}
