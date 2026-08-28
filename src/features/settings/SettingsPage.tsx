import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { isTauriRuntime } from "@/data/driver";
import { LANGUAGES, setLanguage, storedLanguage, type Language } from "@/i18n";
import { useT } from "@/i18n/useT";
import { mmToM, parseMetresInput } from "@/lib/units";
import { useEditorStore } from "@/store/useEditorStore";
import { useProjectStore } from "@/store/useProjectStore";
import { exportProjectFile, importProjectFile } from "@/features/export/projectFile";

const SHORTCUTS: { keys: string; key: string }[] = [
  { keys: "V", key: "editor.escape" },
  { keys: "R", key: "editor.arrayTool" },
  { keys: "M", key: "editor.measure" },
  { keys: "G", key: "editor.grid" },
  { keys: "S", key: "editor.statusCycle" },
  { keys: "L", key: "editor.locked" },
  { keys: "⌫", key: "editor.deleteSelection" },
  { keys: "⌘/Ctrl + D", key: "common.duplicate" },
  { keys: "⌘/Ctrl + Z", key: "editor.undo" },
  { keys: "⌘/Ctrl + ⇧ + Z", key: "editor.redo" },
  { keys: "⌘/Ctrl + A", key: "common.all" },
  { keys: "↑ ↓ ← →", key: "editor.nudgeHint" },
  { keys: "[ ]", key: "editor.sendBackward" },
];

export function SettingsPage() {
  const t = useT();
  const doc = useProjectStore((state) => state.doc)!;
  const updateProject = useProjectStore((state) => state.updateProject);
  const replaceDocument = useProjectStore((state) => state.replaceDocument);
  const theme = useEditorStore((state) => state.theme);
  const setTheme = useEditorStore((state) => state.setTheme);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={t("settings.plot")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("settings.projectName")} className="sm:col-span-2">
                <Input
                  value={doc.project.name}
                  onChange={(event) =>
                    updateProject({ name: event.target.value })
                  }
                />
              </Field>
              <Field label={t("settings.plotWidth")}>
                <Input
                  key={`w-${doc.project.plotWMm}`}
                  defaultValue={mmToM(doc.project.plotWMm).toFixed(1)}
                  onBlur={(event) => {
                    const mm = parseMetresInput(event.target.value);
                    if (mm && mm > 1000) updateProject({ plotWMm: mm });
                  }}
                />
              </Field>
              <Field label={t("settings.plotHeight")}>
                <Input
                  key={`h-${doc.project.plotHMm}`}
                  defaultValue={mmToM(doc.project.plotHMm).toFixed(1)}
                  onBlur={(event) => {
                    const mm = parseMetresInput(event.target.value);
                    if (mm && mm > 1000) updateProject({ plotHMm: mm });
                  }}
                />
              </Field>
              <Field label={t("settings.currency")}>
                <Select
                  value={doc.project.currency}
                  onChange={(event) =>
                    updateProject({ currency: event.target.value })
                  }
                >
                  {["EUR", "GBP", "USD", "DKK", "SEK"].map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>

          <Card title={t("settings.language")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("settings.language")}>
                <Select
                  value={storedLanguage()}
                  onChange={(event) =>
                    setLanguage(event.target.value as Language)
                  }
                >
                  {LANGUAGES.map((code) => (
                    <option key={code} value={code}>
                      {code === "nl" ? "Nederlands" : "English"}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("settings.theme")}>
                <Select
                  value={theme}
                  onChange={(event) =>
                    setTheme(event.target.value as "light" | "dark")
                  }
                >
                  <option value="light">{t("settings.themeLight")}</option>
                  <option value="dark">{t("settings.themeDark")}</option>
                </Select>
              </Field>
            </div>
          </Card>

          <Card title={t("settings.backup")}>
            <div className="flex flex-col gap-3">
              <p className="muted text-xs">
                {isTauriRuntime()
                  ? t("settings.aboutText")
                  : t("settings.storageWeb")}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={async () => {
                    const path = await exportProjectFile(doc);
                    if (path)
                      setMessage(t("exporting.done", { name: path }));
                  }}
                >
                  <Icon name="download" size={14} /> {t("settings.exportProject")}
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      const imported = await importProjectFile();
                      if (!imported) return;
                      await replaceDocument(imported);
                      setMessage(t("settings.importProject"));
                    } catch (error) {
                      setMessage(
                        t("exporting.failed", { error: String(error) }),
                      );
                    }
                  }}
                >
                  <Icon name="upload" size={14} /> {t("settings.importProject")}
                </Button>
              </div>
              <p className="muted text-[11px]">{t("settings.importWarning")}</p>
              {message && <p className="text-xs text-sea-600 dark:text-sea-300">{message}</p>}
            </div>
          </Card>

          <Card title={t("settings.shortcuts")}>
            <dl className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
              {SHORTCUTS.map((shortcut) => (
                <div
                  key={shortcut.keys}
                  className="flex items-center justify-between gap-2 border-b border-subtle py-1 last:border-b-0"
                >
                  <dt className="muted truncate">{t(shortcut.key)}</dt>
                  <dd className="shrink-0 rounded border border-subtle px-1.5 py-0.5 font-mono text-[10px]">
                    {shortcut.keys}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
