"use client";

import { useActionState, useState } from "react";

import { signIn, type SignInState } from "./actions";
import styles from "./sign-in.module.css";

const initial: SignInState = { error: null };

export function SignInForm({
  hospitals,
  hospitalsError,
  next,
}: {
  hospitals: { id: string; name: string }[];
  hospitalsError: boolean;
  next: string;
}) {
  const [state, action, pending] = useActionState(signIn, initial);
  const [role, setRole] = useState<"network_admin" | "hospital_admin">("network_admin");

  return (
    <form action={action} className={styles.form} data-testid="signin-form">
      <input type="hidden" name="next" value={next} />
      <label className={styles.field}>
        <span className={styles.label}>Role</span>
        <select
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
          className={styles.select}
          data-testid="signin-role"
        >
          <option value="network_admin">Network admin</option>
          <option value="hospital_admin">Hospital admin</option>
        </select>
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Hospital</span>
        <select
          name="hospitalId"
          className={styles.select}
          disabled={role !== "hospital_admin"}
          defaultValue={hospitals[0]?.id ?? ""}
          data-testid="signin-hospital"
        >
          {hospitals.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        <span className={styles.hint}>
          {role === "hospital_admin"
            ? "Hospital admins edit their own hospital and read the others."
            : "Network admins see every hospital and accept transfers."}
        </span>
      </label>
      {hospitalsError ? <p className={styles.error}>Hospital list unavailable. Network admin still works.</p> : null}
      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className={styles.submit} disabled={pending} data-testid="signin-submit">
        {pending ? "Signing in" : "Sign in"}
      </button>
    </form>
  );
}
