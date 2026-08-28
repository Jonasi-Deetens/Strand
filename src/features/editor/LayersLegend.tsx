import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { STATUSES, type Category } from "@/domain/types";
import { STATUS_COLOUR } from "@/domain/status";
import { useT } from "@/i18n/useT";
import { useEditorStore } from "@/store/useEditorStore";

interface LayersLegendProps {
  categories: { category: Category; count: number; colour: string }[];
}

/** Layer visibility, layer locks and the colour legend in one bottom panel. */
export function LayersLegend({ categories }: LayersLegendProps) {
  const t = useT();
  const colourMode = useEditorStore((state) => state.colourMode);
  const hidden = useEditorStore((state) => state.hiddenCategories);
  const locked = useEditorStore((state) => state.lockedCategories);
  const toggleVisible = useEditorStore((state) => state.toggleCategoryVisible);
  const toggleLocked = useEditorStore((state) => state.toggleCategoryLocked);

  return (
    <div className="flex max-h-56 flex-col gap-2 border-t border-subtle px-3 py-2">
      <div>
        <h3 className="muted mb-1 text-[10px] font-semibold tracking-wider uppercase">
          {t("editor.layers")}
        </h3>
        <ul className="flex flex-col gap-0.5 overflow-y-auto">
          {categories.map((entry) => (
            <li
              key={entry.category}
              className="flex items-center gap-1.5 text-[11px]"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-sm"
                style={{ backgroundColor: entry.colour }}
              />
              <span
                className={
                  hidden.includes(entry.category)
                    ? "muted flex-1 truncate line-through"
                    : "flex-1 truncate"
                }
              >
                {t(`category.${entry.category}`)}
              </span>
              <span className="muted tabular-nums">{entry.count}</span>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                title={t("editor.visible")}
                onClick={() => toggleVisible(entry.category)}
              >
                <Icon
                  name={hidden.includes(entry.category) ? "eyeOff" : "eye"}
                  size={13}
                />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                title={t("editor.locked")}
                onClick={() => toggleLocked(entry.category)}
              >
                <Icon
                  name={locked.includes(entry.category) ? "lock" : "unlock"}
                  size={13}
                />
              </Button>
            </li>
          ))}
        </ul>
      </div>

      {colourMode === "status" && (
        <div>
          <h3 className="muted mb-1 text-[10px] font-semibold tracking-wider uppercase">
            {t("editor.legend")}
          </h3>
          <ul className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            {STATUSES.filter((status) => status !== "vervallen").map((status) => (
              <li key={status} className="flex items-center gap-1.5 text-[10px]">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: STATUS_COLOUR[status] }}
                />
                <span className="truncate">{t(`status.${status}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
