import { z } from "zod";

export const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long"),
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(80, "Name is too long")
    .optional(),
});

export const signupSchema = credentialsSchema.extend({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(80, "Name is too long"),
});

export const loginSchema = credentialsSchema.pick({
  email: true,
  password: true,
});
