export function normalizedCustomerPhone(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.startsWith("234") && digits.length > 10
    ? `0${digits.slice(3)}`
    : digits;
}

export function matchesCustomerSearch(
  customer: { fullName: string; companyName: string; phoneNumber: string; email: string; referenceNumber: string },
  search: string,
) {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  if ([customer.fullName, customer.companyName, customer.phoneNumber, customer.email, customer.referenceNumber]
    .some((value) => value.toLowerCase().includes(needle))) return true;
  const phoneNeedle = normalizedCustomerPhone(needle);
  return phoneNeedle.length >= 4 && normalizedCustomerPhone(customer.phoneNumber).includes(phoneNeedle);
}
