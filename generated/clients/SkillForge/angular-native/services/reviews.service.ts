import { Injectable } from '@angular/core';
import { BaseApiService } from '@dry/sdk/services/base-api.service';
import { Reviews } from '../models/reviews.model';

@Injectable({ providedIn: 'root' })
export class ReviewsService extends BaseApiService<Reviews> {
  protected resourcePath = '/reviews';

  // Override baseUrl to target the SkillForge app instead of the current configured app
  protected override get baseUrl(): string {
    const rootApi = this.configService.apiUrl.replace(/\/[^\/]+$/, '');
    return `${rootApi}/skillforge${this.resourcePath}`;
  }
}
