export enum SamsungPageState {
  INITIAL = 'INITIAL',           // First page with Sign in button
  EMAIL_INPUT = 'EMAIL_INPUT',   // Email input page
  PASSWORD_INPUT = 'PASSWORD_INPUT', // Password input page
  MAIN_PAGE = 'MAIN_PAGE',      // Main page after login
  CHANGE_PASSWORD = 'CHANGE_PASSWORD', // Change password page
  UNKNOWN = 'UNKNOWN'           // Unknown state
}

export interface SamsungSiteStatus {
  isSignedIn: boolean;
  currentPage: SamsungPageState;
  isCaptcha?: boolean;
  email: string | null;
}
