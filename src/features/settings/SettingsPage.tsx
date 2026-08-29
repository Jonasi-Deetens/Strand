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
import { ShortcutKeys } from "@/features/editor/ShortcutsHelp";
import { SHORTCUT_GROUPS } from "@/features/editor/shortcuts";

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
            <div className="grid gap-4 sm:grid-cols-2">
              {SHORTCUT_GROUPS.map((group) => (
                <section key={group.titleKey}>
                  <h3 className="muted mb-1 text-[11px] font-semibold tracking-wide uppercase">
                    {t(group.titleKey)}
                  </h3>
                  <dl className="flex flex-col text-xs">
                    {group.items.map((shortcut) => (
                      <div
                        key={`${group.titleKey}-${shortcut.labelKey}`}
                        className="flex items-center justify-between gap-2 border-b border-subtle py-1 last:border-b-0"
                      >
                        <dt className="muted min-w-0 truncate">
                          {t(shortcut.labelKey)}
                        </dt>
                        <dd>
                          <ShortcutKeys shortcut={shortcut} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
