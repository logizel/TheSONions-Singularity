"use client";

import { toast, type ToastT } from "sonner";

export type Toast = ToastT;
export type ToastOptions = {
  description?: string;
  action?: React.ReactNode;
  duration?: number;
  onDismiss?: () => void;
  onAutoClose?: () => void;
};

export { toast };

export function useToast() {
  return { toast };
}