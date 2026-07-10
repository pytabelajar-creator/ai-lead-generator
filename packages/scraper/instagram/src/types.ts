export interface InstagramInput {
  username?: string;
  searchKeyword?: string;
}

export interface InstagramResult {
  username: string;
  fullName: string | null;
  bio: string | null;
  website: string | null;
  followersCount: number | null;
  followingCount: number | null;
  postsCount: number | null;
  isVerified: boolean;
  isBusinessAccount: boolean;
  businessCategory: string | null;
  profilePicUrl: string | null;
  latestPostUrls: string[];
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  telegram: string | null;
}
