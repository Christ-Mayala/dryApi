import { Injectable } from '@angular/core';
import { BaseApiService } from '@dry/sdk/services/base-api.service';
import { Students } from '../models/students.model';

@Injectable({ providedIn: 'root' })
export class StudentsService extends BaseApiService<Students> {
  protected resourcePath = '/students';

  // Override baseUrl to target the SkillForge app instead of the current configured app
  protected override get baseUrl(): string {
    const rootApi = this.configService.apiUrl.replace(/\/[^\/]+$/, '');
    return `${rootApi}/skillforge${this.resourcePath}`;
  }
}
