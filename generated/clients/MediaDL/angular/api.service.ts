// Client Angular - DRY
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl =
    (typeof (globalThis as any) !== 'undefined' && (globalThis as any).API_BASE_URL) ||
    'http://localhost:5000';

  constructor(private http: HttpClient) {}

  private authHeaders(token?: string) {
    return token
      ? { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
      : {};
  }

  
  batchesList(token?: string) {
    return this.http.get(`${this.baseUrl}/api/v1/mediadl/batches`, this.authHeaders(token));
  }
  batchesCreate(data: any, token?: string) {
    return this.http.post(`${this.baseUrl}/api/v1/mediadl/batches`, data, this.authHeaders(token));
  }
  batchesGet(id: string, token?: string) {
    return this.http.get(`${this.baseUrl}/api/v1/mediadl/batches/:id`.replace(':id', id), this.authHeaders(token));
  }
  batchesUpdate(id: string, data: any, token?: string) {
    return this.http.put(`${this.baseUrl}/api/v1/mediadl/batches/:id`.replace(':id', id), data, this.authHeaders(token));
  }
  batchesRemove(id: string, token?: string) {
    return this.http.delete(`${this.baseUrl}/api/v1/mediadl/batches/:id`.replace(':id', id), this.authHeaders(token));
  }

  downloadsList(token?: string) {
    return this.http.get(`${this.baseUrl}/api/v1/mediadl/downloads`, this.authHeaders(token));
  }
  downloadsCreate(data: any, token?: string) {
    return this.http.post(`${this.baseUrl}/api/v1/mediadl/downloads`, data, this.authHeaders(token));
  }
  downloadsGet(id: string, token?: string) {
    return this.http.get(`${this.baseUrl}/api/v1/mediadl/downloads/:id`.replace(':id', id), this.authHeaders(token));
  }
  downloadsUpdate(id: string, data: any, token?: string) {
    return this.http.put(`${this.baseUrl}/api/v1/mediadl/downloads/:id`.replace(':id', id), data, this.authHeaders(token));
  }
  downloadsRemove(id: string, token?: string) {
    return this.http.delete(`${this.baseUrl}/api/v1/mediadl/downloads/:id`.replace(':id', id), this.authHeaders(token));
  }

  presetsList(token?: string) {
    return this.http.get(`${this.baseUrl}/api/v1/mediadl/presets`, this.authHeaders(token));
  }
  presetsCreate(data: any, token?: string) {
    return this.http.post(`${this.baseUrl}/api/v1/mediadl/presets`, data, this.authHeaders(token));
  }
  presetsGet(id: string, token?: string) {
    return this.http.get(`${this.baseUrl}/api/v1/mediadl/presets/:id`.replace(':id', id), this.authHeaders(token));
  }
  presetsUpdate(id: string, data: any, token?: string) {
    return this.http.put(`${this.baseUrl}/api/v1/mediadl/presets/:id`.replace(':id', id), data, this.authHeaders(token));
  }
  presetsRemove(id: string, token?: string) {
    return this.http.delete(`${this.baseUrl}/api/v1/mediadl/presets/:id`.replace(':id', id), this.authHeaders(token));
  }
}
