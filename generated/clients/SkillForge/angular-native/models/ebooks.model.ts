export interface Ebooks {
  _id: string;
  createdAt?: string;
  updatedAt?: string;
  title: string;
  author: string;
  price: number;
  summary: string;
  pages: number;
  format: string;
  coverUrl: string;
  fileUrl: string;
  label: string;
  status: string;
}
