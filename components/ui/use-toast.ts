import { toast, type ToastT, type ToastOptions } from "sonner";

export type Toast = ToastT;
export type ToastOptions = ToastOptions;

export { toast };

export function useToast() {
  return { toast };
}