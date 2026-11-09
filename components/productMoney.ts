export const formatMinorCurrency = (minorUnits: string, currency = "GHS") => {
  if (!/^\d+$/.test(minorUnits) || !/^[A-Z]{3}$/.test(currency)) {
    throw new TypeError("Invalid minor-unit price or currency.");
  }

  const amount = BigInt(minorUnits);
  const formatter = new Intl.NumberFormat("en-GH", { style: "currency", currency });
  const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  const scale = 10n ** BigInt(fractionDigits);
  const whole = amount / scale;
  const fraction = (amount % scale).toString().padStart(fractionDigits, "0");
  return formatter.formatToParts(whole)
    .map((part) => part.type === "fraction" ? fraction : part.value)
    .join("");
};

export const sumMinorCurrency = (amounts: readonly string[]) =>
  amounts.reduce((total, amount) => {
    if (!/^\d+$/.test(amount)) throw new TypeError("Invalid minor-unit amount.");
    return total + BigInt(amount);
  }, 0n);
