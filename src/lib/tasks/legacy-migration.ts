import { db } from "@/lib/client/local-db";
import type { TaskRepository } from "@/lib/tasks/repository";
import type { Task, UserSettings } from "@/lib/types";
import { nowIso } from "@/lib/utils";
import { defaultSettings } from "@/lib/sample-data";

const migratedKey = "lucky_migrated_to_cloud_v1";

function normalizeSettings(settings?: UserSettings | null): UserSettings {
  return {
    ...defaultSettings,
    ...settings,
    categories: settings?.categories?.length ? settings.categories : defaultSettings.categories,
    defaultReminderMode: settings?.defaultReminderMode ?? defaultSettings.defaultReminderMode,
    dailyDigestEnabled: settings?.dailyDigestEnabled ?? defaultSettings.dailyDigestEnabled,
    dailyDigestTime: settings?.dailyDigestTime ?? defaultSettings.dailyDigestTime,
    notificationsEnabled: settings?.notificationsEnabled ?? defaultSettings.notificationsEnabled,
    autoBackupMinutes: settings?.autoBackupMinutes ?? defaultSettings.autoBackupMinutes,
  };
}

export async function readLegacyWorkspace() {
  const [tasks, settings, backupMeta] = await Promise.all([
    db.tasks.toArray(),
    db.settings.get("settings_default"),
    db.meta.get("latest_backup_json"),
  ]);

  return {
    tasks,
    settings: normalizeSettings(settings),
    latestBackupJson: backupMeta?.value ?? null,
  };
}

export async function writeLocalPreviewTask(task: Task) {
  await db.tasks.put(task);
}

export async function writeLocalPreviewSettings(settings: UserSettings) {
  await db.settings.put(normalizeSettings(settings));
}

export async function markLegacyBackup(content: string) {
  const stamp = nowIso();
  await Promise.all([
    db.meta.put({ key: "latest_backup_json", value: content }),
    db.meta.put({ key: "last_backup_at", value: stamp }),
  ]);
  return stamp;
}

export async function getLegacyLastBackupAt() {
  return (await db.meta.get("last_backup_at"))?.value ?? null;
}

export async function migrateLegacyWorkspaceToCloud(repository: TaskRepository, userId: string) {
  if (localStorage.getItem(migratedKey) === "true") return { migrated: false, count: 0 };

  const legacy = await readLegacyWorkspace();
  const activeTasks = legacy.tasks.filter((task) => !task.deletedAt);
  const backup = JSON.stringify(
    {
      identifier: "LUCKY_LIST_LEGACY_BACKUP",
      generated_at: nowIso(),
      tasks: legacy.tasks,
      settings: legacy.settings,
    },
    null,
    2,
  );

  await markLegacyBackup(backup);

  if (activeTasks.length) {
    await repository.importTasks(activeTasks.map((task) => ({ ...task, userId })));
  }

  await repository.saveSettings({
    ...legacy.settings,
    id: `settings_${userId}`,
    userId,
    updatedAt: nowIso(),
  });

  localStorage.setItem(migratedKey, "true");
  return { migrated: true, count: activeTasks.length };
}
