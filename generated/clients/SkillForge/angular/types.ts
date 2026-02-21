export interface CoursesCreate {
  title: string;
  subtitle: string;
  price: number;
  duration: number;
  level: string;
  categoryId: string;
  trailerUrl: string;
  contentUrl: string;
  isPublished: boolean;
  label?: string;
  status?: string;
}

export interface CoursesUpdate {
  title?: string;
  subtitle?: string;
  price?: number;
  duration?: number;
  level?: string;
  categoryId?: string;
  trailerUrl?: string;
  contentUrl?: string;
  isPublished?: boolean;
  label?: string;
  status?: string;
}

export interface EbooksCreate {
  title: string;
  author: string;
  price: number;
  summary: string;
  pages: number;
  format: string;
  coverUrl: string;
  fileUrl: string;
  label?: string;
  status?: string;
}

export interface EbooksUpdate {
  title?: string;
  author?: string;
  price?: number;
  summary?: string;
  pages?: number;
  format?: string;
  coverUrl?: string;
  fileUrl?: string;
  label?: string;
  status?: string;
}

export interface CategoriesCreate {
  name: string;
  description: string;
  slug: string;
  icon: string;
  parentId: string;
  label?: string;
  status?: string;
}

export interface CategoriesUpdate {
  name?: string;
  description?: string;
  slug?: string;
  icon?: string;
  parentId?: string;
  label?: string;
  status?: string;
}

export interface OrdersCreate {
  studentId: string;
  items: any[];
  subtotal: number;
  tax: number;
  total: number;
  status?: string;
  paymentMethod: string;
  transactionId: string;
  label?: string;
}

export interface OrdersUpdate {
  studentId?: string;
  items?: any[];
  subtotal?: number;
  tax?: number;
  total?: number;
  status?: string;
  paymentMethod?: string;
  transactionId?: string;
  label?: string;
}

export interface StudentsCreate {
  fullName: string;
  email: string;
  phone: string;
  preferences: any[];
  balance: number;
  enrolledCourses: any[];
  label?: string;
  status?: string;
}

export interface StudentsUpdate {
  fullName?: string;
  email?: string;
  phone?: string;
  preferences?: any[];
  balance?: number;
  enrolledCourses?: any[];
  label?: string;
  status?: string;
}

export interface ReviewsCreate {
  courseId: string;
  studentId: string;
  rating: number;
  comment: string;
  isApproved: boolean;
  label?: string;
  status?: string;
}

export interface ReviewsUpdate {
  courseId?: string;
  studentId?: string;
  rating?: number;
  comment?: string;
  isApproved?: boolean;
  label?: string;
  status?: string;
}
