import { z } from "zod";

/** Shortest and longest new password. 72 is bcrypt's limit, which Supabase Auth uses. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

/**
 * Body of POST /api/account/password. Passwords are never trimmed (spaces can be part of one).
 * The current one only has to be present: whether it is right is Supabase Auth's answer.
 */
export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, "Enter your current password.").max(200),
    new_password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `New password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
      .max(PASSWORD_MAX_LENGTH, `New password must be at most ${PASSWORD_MAX_LENGTH} characters.`),
    confirm_password: z.string().max(200),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    path: ["confirm_password"],
    message: "The confirmation does not match the new password.",
  })
  .refine((v) => v.new_password !== v.current_password, {
    path: ["new_password"],
    message: "The new password must be different from the current one.",
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
