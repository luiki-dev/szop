// A version 7 UUID (RFC 9562): 48 bits of milliseconds, then random bits, so
// IDs made later sort later. No dependency for a few lines.
export function uuidv7(now: number = Date.now()): string {
  const time = now.toString(16).padStart(12, "0");
  const random = Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  // The variant's two high bits are 10: the digit is 8, 9, a or b.
  const variant = "89ab"[parseInt(random.slice(3, 4), 16) & 3] ?? "8";
  const hex = `${time}7${random.slice(0, 3)}${variant}${random.slice(4, 19)}`;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
