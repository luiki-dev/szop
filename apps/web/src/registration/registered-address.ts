const key = "szop.registeredAddress";

// The address of the last sign-up, kept for /register/sent and its "Send the
// link again", until a verification removes it.
export function saveRegisteredAddress(email: string): void {
  localStorage.setItem(key, email);
}

export function registeredAddress(): string | null {
  return localStorage.getItem(key);
}

export function forgetRegisteredAddress(): void {
  localStorage.removeItem(key);
}
