import { HttpError } from "../utils/http.ts";

export const normalizePhoneNumber = (input: string) => {
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  if (digits.length < 8 || digits.length > 15) {
    throw new HttpError("Enter a valid phone number.", 400, "INVALID_PHONE");
  }

  return `${hasPlus ? "+" : "+"}${digits}`;
};
