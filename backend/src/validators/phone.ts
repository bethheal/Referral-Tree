export const normalizePhoneNumber = (input: string) => {
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  if (digits.length < 8 || digits.length > 15) {
    throw new Error("Enter a valid phone number.");
  }

  return `${hasPlus ? "+" : "+"}${digits}`;
};
