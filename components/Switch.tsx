"use client";

import { useId } from "react";
import styles from "./Switch.module.css";

export default function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();

  return (
    <div className={styles.wrap}>
      <input
        id={id}
        className={styles.input}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label className={styles.track} htmlFor={id} />
    </div>
  );
}

