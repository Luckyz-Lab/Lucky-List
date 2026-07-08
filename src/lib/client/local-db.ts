"use client";

import Dexie, { type Table } from "dexie";
import type { Task, UserSettings } from "../types";

export class LuckyListDb extends Dexie {
  tasks!: Table<Task, string>;
  settings!: Table<UserSettings, string>;
  meta!: Table<{ key: string; value: string }, string>;

  constructor() {
    super("lucky_list");
    this.version(1).stores({
      tasks: "id, updatedAt, boardState, dueAt, archivedAt, deletedAt",
      settings: "id, updatedAt",
      queue: "id, createdAt, entity, operation",
      meta: "key",
    });
    this.version(2).stores({
      tasks: "id, updatedAt, boardState, dueAt, archivedAt, deletedAt",
      settings: "id, updatedAt",
      meta: "key",
      queue: null,
    });
  }
}

export const db = new LuckyListDb();
