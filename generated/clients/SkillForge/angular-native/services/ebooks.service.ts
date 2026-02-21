import { Injectable } from '@angular/core';
import { BaseApiService } from '@dry/sdk/services/base-api.service';
import { Ebooks } from '../models/ebooks.model';

@Injectable({ providedIn: 'root' })
export class EbooksService extends BaseApiService<Ebooks> {
  protected resourcePath = '/ebooks';

  // Override baseUrl to target the SkillForge app instead of the current configured app
  protected override get baseUrl(): string {
    const rootApi = this.configService.apiUrl.replace(/\/[^\/]+$/, '');
    return `${rootApi}/skillforge${this.resourcePath}`;
  }
}
