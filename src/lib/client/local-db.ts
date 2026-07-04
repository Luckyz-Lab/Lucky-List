"use client";

import Dexie, { type Table } from "dexie";
import type { MutationQueueItem, Task, UserSettings } from "../types";

export class LuckyListDb extends Dexie {
  tasks!: Table<Task, string>;
  settings!: Table<UserSettings, string>;
  queue!: Table<MutationQueueItem, string>;
  meta!: Table<{ key: string; value: string }, string>;

  constructor() {
    super("lucky_list");
    this.version(1).stores({
      tasks: "id, updatedAt, boardState, dueAt, archivedAt, deletedAt",
      settings: "id, updatedAt",
      queue: "id, createdAt, entity, operation",
      meta: "key",
    });
  }
}

export const db = new LuckyListDb();
