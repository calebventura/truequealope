export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  phoneNumber?: string | null;
  instagramUser?: string | null;
  address?: string | null;
  addressLine?: string | null;
  department?: string | null;
  province?: string | null;
  district?: string | null;
  rating?: number | null;
  createdAt?: Date | { toDate: () => Date } | null;
  updatedAt?: Date | { toDate: () => Date } | null;
}
