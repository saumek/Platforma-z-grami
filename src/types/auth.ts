export type RegisterRequest = {
  email: string;
  password: string;
  confirmPassword: string;
};

export type LoginRequest = {
  email: string;
  password: string;
  room?: string;
};

export type AuthResponse = {
  success: boolean;
  message: string;
};
