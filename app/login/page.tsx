"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ToastHost, { useToasts } from "@/components/Toast";
import styles from "@/components/auth/AuthPage.module.css";
import { setAccessToken } from "@/lib/clientAuth";

export default function LoginPage() {
  const router = useRouter();
  const { toasts, addToast } = useToasts();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast("error", data?.message ?? "Login failed");
        return;
      }
      if (!data.accessToken) {
        addToast("error", "Login failed (missing token)");
        return;
      }

      setAccessToken(data.accessToken);
      addToast("success", "Welcome back");
      router.push("/");
    } catch {
      addToast("error", "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <ToastHost toasts={toasts} />

      <div className={styles.title}>Login</div>
      <div className={styles.subtitle}>Sign in to manage your personal tasks</div>

      <div className={styles.card}>
        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <div className={styles.label}>Email</div>
            <input className={styles.input} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className={styles.field}>
            <div className={styles.label}>Password</div>
            <input
              className={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button className={styles.primaryBtn} disabled={loading} type="submit">
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className={styles.linkRow}>
          <span>New here?</span>
          <span className={styles.link} onClick={() => router.push("/register")}>
            Create an account
          </span>
        </div>
      </div>
    </div>
  );
}

