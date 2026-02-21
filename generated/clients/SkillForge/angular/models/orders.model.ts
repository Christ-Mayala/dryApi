// Interface pour Orders

export interface Orders {
  _id: string;
  createdAt?: string;
  updatedAt?: string;
  studentId: string;
  items: any[];
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  paymentMethod: string;
  transactionId: string;
  label: string;
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
