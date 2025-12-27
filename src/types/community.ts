export interface Community {
  id: string;
  name: string;
  description?: string;
}

export interface UserCommunityMembership {
  userId: string;
  communityId: string;
  createdAt?: Date;
}
