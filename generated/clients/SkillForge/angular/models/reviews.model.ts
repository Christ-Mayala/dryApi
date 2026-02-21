// Interface pour Reviews

export interface Reviews {
  _id: string;
  createdAt?: string;
  updatedAt?: string;
  courseId: string;
  studentId: string;
  rating: number;
  comment: string;
  isApproved: boolean;
  label: string;
  status: string;
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
