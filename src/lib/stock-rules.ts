export function nextAfterIncrease(current: number, quantity: number) {
  return current + quantity;
}

export function nextAfterDecrease(current: number, quantity: number, allowNegative: boolean) {
  const next = current - quantity;
  return {
    next,
    allowed: allowNegative || next >= 0,
  };
}

export function depositValue(emptyQuantity: number, depositAmount: number) {
  return emptyQuantity * depositAmount;
}
