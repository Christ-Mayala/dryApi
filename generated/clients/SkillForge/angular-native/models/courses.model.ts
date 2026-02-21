export interface Courses {
  _id: string;
  createdAt?: string;
  updatedAt?: string;
  title: string;
  subtitle: string;
  price: number;
  duration: number;
  level: string;
  categoryId: string;
  trailerUrl: string;
  contentUrl: string;
  isPublished: boolean;
  label: string;
  status: string;
}
