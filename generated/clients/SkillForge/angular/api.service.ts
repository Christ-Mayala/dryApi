// Client Angular - DRY
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

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

  
  // CATEGORIES
  categoriesList(token?: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/v1/skillforge/categories`, this.authHeaders(token));
  }
  categoriesCreate(data: any, token?: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/v1/skillforge/categories`, data, this.authHeaders(token));
  }
  categoriesGet(id: string, token?: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/v1/skillforge/categories/:id`.replace(':id', id), this.authHeaders(token));
  }
  categoriesUpdate(id: string, data: any, token?: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/v1/skillforge/categories/:id`.replace(':id', id), data, this.authHeaders(token));
  }
  categoriesRemove(id: string, token?: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/v1/skillforge/categories/:id`.replace(':id', id), this.authHeaders(token));
  }

  // COURSES
  coursesList(token?: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/v1/skillforge/courses`, this.authHeaders(token));
  }
  coursesCreate(data: any, token?: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/v1/skillforge/courses`, data, this.authHeaders(token));
  }
  coursesGet(id: string, token?: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/v1/skillforge/courses/:id`.replace(':id', id), this.authHeaders(token));
  }
  coursesUpdate(id: string, data: any, token?: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/v1/skillforge/courses/:id`.replace(':id', id), data, this.authHeaders(token));
  }
  coursesRemove(id: string, token?: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/v1/skillforge/courses/:id`.replace(':id', id), this.authHeaders(token));
  }

  // EBOOKS
  ebooksList(token?: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/v1/skillforge/ebooks`, this.authHeaders(token));
  }
  ebooksCreate(data: any, token?: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/v1/skillforge/ebooks`, data, this.authHeaders(token));
  }
  ebooksGet(id: string, token?: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/v1/skillforge/ebooks/:id`.replace(':id', id), this.authHeaders(token));
  }
  ebooksUpdate(id: string, data: any, token?: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/v1/skillforge/ebooks/:id`.replace(':id', id), data, this.authHeaders(token));
  }
  ebooksRemove(id: string, token?: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/v1/skillforge/ebooks/:id`.replace(':id', id), this.authHeaders(token));
  }

  // EXPORT
  exportList(token?: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/v1/skillforge/export`, this.authHeaders(token));
  }
  exportCreate(data: any, token?: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/v1/skillforge/export`, data, this.authHeaders(token));
  }
  exportGet(id: string, token?: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/v1/skillforge/export/:id`.replace(':id', id), this.authHeaders(token));
  }
  exportUpdate(id: string, data: any, token?: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/v1/skillforge/export/:id`.replace(':id', id), data, this.authHeaders(token));
  }
  exportRemove(id: string, token?: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/v1/skillforge/export/:id`.replace(':id', id), this.authHeaders(token));
  }

  // ORDERS
  ordersList(token?: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/v1/skillforge/orders`, this.authHeaders(token));
  }
  ordersCreate(data: any, token?: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/v1/skillforge/orders`, data, this.authHeaders(token));
  }
  ordersGet(id: string, token?: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/v1/skillforge/orders/:id`.replace(':id', id), this.authHeaders(token));
  }
  ordersUpdate(id: string, data: any, token?: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/v1/skillforge/orders/:id`.replace(':id', id), data, this.authHeaders(token));
  }
  ordersRemove(id: string, token?: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/v1/skillforge/orders/:id`.replace(':id', id), this.authHeaders(token));
  }

  // PAYMENT
  paymentList(token?: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/v1/skillforge/payment`, this.authHeaders(token));
  }
  paymentCreate(data: any, token?: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/v1/skillforge/payment`, data, this.authHeaders(token));
  }
  paymentGet(id: string, token?: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/v1/skillforge/payment/:id`.replace(':id', id), this.authHeaders(token));
  }
  paymentUpdate(id: string, data: any, token?: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/v1/skillforge/payment/:id`.replace(':id', id), data, this.authHeaders(token));
  }
  paymentRemove(id: string, token?: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/v1/skillforge/payment/:id`.replace(':id', id), this.authHeaders(token));
  }

  // REVIEWS
  reviewsList(token?: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/v1/skillforge/reviews`, this.authHeaders(token));
  }
  reviewsCreate(data: any, token?: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/v1/skillforge/reviews`, data, this.authHeaders(token));
  }
  reviewsGet(id: string, token?: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/v1/skillforge/reviews/:id`.replace(':id', id), this.authHeaders(token));
  }
  reviewsUpdate(id: string, data: any, token?: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/v1/skillforge/reviews/:id`.replace(':id', id), data, this.authHeaders(token));
  }
  reviewsRemove(id: string, token?: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/v1/skillforge/reviews/:id`.replace(':id', id), this.authHeaders(token));
  }

  // STUDENTS
  studentsList(token?: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/v1/skillforge/students`, this.authHeaders(token));
  }
  studentsCreate(data: any, token?: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/v1/skillforge/students`, data, this.authHeaders(token));
  }
  studentsGet(id: string, token?: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/v1/skillforge/students/:id`.replace(':id', id), this.authHeaders(token));
  }
  studentsUpdate(id: string, data: any, token?: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/v1/skillforge/students/:id`.replace(':id', id), data, this.authHeaders(token));
  }
  studentsRemove(id: string, token?: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/v1/skillforge/students/:id`.replace(':id', id), this.authHeaders(token));
  }
}
