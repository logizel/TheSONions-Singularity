"use client";

import { Toaster as SonnerToaster, type ToasterProps } from "sonner";
import { cn } from "@/lib/utils";

export function Toaster({ className, ...props }: ToasterProps) {
  return (
    <SonnerToaster
      className={cn("group", className)}
      theme="system"
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toast]:bg-background group-[.toast]:border-border group-[.toast]:text-foreground",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}