import { z } from "zod";

export const siteFeedbackSchema = z.object({
  message: z.string().trim().min(1, "Enter your feedback before sending.").max(2000),
  email: z.string().trim().email("Enter a valid email, or leave it blank.").optional().or(z.literal("")),
});
