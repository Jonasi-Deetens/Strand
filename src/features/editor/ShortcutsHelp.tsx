import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Button, Modal } from "@/components/ui";
import { useT } from "@/i18n/useT";
import { SHORTCUT_GROUPS, type Shortcut } from "./shortcuts";

export function ShortcutKeys({ shortcut }: { shortcut: Shortcut }) {
  const t = useT();
  return (
    <span className="shrink-0 rounded border border-subtle bg-[var(--surface-sunken)] px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap">
      {shortcut.keysKey ? t(shortcut.keysKey) : shortcut.keys}
    </span>
  );
}

/** The `?` overlay, so the keyboard model is discoverable from the canvas. */
export function ShortcutsHelp() {
  const t = useT();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }
      if (event.key === "?") setOpen((current) => !current);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        title={`${t("editor.shortcuts")} (?)`}
        onClick={() => setOpen(true)}
      >
        <Icon name="help" size={16} />
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("editor.shortcuts")}
        width="max-w-2xl"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.titleKey}>
              <h3 className="muted mb-1.5 text-[11px] font-semibold tracking-wide uppercase">
                {t(group.titleKey)}
              </h3>
              <dl className="flex flex-col">
                {group.items.map((shortcut) => (
                  <div
                    key={`${group.titleKey}-${shortcut.labelKey}`}
                    className="flex items-center justify-between gap-3 border-b border-subtle py-1.5 text-xs last:border-b-0"
                  >
                    <dt className="min-w-0 truncate">{t(shortcut.labelKey)}</dt>
                    <dd>
                      <ShortcutKeys shortcut={shortcut} />
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </Modal>
    </>
  );
}
