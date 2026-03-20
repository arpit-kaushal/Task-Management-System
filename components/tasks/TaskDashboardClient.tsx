"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ToastHost, { useToasts } from "@/components/Toast";
import Switch from "@/components/Switch";
import {
  clearAccessToken,
  getAccessToken,
  refreshAccessToken,
  setAccessToken,
} from "@/lib/clientAuth";
import styles from "./TaskDashboardClient.module.css";

type TaskStatus = "pending" | "completed";

type Task = {
  id: number;
  title: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
};

type TasksResponse = {
  data: Task[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

async function authedFetch(
  accessToken: string,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
}

async function authedFetchWithRefresh(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  addAccessToken: (token: string) => void,
): Promise<Response> {
  let token = getAccessToken();
  if (!token) {
    token = await refreshAccessToken();
  }

  if (!token) {
    return new Response(null, { status: 401 });
  }

  let res = await authedFetch(token, input, init);
  if (res.status !== 401) return res;

  const newToken = await refreshAccessToken();
  if (!newToken) return res;
  addAccessToken(newToken);

  res = await authedFetch(newToken, input, init);
  return res;
}

export default function TaskDashboardClient() {
  const { toasts, addToast } = useToasts();

  const [accessToken, setAccessTokenState] = useState<string | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [togglingTaskId, setTogglingTaskId] = useState<number | null>(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [status, setStatus] = useState<TaskStatus | "all">("all");
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");

  const [title, setTitle] = useState("");
  const [newStatus, setNewStatus] = useState<TaskStatus>("pending");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editStatus, setEditStatus] = useState<TaskStatus>("pending");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (status !== "all") params.set("status", status);
    const trimmed = q.trim();
    if (trimmed) params.set("q", trimmed);
    return params.toString();
  }, [page, limit, status, q]);

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      setAccessTokenState(token);
      return;
    }

    refreshAccessToken().then((t) => {
      if (!t) {
        window.location.href = "/login";
        return;
      }
      setAccessTokenState(t);
    });
  }, []);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetchWithRefresh(
        `/api/tasks?${queryString}`,
        { method: "GET" },
        (t) => setAccessToken(t),
      );
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) throw new Error(`Failed to load tasks (${res.status})`);

      const data = (await res.json()) as TasksResponse;
      setTasks(data.data);
      setTotalPages(Math.max(1, data.totalPages));
    } catch (e) {
      addToast(
        "error",
        e instanceof Error ? e.message : "Failed to load tasks",
      );
    } finally {
      setLoading(false);
    }
  }, [addToast, queryString]);

  useEffect(() => {
    if (!accessToken) return;
    loadTasks();
  }, [accessToken, loadTasks]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setPage(1);
      setQ(qInput.trim());
    }, 400);

    return () => window.clearTimeout(t);
  }, [qInput]);

  async function handleAdd() {
    const trimmed = title.trim();
    if (!trimmed) {
      addToast("error", "Title is required");
      return;
    }

    try {
      const res = await authedFetchWithRefresh(
        "/api/tasks",
        {
          method: "POST",
          body: JSON.stringify({ title: trimmed, status: newStatus }),
        },
        (t) => setAccessToken(t),
      );
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(
          err?.message ?? `Failed to create task (${res.status})`,
        );
      }
      addToast("success", "Task created");
      setTitle("");
      setNewStatus("pending");
      await loadTasks();
    } catch (e) {
      addToast(
        "error",
        e instanceof Error ? e.message : "Failed to create task",
      );
    }
  }

  function startEdit(task: Task) {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditStatus(task.status);
  }

  async function handleSaveEdit() {
    if (!editingId) return;

    const trimmed = editTitle.trim();
    if (!trimmed) {
      addToast("error", "Title is required");
      return;
    }

    try {
      const res = await authedFetchWithRefresh(
        `/api/tasks/${editingId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ title: trimmed, status: editStatus }),
        },
        (t) => setAccessToken(t),
      );
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(
          err?.message ?? `Failed to update task (${res.status})`,
        );
      }
      addToast("success", "Task updated");
      setEditingId(null);
      await loadTasks();
    } catch (e) {
      addToast(
        "error",
        e instanceof Error ? e.message : "Failed to update task",
      );
    }
  }

  async function handleDelete(taskId: number) {
    if (!window.confirm("Delete this task?")) return;

    try {
      const res = await authedFetchWithRefresh(
        `/api/tasks/${taskId}`,
        { method: "DELETE" },
        (t) => setAccessToken(t),
      );
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(
          err?.message ?? `Failed to delete task (${res.status})`,
        );
      }
      addToast("success", "Task deleted");
      await loadTasks();
    } catch (e) {
      addToast(
        "error",
        e instanceof Error ? e.message : "Failed to delete task",
      );
    }
  }

  async function handleToggle(taskId: number) {
    setTogglingTaskId(taskId);
    try {
      const res = await authedFetchWithRefresh(
        `/api/tasks/${taskId}/toggle`,
        { method: "POST" },
        (t) => setAccessToken(t),
      );
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(
          err?.message ?? `Failed to toggle task (${res.status})`,
        );
      }
      addToast("success", "Task toggled");
      await loadTasks();
    } catch (e) {
      addToast(
        "error",
        e instanceof Error ? e.message : "Failed to toggle task",
      );
    } finally {
      setTogglingTaskId(null);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      clearAccessToken();
      window.location.href = "/login";
    }
  }

  return (
    <div className={styles.page}>
      <ToastHost toasts={toasts} />

      <header className={styles.header}>
        <div>
          <div className={styles.title}>My Tasks</div>
          <div className={styles.subtitle}>Personal task dashboard</div>
        </div>
        <button type="button" className={styles.logout} onClick={handleLogout}>
          Logout
        </button>
      </header>

      <section className={styles.card}>
        <div className={styles.cardTitle}>Add Task</div>
        <div className={styles.formRow}>
          <input
            className={styles.input}
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select
            className={styles.select}
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as TaskStatus)}
          >
            <option value="pending">pending</option>
            <option value="completed">completed</option>
          </select>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={handleAdd}
          >
            Add
          </button>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardTitle}>Filters</div>
        <div className={styles.filters}>
          <input
            className={styles.input}
            placeholder="Search by title..."
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
          <select
            className={styles.select}
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as TaskStatus | "all");
            }}
          >
            <option value="all">All statuses</option>
            <option value="pending">pending</option>
            <option value="completed">completed</option>
          </select>
          <div className={styles.pageSize}>
            <label className={styles.label}>Limit</label>
            <select
              className={styles.select}
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardTitle}>Task List</div>

        {loading ? (
          <div className={styles.muted}>Loading...</div>
        ) : tasks.length === 0 ? (
          <div className={styles.muted}>No tasks found.</div>
        ) : (
          <div className={styles.list}>
            {tasks.map((t) => {
              const isEditing = editingId === t.id;
              return (
                <div key={t.id} className={styles.row}>
                  <div
                    className={
                      t.status === "completed"
                        ? `${styles.ribbon} ${styles.ribbonCompleted}`
                        : `${styles.ribbon} ${styles.ribbonPending}`
                    }
                  >
                    {t.status === "completed" ? "Completed" : "Pending"}
                  </div>
                  <div className={styles.rowMain}>
                    {isEditing ? (
                      <>
                        <div className={styles.editFormRow}>
                          <input
                            className={styles.input}
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                          />
                          <select
                            className={styles.select}
                            value={editStatus}
                            onChange={(e) =>
                              setEditStatus(e.target.value as TaskStatus)
                            }
                          >
                            <option value="pending">pending</option>
                            <option value="completed">completed</option>
                          </select>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className={styles.taskTitleRow}>
                          <div className={styles.taskTitle}>{t.title}</div>
                        </div>
                        <div className={styles.taskSwitchRowDesktop}>
                          <span
                            className={
                              t.status === "pending"
                                ? styles.statusPendingLabel
                                : styles.statusPendingLabelOff
                            }
                          >
                            Pending
                          </span>
                          <Switch
                            checked={t.status === "completed"}
                            disabled={loading || togglingTaskId === t.id}
                            onChange={() => handleToggle(t.id)}
                          />
                          <span
                            className={
                              t.status === "completed"
                                ? styles.statusCompletedLabel
                                : styles.statusCompletedLabelOff
                            }
                          >
                            Completed
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {!isEditing ? (
                    <div className={styles.mobileSwitchHolder}>
                      <Switch
                        checked={t.status === "completed"}
                        disabled={loading || togglingTaskId === t.id}
                        onChange={() => handleToggle(t.id)}
                      />
                    </div>
                  ) : null}

                  <div className={styles.actions}>
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          className={styles.primaryBtn}
                          onClick={handleSaveEdit}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className={styles.secondaryBtn}
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={styles.secondaryBtn}
                          onClick={() => startEdit(t)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={styles.dangerBtn}
                          onClick={() => handleDelete(t.id)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={page <= 1}
            onClick={() => {
              setPage((p) => Math.max(1, p - 1));
            }}
          >
            Previous
          </button>
          <div className={styles.pageInfo}>
            Page {page} of {totalPages}
          </div>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}
