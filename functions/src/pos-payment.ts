export const posPaymentMethods = new Set([
  "cash",
  "bankTransfer",
  "pos",
  "card",
  "cheque",
  "mobileMoney",
  "onlinePayment",
  "other",
]);

export function isValidPosPaymentMethod(value: unknown) {
  return typeof value === "string" && posPaymentMethods.has(value);
}
