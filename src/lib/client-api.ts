"use client";

import { createRandomId } from "./random-id";

function readCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${name}=`))
    ?.split("=")[1];
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const method = init.method?.toUpperCase() ?? "GET";

  if (init.body && !headers.has("content-type") && typeof init.body === "string") {
    headers.set("content-type", "application/json");
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrf = readCookie("kiju_csrf");
    if (csrf) headers.set("x-csrf-token", decodeURIComponent(csrf));
    if (!headers.has("idempotency-key") && path.startsWith("/api/stock/")) {
      headers.set("idempotency-key", createRandomId());
    }
  }

  const response = await fetch(path, {
    ...init,
    headers,
  });

  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "error" in data
        ? (data as { error: { message: string } }).error.message
        : "Anfrage fehlgeschlagen.";
    throw new Error(message);
  }

  return data as T;
}
