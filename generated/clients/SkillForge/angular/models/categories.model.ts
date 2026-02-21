// Interface pour Categories

export interface Categories {
  _id: string;
  createdAt?: string;
  updatedAt?: string;
  name: string;
  description: string;
  slug: string;
  icon: string;
  parentId: string;
  label: string;
  status: string;
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
