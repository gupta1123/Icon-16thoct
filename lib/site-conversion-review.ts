export function approvalQuantityError(value: string, requestedSteelMt: number): string | null {
  const quantity = Number(value);
  if (!value.trim() || !Number.isFinite(quantity) || quantity <= 0) {
    return 'Enter an approved quantity greater than zero.';
  }
  if (!Number.isFinite(requestedSteelMt) || quantity > requestedSteelMt) {
    return 'Approved quantity cannot exceed the requested quantity.';
  }
  return null;
}
