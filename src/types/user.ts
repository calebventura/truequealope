export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  phoneNumber?: string | null;
  instagramUser?: string | null;
  address?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}
