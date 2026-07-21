/** Amounts are always stored/transported as integer paise (1 rupee = 100 paise). Never floats. */
const inrFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});

export function formatInr(paise: number): string {
  const rupees = Math.round(paise) / 100;
  return `₹${inrFormatter.format(rupees)}`;
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}
