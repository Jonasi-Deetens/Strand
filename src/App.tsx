import { useEffect } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { useT } from "@/i18n/useT";
import { setLanguage, storedLanguage } from "@/i18n";
import { useProjectStore } from "@/store/useProjectStore";
import { useEditorStore } from "@/store/useEditorStore";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { PlanPage } from "@/features/editor/PlanPage";
import { TasksPage } from "@/features/tasks/TasksPage";
import { OffertesPage } from "@/features/offertes/OffertesPage";
import { CatalogPage } from "@/features/catalog/CatalogPage";
import { SettingsPage } from "@/features/settings/SettingsPage";

const NAV = [
  { to: "/overzicht", key: "nav.overview", icon: "overview" },
  { to: "/plan", key: "nav.plan", icon: "palette" },
  { to: "/taken", key: "nav.tasks", icon: "tasks" },
  { to: "/offertes", key: "nav.offertes", icon: "euro" },
  { to: "/catalogus", key: "nav.catalog", icon: "layers" },
  { to: "/instellingen", key: "nav.settings", icon: "settings" },
] as const;

function Sidebar() {
  const t = useT();
  const doc = useProjectStore((state) => state.doc);
  const language = storedLanguage();

  return (
    <aside className="flex w-[13.5rem] shrink-0 flex-col border-r border-subtle bg-[var(--surface-raised)]">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-sea-400 to-sea-700 text-white shadow-sm">
          <Icon name="umbrella" size={20} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{t("app.name")}</p>
          <p className="muted truncate text-[11px]">
            {doc?.project.name ?? t("app.tagline")}
          </p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                isActive
                  ? "bg-sea-500/15 font-medium text-sea-700 dark:text-sea-200"
                  : "muted hover:bg-sea-500/10",
              )
            }
          >
            <Icon name={item.icon} size={17} />
            {t(item.key)}
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center justify-between gap-2 border-t border-subtle px-3 py-3">
        <div className="flex gap-1">
          {(["nl", "en"] as const).map((code) => (
            <Button
              key={code}
              size="sm"
              variant="ghost"
              active={language === code}
              onClick={() => setLanguage(code)}
            >
              {code.toUpperCase()}
            </Button>
          ))}
        </div>
        <ThemeToggle />
      </div>
    </aside>
  );
}

function ThemeToggle() {
  const theme = useEditorStore((state) => state.theme);
  const setTheme = useEditorStore((state) => state.setTheme);
  const t = useT();
  return (
    <Button
      size="icon"
      variant="ghost"
      title={theme === "dark" ? t("settings.themeLight") : t("settings.themeDark")}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <Icon name={theme === "dark" ? "eye" : "eyeOff"} size={16} />
    </Button>
  );
}

export default function App() {
  const t = useT();
  const init = useProjectStore((state) => state.init);
  const setLang = useProjectStore((state) => state.setLang);
  const loadState = useProjectStore((state) => state.loadState);
  const error = useProjectStore((state) => state.error);
  const flush = useProjectStore((state) => state.flush);
  const theme = useEditorStore((state) => state.theme);
  const language = storedLanguage();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    setLang(language);
  }, [language, setLang]);

  useEffect(() => {
    void init(t, language);
  }, [init, t, language]);

  useEffect(() => {
    const onLeave = () => void flush();
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("beforeunload", onLeave);
      void flush();
    };
  }, [flush]);

  if (loadState === "error") {
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div>
          <p className="text-sm font-semibold">{t("errors.loadFailed")}</p>
          <p className="muted mt-1 max-w-md text-xs break-words">{error}</p>
          <Button
            className="mt-4"
            variant="primary"
            onClick={() => window.location.reload()}
          >
            {t("errors.retry")}
          </Button>
        </div>
      </div>
    );
  }

  if (loadState !== "ready") {
    return (
      <div className="grid h-full place-items-center">
        <p className="muted animate-pulse text-sm">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<Navigate to="/overzicht" replace />} />
          <Route path="/overzicht" element={<DashboardPage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/taken" element={<TasksPage />} />
          <Route path="/offertes" element={<OffertesPage />} />
          <Route path="/catalogus" element={<CatalogPage />} />
          <Route path="/instellingen" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/overzicht" replace />} />
        </Routes>
      </main>
    </div>
  );
}
