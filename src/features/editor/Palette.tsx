import { useMemo, useState } from "react";
import clsx from "clsx";
import { Input } from "@/components/ui";
import { CatalogThumb } from "./CatalogThumb";
import { CATEGORIES, type Category, type ItemType } from "@/domain/types";
import { itemTypeName } from "@/domain/naming";
import { formatDims } from "@/lib/units";
import { formatCents } from "@/lib/money";
import { useLanguage, useT } from "@/i18n/useT";
import { useEditorStore } from "@/store/useEditorStore";
import { beginPaletteDrag } from "./paletteDrag";

interface PaletteItemProps {
  itemType: ItemType;
  count: number;
  currency: string;
  active: boolean;
  onPick: (itemTypeId: string) => void;
}

function PaletteItem({
  itemType,
  count,
  currency,
  active,
  onPick,
}: PaletteItemProps) {
  const lang = useLanguage();

  return (
    <button
      type="button"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        beginPaletteDrag(itemType.id, event.clientX, event.clientY);
      }}
      onClick={() => onPick(itemType.id)}
      className={clsx(
        "group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors select-none",
        active ? "bg-sea-500/20 ring-1 ring-sea-400" : "hover:bg-sea-500/10",
      )}
    >
      <CatalogThumb itemType={itemType} size={32} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">
          {itemTypeName(itemType, lang)}
        </span>
        <span className="muted block truncate text-[10px]">
          {formatDims(itemType.defaultWMm, itemType.defaultHMm)}
          {itemType.unitPriceCents > 0 &&
            ` · ${formatCents(itemType.unitPriceCents, currency)}`}
        </span>
      </span>
      {count > 0 && (
        <span className="muted shrink-0 rounded-full bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[10px] tabular-nums">
          {count}
        </span>
      )}
    </button>
  );
}

interface PaletteProps {
  itemTypes: ItemType[];
  placement: "beach" | "interior";
  countByType: Map<string, number>;
  currency: string;
}

export function Palette({
  itemTypes,
  placement,
  countByType,
  currency,
}: PaletteProps) {
  const t = useT();
  const [query, setQuery] = useState("");
  const placingItemTypeId = useEditorStore((state) => state.placingItemTypeId);
  const startPlacing = useEditorStore((state) => state.startPlacing);
  const tool = useEditorStore((state) => state.tool);

  const grouped = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const available = itemTypes.filter((itemType) => {
      const fits =
        itemType.placement === "both" || itemType.placement === placement;
      if (!fits) return false;
      if (!needle) return true;
      return (
        itemType.nameNl.toLowerCase().includes(needle) ||
        itemType.nameEn.toLowerCase().includes(needle)
      );
    });
    return CATEGORIES.map((category) => ({
      category,
      items: available.filter((itemType) => itemType.category === category),
    })).filter((group) => group.items.length > 0);
  }, [itemTypes, placement, query]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-subtle px-3 py-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-wide uppercase">
            {t("editor.palette")}
          </h2>
          <span className="muted text-[10px]">{t("editor.paletteHint")}</span>
        </div>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("common.search")}
          className="h-8 text-xs"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {grouped.map((group) => (
          <section key={group.category} className="mb-3">
            <h3 className="muted px-1.5 pb-1 text-[10px] font-semibold tracking-wider uppercase">
              {t(`category.${group.category}` as `category.${Category}`)}
            </h3>
            <div className="flex flex-col gap-0.5">
              {group.items.map((itemType) => (
                <PaletteItem
                  key={itemType.id}
                  itemType={itemType}
                  count={countByType.get(itemType.id) ?? 0}
                  currency={currency}
                  active={
                    placingItemTypeId === itemType.id &&
                    (tool === "place" || tool === "array")
                  }
                  onPick={startPlacing}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
