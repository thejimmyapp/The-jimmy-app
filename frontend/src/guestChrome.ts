export interface GuestSessionIdentity {
  guest_number: number;
  total_guests: number;
  completions_to_date: number | null;
  saved_moment_count: number;
  analysis_unlocked: boolean;
  completed: boolean;
  completion_ordinal: number | null;
}

export const EMPTY_GUEST_SESSION: GuestSessionIdentity = {
  guest_number: 0,
  total_guests: 0,
  completions_to_date: null,
  saved_moment_count: 0,
  analysis_unlocked: false,
  completed: false,
  completion_ordinal: null,
};

export const SIGN_IN_NOTICE = "Account registration is currently unavailable. Coming soon.";
