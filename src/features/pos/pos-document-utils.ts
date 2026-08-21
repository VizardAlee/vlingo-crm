const smallNumbers = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const scales = [
  { value: 1_000_000_000_000, name: "Trillion" },
  { value: 1_000_000_000, name: "Billion" },
  { value: 1_000_000, name: "Million" },
  { value: 1_000, name: "Thousand" },
];

function wholeNumberWords(value: number): string {
  if (value < 20) return smallNumbers[value];
  if (value < 100) {
    const remainder = value % 10;
    return `${tens[Math.floor(value / 10)]}${remainder ? `-${smallNumbers[remainder]}` : ""}`;
  }
  if (value < 1_000) {
    const remainder = value % 100;
    return `${smallNumbers[Math.floor(value / 100)]} Hundred${remainder ? ` and ${wholeNumberWords(remainder)}` : ""}`;
  }
  for (const scale of scales) {
    if (value >= scale.value) {
      const remainder = value % scale.value;
      return `${wholeNumberWords(Math.floor(value / scale.value))} ${scale.name}${remainder ? `${remainder < 100 ? " and" : ""} ${wholeNumberWords(remainder)}` : ""}`;
    }
  }
  return String(value);
}

export function nairaAmountInWords(value: number) {
  const normalized = Math.max(0, Math.round(Number(value || 0) * 100));
  const naira = Math.floor(normalized / 100);
  const kobo = normalized % 100;
  const nairaWords = `${wholeNumberWords(naira)} Naira`;
  return kobo ? `${nairaWords} and ${wholeNumberWords(kobo)} Kobo Only` : `${nairaWords} Only`;
}
