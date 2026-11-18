import type { UserAccount } from "../../shared/domain";

// The signed-in browser tab stores its API session token here.
const sessionKey = "fims-api-session";
export function getToken() {
  return sessionStorage.getItem(sessionKey);
}
export function clearToken() {
  sessionStorage.removeItem(sessionKey);
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// All fetches use /api. Vite forwards them to the backend, and the token identifies the demo account.
export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", "Bearer " + token);
  const response = await fetch("/api" + path, { ...init, headers });
  const result = await response.json();
  if (!response.ok) throw new ApiError(result.error, response.status);
  return result;
}

export function post<T>(path: string, body: unknown) {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function signIn(input: { email: string; password: string }) {
  const { token, user } = await post<{ token: string; user: UserAccount }>(
    "/session",
    input,
  );
  sessionStorage.setItem(sessionKey, token);
  return user;
}

export async function signOut() {
  const pending = request("/session", { method: "DELETE" });
  clearToken();
  await pending;
}
