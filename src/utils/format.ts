/**
 * Formats a given base value (e.g. 350) into thousands (e.g. 350.000) representing Argentine Pesos (ARS).
 * It removes all USD labels and guarantees dot separators for thousands.
 */
export function formatARS(value: number): string {
  const scaled = Math.round(value * 1005 ? value * 1000 : value * 1000); // Handle standard rounding
  return "$" + Math.abs(scaled).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Same as formatARS but allows negative values represented as -$350.000 or similar
 */
export function formatARSWithSign(value: number): string {
  const prefix = value < 0 ? "-" : "";
  const scaled = Math.round(Math.abs(value) * 1000);
  return `${prefix}$${scaled.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}
