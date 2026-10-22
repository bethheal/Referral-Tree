import type { Database, User } from "../models/types.ts";
import { createId } from "../utils/crypto.ts";
import { HttpError } from "../utils/http.ts";

const normalizeFullName = (input: unknown) => {
  if (typeof input !== "string") {
    throw new HttpError("Full name must be text.", 400, "INVALID_NAME");
  }
  const name = input.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 120 || !/^[\p{L}\p{M}][\p{L}\p{M} .’'-]*$/u.test(name)) {
    throw new HttpError("Enter a valid full name (2–120 characters).", 400, "INVALID_NAME");
  }
  return name;
};

const validateDateOfBirth = (input: unknown) => {
  if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    throw new HttpError("Date of birth must use YYYY-MM-DD format.", 400, "INVALID_DATE_OF_BIRTH");
  }
  const [year, month, day] = input.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.toISOString().slice(0, 10) !== input) {
    throw new HttpError("Enter a valid date of birth.", 400, "INVALID_DATE_OF_BIRTH");
  }
  const today = new Date().toISOString().slice(0, 10);
  if (input > today) {
    throw new HttpError("Date of birth cannot be in the future.", 400, "INVALID_DATE_OF_BIRTH");
  }
  const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);
  const age = todayYear - year - (todayMonth < month || (todayMonth === month && todayDay < day) ? 1 : 0);
  if (age < 18) {
    throw new HttpError("You must be at least 18 years old.", 400, "MINIMUM_AGE_NOT_MET");
  }
  return input;
};

export const profileFor = (data: Database, user: User) => {
  const membership = data.memberships.find((item) =>
    item.userId === user.id && item.status === "ACTIVE" && Date.parse(item.expiresAt) > Date.now()
  );
  return {
    email: user.email,
    fullName: user.fullName,
    phoneNumber: user.phoneNumber,
    dateOfBirth: user.dateOfBirth ?? null,
    profileImageUrl: null,
    membershipTier: membership?.plan ?? "free",
    preferences: {
      language: user.languagePreference ?? "en",
      theme: user.themePreference ?? "system",
    },
  };
};

export const updateProfile = (data: Database, user: User, input: Record<string, unknown>) => {
  const allowed = new Set(["fullName", "dateOfBirth", "language", "theme"]);
  if (!input || typeof input !== "object" || Object.keys(input).some((key) => !allowed.has(key))) {
    throw new HttpError("Only name, date of birth, language, and theme can be changed here.", 400, "INVALID_PROFILE_FIELDS");
  }
  const nextName = Object.hasOwn(input, "fullName") ? normalizeFullName(input.fullName) : user.fullName;
  const nextDateOfBirth = Object.hasOwn(input, "dateOfBirth") ? validateDateOfBirth(input.dateOfBirth) : user.dateOfBirth;
  let nextLanguage = user.languagePreference ?? "en";
  if (Object.hasOwn(input, "language")) {
    if (input.language !== "en" && input.language !== "fr") {
      throw new HttpError("Language must be English or French.", 400, "INVALID_LANGUAGE");
    }
    nextLanguage = input.language;
  }
  let nextTheme = user.themePreference ?? "system";
  if (Object.hasOwn(input, "theme")) {
    if (input.theme !== "light" && input.theme !== "dark" && input.theme !== "system") {
      throw new HttpError("Theme must be light, dark, or system.", 400, "INVALID_THEME");
    }
    nextTheme = input.theme;
  }
  const oldName = user.fullName;
  user.fullName = nextName;
  user.dateOfBirth = nextDateOfBirth;
  user.languagePreference = nextLanguage;
  user.themePreference = nextTheme;
  user.updatedAt = new Date().toISOString();
  if (oldName !== user.fullName) {
    data.auditLogs.push({
      id: createId("audit"),
      actorUserId: user.id,
      targetUserId: user.id,
      action: "PROFILE_NAME_UPDATED",
      createdAt: user.updatedAt,
    });
  }
  return profileFor(data, user);
};
