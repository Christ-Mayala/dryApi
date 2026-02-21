// Interface pour Students

export interface Students {
  _id: string;
  createdAt?: string;
  updatedAt?: string;
  fullName: string;
  email: string;
  phone: string;
  preferences: any[];
  balance: number;
  enrolledCourses: any[];
  label: string;
  status: string;
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
