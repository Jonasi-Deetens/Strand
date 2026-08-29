import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { Button, Field, Input, ProgressBar, Select } from "@/components/ui";
import {
  cabinStockCounts,
  cabinStockFilled,
  stockForCabin,
} from "@/domain/cabinStock";
import { itemTypeName } from "@/domain/naming";
import { STATUS_COLOUR } from "@/domain/status";
import { type ItemType } from "@/domain/types";
import { useLanguage, useT } from "@/i18n/useT";
import { useProjectStore } from "@/store/useProjectStore";

interface CabinStockPanelProps {
  cabinId: string;
  itemTypes: ItemType[];
}

export function CabinStockPanel({ cabinId, itemTypes }: CabinStockPanelProps) {
  const t = useT();
  const lang = useLanguage();
  const doc = useProjectStore((state) => state.doc);
  const addCabinStockLine = useProjectStore((state) => state.addCabinStockLine);
  const updateCabinStockLine = useProjectStore(
    (state) => state.updateCabinStockLine,
  );
  const removeCabinStockLine = useProjectStore(
    (state) => state.removeCabinStockLine,
  );
  const [addTypeId, setAddTypeId] = useState("");
  const [customTitle, setCustomTitle] = useState("");

  const lines = useMemo(
    () => (doc ? stockForCabin(doc, cabinId) : []),
    [cabinId, doc],
  );
  const counts = cabinStockCounts(lines);
  const filled = cabinStockFilled(lines);

  const stockable = useMemo(
    () =>
      itemTypes
        .filter(
          (type) =>
            type.category === "meubilair" || type.category === "interieur",
        )
        .slice()
        .sort((a, b) =>
          itemTypeName(a, lang).localeCompare(itemTypeName(b, lang)),
        ),
    [itemTypes, lang],
  );

  if (!doc) return null;

  const addFromCatalog = (itemTypeId: string) => {
    if (!itemTypeId) return;
    addCabinStockLine(cabinId, { itemTypeId, qtyNeeded: 1 });
    setAddTypeId("");
  };

  const addCustom = () => {
    const title = customTitle.trim();
    if (!title) return;
    addCabinStockLine(cabinId, { title, qtyNeeded: 1 });
    setCustomTitle("");
  };

  return (
    <div className="panel p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold">{t("editor.stock")}</p>
        {filled ? (
          <span
            className="text-[11px] font-medium"
            style={{ color: STATUS_COLOUR.gebouwd }}
          >
            {t("editor.stockFilled")}
          </span>
        ) : (
          <span className="muted text-[11px] tabular-nums">
            {t("editor.stockProgress", {
              ready: counts.ready,
              needed: counts.needed,
            })}
          </span>
        )}
      </div>
      <p className="muted mb-2 text-[11px]">{t("editor.stockHint")}</p>
      <ProgressBar
        value={counts.needed === 0 ? 0 : counts.ready / counts.needed}
        colour={filled ? STATUS_COLOUR.gebouwd : STATUS_COLOUR.besteld}
      />

      {lines.length === 0 ? (
        <p className="muted mt-3 text-[11px]">{t("editor.stockEmpty")}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5">
          {lines.map((line) => {
            const ready = line.qtyReady >= line.qtyNeeded && line.qtyNeeded > 0;
            return (
              <li
                key={line.id}
                className="grid grid-cols-[auto_minmax(0,1fr)_3.25rem_3.25rem_auto] items-center gap-1.5 text-xs"
              >
                <button
                  type="button"
                  aria-pressed={ready}
                  aria-label={t("editor.stockMarkFilled")}
                  onClick={() =>
                    updateCabinStockLine(line.id, {
                      qtyReady: ready ? 0 : line.qtyNeeded,
                    })
                  }
                  className="grid h-6 w-6 place-items-center rounded-md border border-subtle"
                  style={{
                    backgroundColor: ready ? `${STATUS_COLOUR.gebouwd}22` : undefined,
                    color: ready ? STATUS_COLOUR.gebouwd : undefined,
                  }}
                >
                  {ready ? <Icon name="check" size={13} /> : null}
                </button>
                <span className="min-w-0 truncate" title={line.title}>
                  {line.title}
                </span>
                <Input
                  type="number"
                  min={0}
                  aria-label={t("editor.stockReady")}
                  className="h-7 px-1.5 text-center tabular-nums"
                  value={line.qtyReady}
                  onChange={(event) =>
                    updateCabinStockLine(line.id, {
                      qtyReady: Math.max(0, Number(event.target.value) || 0),
                    })
                  }
                />
                <Input
                  type="number"
                  min={0}
                  aria-label={t("editor.stockNeeded")}
                  className="h-7 px-1.5 text-center tabular-nums"
                  value={line.qtyNeeded}
                  onChange={(event) =>
                    updateCabinStockLine(line.id, {
                      qtyNeeded: Math.max(0, Number(event.target.value) || 0),
                    })
                  }
                />
                <button
                  type="button"
                  aria-label={t("common.delete")}
                  onClick={() => removeCabinStockLine(line.id)}
                  className="muted grid h-6 w-6 place-items-center rounded-md hover:text-rose-500"
                >
                  <Icon name="trash" size={13} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex flex-col gap-2">
        <Field label={t("editor.stockAdd")}>
          <Select
            value={addTypeId}
            onChange={(event) => addFromCatalog(event.target.value)}
          >
            <option value="">—</option>
            {stockable.map((type) => (
              <option key={type.id} value={type.id}>
                {itemTypeName(type, lang)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex gap-1.5">
          <Input
            value={customTitle}
            placeholder={t("editor.stockCustom")}
            onChange={(event) => setCustomTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustom();
              }
            }}
          />
          <Button
            size="sm"
            disabled={!customTitle.trim()}
            onClick={addCustom}
          >
            <Icon name="plus" size={14} />
            {t("common.add")}
          </Button>
        </div>
      </div>
    </div>
  );
}
