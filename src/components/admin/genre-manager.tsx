"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AdminFrame, buttonClass, fieldClass } from "@/components/admin/admin-frame";
import { ApiRequestError, api } from "@/lib/api-client";
import { copy } from "@/lib/constants";
import { useTelegram } from "@/lib/telegram/use-telegram";
import type { NamedRef } from "@/types/api";

export function GenreManager() {
  const { ready } = useTelegram();
  const [genres, setGenres] = useState<NamedRef[]>([]);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<NamedRef | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    const data = await api<{ genres: NamedRef[] }>("/api/admin/genres");
    setGenres(data.genres);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timeout = window.setTimeout(() => {
      void load().catch((caught: unknown) => {
        setError(caught instanceof ApiRequestError ? caught.message : copy.internal);
      });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [ready, load]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    try {
      const body = JSON.stringify({ name });
      if (editing) {
        await api(`/api/admin/genres/${editing.id}`, { method: "PATCH", body });
      } else {
        await api("/api/admin/genres", { method: "POST", body });
      }
      setName("");
      setEditing(null);
      setMessage(copy.admin.saved);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : copy.internal);
    } finally {
      setPending(false);
    }
  }

  async function onDelete(genre: NamedRef) {
    if (!window.confirm(`${copy.admin.delete}: ${genre.name}?`)) return;
    setError("");
    try {
      await api(`/api/admin/genres/${genre.id}`, { method: "DELETE" });
      setMessage(copy.admin.deleted);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : copy.internal);
    }
  }

  return (
    <AdminFrame title={copy.admin.genres}>
      <form onSubmit={onSubmit} className="grid gap-3 rounded-3xl bg-[var(--tg-theme-secondary-bg-color)] p-4">
        <label className="grid gap-1 text-sm">
          {copy.admin.name}
          <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <button className={buttonClass} type="submit" disabled={pending}>
          {editing ? copy.admin.save : copy.admin.add}
        </button>
      </form>
      {message ? <p className="text-sm">{message}</p> : null}
      {error ? <p className="text-sm">{error}</p> : null}
      <ul className="grid gap-2">
        {genres.map((genre) => (
          <li
            key={genre.id}
            className="flex items-center justify-between rounded-2xl bg-[var(--tg-theme-secondary-bg-color)] px-4 py-3"
          >
            <span>{genre.name}</span>
            <span className="flex gap-3 text-sm">
              <button
                type="button"
                onClick={() => {
                  setEditing(genre);
                  setName(genre.name);
                }}
              >
                {copy.admin.edit}
              </button>
              <button type="button" onClick={() => void onDelete(genre)}>
                {copy.admin.delete}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </AdminFrame>
  );
}
