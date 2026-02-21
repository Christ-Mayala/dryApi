
import { Injectable, Inject, Optional } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG, ApiConfig } from './api.config';
import * as Models from './models';

@Injectable({ providedIn: 'root' })
export class SkillForgeService {
  private baseUrl: string;

  constructor(
    private http: HttpClient,
    @Optional() @Inject(API_CONFIG) private config: ApiConfig
  ) {
    this.baseUrl = this.config?.baseUrl || 'http://localhost:5000';
  }

  private getHeaders(token?: string) {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const authToken = token || this.config?.tokenGetter?.();
    if (authToken) {
      headers = headers.set('Authorization', `Bearer ${authToken}`);
    }
    return { headers };
  }

  // --- Categories ---
  
  categoriesList(token?: string): Observable<Models.Categories[]> {
    return this.http.get<Models.Categories[]>(`${this.baseUrl}/api/v1/skillforge/categories`, this.getHeaders(token));
  }

  categoriesCreate(data: Models.CategoriesCreate, token?: string): Observable<Models.Categories> {
    return this.http.post<Models.Categories>(`${this.baseUrl}/api/v1/skillforge/categories`, data, this.getHeaders(token));
  }

  categoriesGet(id: string, token?: string): Observable<Models.Categories> {
    return this.http.get<Models.Categories>(`${this.baseUrl}/api/v1/skillforge/categories/:id`.replace(':id', id), this.getHeaders(token));
  }

  categoriesUpdate(id: string, data: Models.CategoriesUpdate, token?: string): Observable<Models.Categories> {
    return this.http.put<Models.Categories>(`${this.baseUrl}/api/v1/skillforge/categories/:id`.replace(':id', id), data, this.getHeaders(token));
  }

  categoriesRemove(id: string, token?: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/v1/skillforge/categories/:id`.replace(':id', id), this.getHeaders(token));
  }

  // --- Courses ---
  
  coursesList(token?: string): Observable<Models.Courses[]> {
    return this.http.get<Models.Courses[]>(`${this.baseUrl}/api/v1/skillforge/courses`, this.getHeaders(token));
  }

  coursesCreate(data: Models.CoursesCreate, token?: string): Observable<Models.Courses> {
    return this.http.post<Models.Courses>(`${this.baseUrl}/api/v1/skillforge/courses`, data, this.getHeaders(token));
  }

  coursesGet(id: string, token?: string): Observable<Models.Courses> {
    return this.http.get<Models.Courses>(`${this.baseUrl}/api/v1/skillforge/courses/:id`.replace(':id', id), this.getHeaders(token));
  }

  coursesUpdate(id: string, data: Models.CoursesUpdate, token?: string): Observable<Models.Courses> {
    return this.http.put<Models.Courses>(`${this.baseUrl}/api/v1/skillforge/courses/:id`.replace(':id', id), data, this.getHeaders(token));
  }

  coursesRemove(id: string, token?: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/v1/skillforge/courses/:id`.replace(':id', id), this.getHeaders(token));
  }

  // --- Ebooks ---
  
  ebooksList(token?: string): Observable<Models.Ebooks[]> {
    return this.http.get<Models.Ebooks[]>(`${this.baseUrl}/api/v1/skillforge/ebooks`, this.getHeaders(token));
  }

  ebooksCreate(data: Models.EbooksCreate, token?: string): Observable<Models.Ebooks> {
    return this.http.post<Models.Ebooks>(`${this.baseUrl}/api/v1/skillforge/ebooks`, data, this.getHeaders(token));
  }

  ebooksGet(id: string, token?: string): Observable<Models.Ebooks> {
    return this.http.get<Models.Ebooks>(`${this.baseUrl}/api/v1/skillforge/ebooks/:id`.replace(':id', id), this.getHeaders(token));
  }

  ebooksUpdate(id: string, data: Models.EbooksUpdate, token?: string): Observable<Models.Ebooks> {
    return this.http.put<Models.Ebooks>(`${this.baseUrl}/api/v1/skillforge/ebooks/:id`.replace(':id', id), data, this.getHeaders(token));
  }

  ebooksRemove(id: string, token?: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/v1/skillforge/ebooks/:id`.replace(':id', id), this.getHeaders(token));
  }

  // --- Export ---
  
  exportList(token?: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/v1/skillforge/export`, this.getHeaders(token));
  }

  exportCreate(data: any, token?: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/v1/skillforge/export`, data, this.getHeaders(token));
  }

  exportGet(id: string, token?: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/v1/skillforge/export/:id`.replace(':id', id), this.getHeaders(token));
  }

  exportUpdate(id: string, data: any, token?: string): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/api/v1/skillforge/export/:id`.replace(':id', id), data, this.getHeaders(token));
  }

  exportRemove(id: string, token?: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/v1/skillforge/export/:id`.replace(':id', id), this.getHeaders(token));
  }

  // --- Orders ---
  
  ordersList(token?: string): Observable<Models.Orders[]> {
    return this.http.get<Models.Orders[]>(`${this.baseUrl}/api/v1/skillforge/orders`, this.getHeaders(token));
  }

  ordersCreate(data: Models.OrdersCreate, token?: string): Observable<Models.Orders> {
    return this.http.post<Models.Orders>(`${this.baseUrl}/api/v1/skillforge/orders`, data, this.getHeaders(token));
  }

  ordersGet(id: string, token?: string): Observable<Models.Orders> {
    return this.http.get<Models.Orders>(`${this.baseUrl}/api/v1/skillforge/orders/:id`.replace(':id', id), this.getHeaders(token));
  }

  ordersUpdate(id: string, data: Models.OrdersUpdate, token?: string): Observable<Models.Orders> {
    return this.http.put<Models.Orders>(`${this.baseUrl}/api/v1/skillforge/orders/:id`.replace(':id', id), data, this.getHeaders(token));
  }

  ordersRemove(id: string, token?: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/v1/skillforge/orders/:id`.replace(':id', id), this.getHeaders(token));
  }

  // --- Payment ---
  
  paymentList(token?: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/api/v1/skillforge/payment`, this.getHeaders(token));
  }

  paymentCreate(data: any, token?: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/v1/skillforge/payment`, data, this.getHeaders(token));
  }

  paymentGet(id: string, token?: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/api/v1/skillforge/payment/:id`.replace(':id', id), this.getHeaders(token));
  }

  paymentUpdate(id: string, data: any, token?: string): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/api/v1/skillforge/payment/:id`.replace(':id', id), data, this.getHeaders(token));
  }

  paymentRemove(id: string, token?: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/v1/skillforge/payment/:id`.replace(':id', id), this.getHeaders(token));
  }

  // --- Reviews ---
  
  reviewsList(token?: string): Observable<Models.Reviews[]> {
    return this.http.get<Models.Reviews[]>(`${this.baseUrl}/api/v1/skillforge/reviews`, this.getHeaders(token));
  }

  reviewsCreate(data: Models.ReviewsCreate, token?: string): Observable<Models.Reviews> {
    return this.http.post<Models.Reviews>(`${this.baseUrl}/api/v1/skillforge/reviews`, data, this.getHeaders(token));
  }

  reviewsGet(id: string, token?: string): Observable<Models.Reviews> {
    return this.http.get<Models.Reviews>(`${this.baseUrl}/api/v1/skillforge/reviews/:id`.replace(':id', id), this.getHeaders(token));
  }

  reviewsUpdate(id: string, data: Models.ReviewsUpdate, token?: string): Observable<Models.Reviews> {
    return this.http.put<Models.Reviews>(`${this.baseUrl}/api/v1/skillforge/reviews/:id`.replace(':id', id), data, this.getHeaders(token));
  }

  reviewsRemove(id: string, token?: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/v1/skillforge/reviews/:id`.replace(':id', id), this.getHeaders(token));
  }

  // --- Students ---
  
  studentsList(token?: string): Observable<Models.Students[]> {
    return this.http.get<Models.Students[]>(`${this.baseUrl}/api/v1/skillforge/students`, this.getHeaders(token));
  }

  studentsCreate(data: Models.StudentsCreate, token?: string): Observable<Models.Students> {
    return this.http.post<Models.Students>(`${this.baseUrl}/api/v1/skillforge/students`, data, this.getHeaders(token));
  }

  studentsGet(id: string, token?: string): Observable<Models.Students> {
    return this.http.get<Models.Students>(`${this.baseUrl}/api/v1/skillforge/students/:id`.replace(':id', id), this.getHeaders(token));
  }

  studentsUpdate(id: string, data: Models.StudentsUpdate, token?: string): Observable<Models.Students> {
    return this.http.put<Models.Students>(`${this.baseUrl}/api/v1/skillforge/students/:id`.replace(':id', id), data, this.getHeaders(token));
  }

  studentsRemove(id: string, token?: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/api/v1/skillforge/students/:id`.replace(':id', id), this.getHeaders(token));
  }
}
