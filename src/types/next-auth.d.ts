import 'next-auth';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    refreshToken?: string;
    error?: string;
    customerId?: string;
    loginCustomerId?: string;
    customerName?: string;
  }
}
