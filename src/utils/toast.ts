import { addToast } from "@heroui/react";

export function showPersistentErrorToast(title: string, error: unknown, fallback: string): void {
  const description = error instanceof Error ? error.message : typeof error === "string" ? error : fallback;

  addToast({
    title,
    description: description || fallback,
    color: "danger",
    timeout: 0,
    hideCloseButton: false,
  });
}
