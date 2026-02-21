import { Injectable } from '@angular/core';
import { BaseApiService } from '@dry/sdk/services/base-api.service';
import { Courses } from '../models/courses.model';

@Injectable({ providedIn: 'root' })
export class CoursesService extends BaseApiService<Courses> {
  protected resourcePath = '/courses';

  // Override baseUrl to target the SkillForge app instead of the current configured app
  protected override get baseUrl(): string {
    const rootApi = this.configService.apiUrl.replace(/\/[^\/]+$/, '');
    return `${rootApi}/skillforge${this.resourcePath}`;
  }
}
