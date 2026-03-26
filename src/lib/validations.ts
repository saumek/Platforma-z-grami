import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Hasło musi mieć co najmniej 8 znaków.")
  .max(72, "Hasło może mieć maksymalnie 72 znaki.");

export const registerSchema = z
  .object({
    email: z.email("Podaj poprawny adres e-mail."),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Powtórz hasło."),
  })
  .refine(({ password, confirmPassword }) => password === confirmPassword, {
    message: "Hasła muszą być identyczne.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.email("Podaj poprawny adres e-mail."),
  password: z.string().min(1, "Podaj hasło."),
  room: z.string().trim().max(32, "Numer pokoju jest zbyt długi.").optional(),
});

export const profileUpdateSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(3, "Nazwa użytkownika musi mieć co najmniej 3 znaki.")
    .max(24, "Nazwa użytkownika może mieć maksymalnie 24 znaki."),
  bio: z
    .string()
    .trim()
    .max(280, "Biogram może mieć maksymalnie 280 znaków."),
});

export const roomJoinSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Wpisz kod pokoju.")
    .max(16, "Kod pokoju może mieć maksymalnie 16 znaków."),
});
