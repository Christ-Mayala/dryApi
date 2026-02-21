import { Injectable } from '@angular/core';
import { BaseApiService } from '@dry/sdk/services/base-api.service';
import { Categories } from '../models/categories.model';

@Injectable({ providedIn: 'root' })
export class CategoriesService extends BaseApiService<Categories> {
  protected resourcePath = '/categories';

  // Override baseUrl to target the SkillForge app instead of the current configured app
  protected override get baseUrl(): string {
    const rootApi = this.configService.apiUrl.replace(/\/[^\/]+$/, '');
    return `${rootApi}/skillforge${this.resourcePath}`;
  }
}
