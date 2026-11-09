import { HttpError } from "../utils/http.ts";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";

/** Parse national input as Ghana by default and store every phone canonically. */
export const normalizePhoneNumber = (input: string) => {
  const trimmed = input.trim();

  // Reject extensions and text rather than silently extracting a different number.
  if (!trimmed || !/^\+?[0-9().\-\s]+$/.test(trimmed)) {
    throw new HttpError("Enter a valid phone number.", 400, "INVALID_PHONE");
  }

  const parsed = parsePhoneNumberFromString(trimmed, { defaultCountry: "GH", extract: false });
  if (!parsed || !parsed.isPossible() || !parsed.isValid()) {
    throw new HttpError("Enter a valid phone number.", 400, "INVALID_PHONE");
  }

  return parsed.number;
};
