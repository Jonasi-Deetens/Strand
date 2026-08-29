import { Link } from "react-router-dom";
import { Icon } from "@/components/Icon";
import {
  Badge,
  Button,
  Divider,
  Field,
  Input,
  ProgressBar,
  Select,
  StatusPill,
  Textarea,
} from "@/components/ui";
import { STATUSES, type ItemType, type PlanObject, type Scene, type Status } from "@/domain/types";
import { itemTypeName } from "@/domain/naming";
import { OFFERTE_STATUS_COLOUR, STATUS_COLOUR } from "@/domain/status";
import {
  areaM2,
  formatM2,
  mmToM,
  parseMetresInput,
  snapAngle,
  snapMm,
} from "@/lib/units";
import { formatCents } from "@/lib/money";
import { useLanguage, useT } from "@/i18n/useT";
import { useEditorStore } from "@/store/useEditorStore";
import { useProjectStore } from "@/store/useProjectStore";
import { isCabinType } from "@/domain/cabinStock";
import {
  bestQuoteForLine,
  lineById,
  lineCompletion,
  objectsForLine,
} from "@/store/selectors";
import { CabinStockPanel } from "./CabinStockPanel";

interface InspectorProps {
  scene: Scene;
  objects: PlanObject[];
  itemTypes: Map<string, ItemType>;
  onOpenInterior: (objectId: string) => void;
}

export function Inspector({
  scene,
  objects,
  itemTypes,
  onOpenInterior,
}: InspectorProps) {
  const t = useT();
  const lang = useLanguage();
  const doc = useProjectStore((state) => state.doc);
  const selection = useEditorStore((state) => state.selection);
  const snapEnabled = useEditorStore((state) => state.snapEnabled);
  const updateObject = useProjectStore((state) => state.updateObject);
  const updateObjects = useProjectStore((state) => state.updateObjects);
  const removeObjects = useProjectStore((state) => state.removeObjects);
  const duplicateObjects = useProjectStore((state) => state.duplicateObjects);
  const raiseObjects = useProjectStore((state) => state.raiseObjects);
  const setSelection = useEditorStore((state) => state.setSelection);

  const selected = objects.filter((object) => selection.includes(object.id));
  const currency = doc?.project.currency ?? "EUR";

  if (!doc) return null;

  if (selected.length === 0) {
    const totalArea = objects.reduce(
      (sum, object) => sum + areaM2(object.wMm, object.hMm),
      0,
    );
    return (
      <div className="flex h-full flex-col gap-3 p-3">
        <h2 className="text-xs font-semibold tracking-wide uppercase">
          {t("editor.inspector")}
        </h2>
        <div className="panel p-3 text-xs">
          <p className="muted mb-1 text-[10px] tracking-wide uppercase">
            {t("editor.plot")}
          </p>
          <p className="font-medium">
            {mmToM(scene.wMm).toFixed(1)} × {mmToM(scene.hMm).toFixed(1)} m
          </p>
          <p className="muted mt-2">
            {t("editor.objectsInScene", { count: objects.length })} ·{" "}
            {formatM2(totalArea)}
          </p>
        </div>
        <p className="muted text-xs">{t("editor.noSelectionHint")}</p>
        <p className="muted mt-auto text-[11px]">{t("editor.interiorHint")}</p>
      </div>
    );
  }

  if (selected.length > 1) {
    return (
      <div className="flex h-full flex-col gap-3 p-3">
        <h2 className="text-xs font-semibold tracking-wide uppercase">
          {t("editor.selectionCount", { count: selected.length })}
        </h2>
        <Field label={t("procurement.bulkStatus")}>
          <Select
            value=""
            onChange={(event) =>
              updateObjects(selection, {
                status: event.target.value as Status,
              })
            }
          >
            <option value="">—</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`status.${status}`)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => duplicateObjects(selection)}>
            <Icon name="copy" size={14} /> {t("common.duplicate")}
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              removeObjects(selection);
              setSelection([]);
            }}
          >
            <Icon name="trash" size={14} /> {t("common.delete")}
          </Button>
        </div>
        <ul className="mt-2 flex-1 overflow-y-auto text-xs">
          {selected.map((object) => {
            const itemType = itemTypes.get(object.itemTypeId);
            return (
              <li
                key={object.id}
                className="flex items-center justify-between border-b border-subtle py-1.5"
              >
                <span className="truncate">
                  {itemType ? itemTypeName(itemType, lang) : "?"}
                </span>
                <StatusPill status={object.status} />
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  const object = selected[0]!;
  const itemType = itemTypes.get(object.itemTypeId);
  if (!itemType) return null;

  const line = lineById(doc, object.procurementLineId);
  const quote = line ? bestQuoteForLine(doc, line.id) : null;
  const supplier = quote
    ? (doc.suppliers.find(
        (candidate) => candidate.id === quote.offerte.supplierId,
      ) ?? null)
    : null;
  const siblings = line ? objectsForLine(doc, line.id) : [];
  const area = areaM2(object.wMm, object.hMm);
  const target = itemType.targetAreaM2;
  const areaDelta = target ? area - target : 0;

  // The canvas snaps to 5 cm and 15°, so typed values follow the same grid and
  // the two ways of editing an object cannot drift apart.
  const toGrid = (mm: number) => (snapEnabled ? snapMm(mm) : mm);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-center gap-2 border-b border-subtle px-3 py-3">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
          style={{
            backgroundColor: `${itemType.colour}1f`,
            color: itemType.colour,
          }}
        >
          <Icon name={itemType.icon} size={18} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {itemTypeName(itemType, lang)}
          </p>
          <p className="muted text-[11px]">
            {formatM2(area)}
            {target ? ` / ${formatM2(target)}` : ""}
          </p>
        </div>
      </div>

      {target !== null && (
        <div
          className="px-3 py-2 text-[11px]"
          style={{
            color:
              Math.abs(areaDelta) < 0.5
                ? STATUS_COLOUR.gebouwd
                : STATUS_COLOUR.offerte_aangevraagd,
          }}
        >
          {Math.abs(areaDelta) < 0.5
            ? t("editor.areaOk")
            : areaDelta > 0
              ? t("editor.areaOver", { over: areaDelta.toFixed(1) })
              : t("editor.areaUnder", { under: Math.abs(areaDelta).toFixed(1) })}
        </div>
      )}

      <div className="flex flex-col gap-3 p-3">
        <Field label={t("common.status")}>
          <Select
            value={object.status}
            onChange={(event) =>
              updateObject(object.id, { status: event.target.value as Status })
            }
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`status.${status}`)}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label={`${t("common.width")} (m)`}>
            <Input
              type="text"
              inputMode="decimal"
              disabled={!itemType.resizable}
              defaultValue={mmToM(object.wMm).toFixed(2)}
              key={`w-${object.id}-${object.wMm}`}
              onBlur={(event) => {
                const mm = parseMetresInput(event.target.value);
                if (mm && mm > 0) updateObject(object.id, { wMm: toGrid(mm) });
              }}
            />
          </Field>
          <Field label={`${t("common.height")} (m)`}>
            <Input
              type="text"
              inputMode="decimal"
              disabled={!itemType.resizable}
              defaultValue={mmToM(object.hMm).toFixed(2)}
              key={`h-${object.id}-${object.hMm}`}
              onBlur={(event) => {
                const mm = parseMetresInput(event.target.value);
                if (mm && mm > 0) updateObject(object.id, { hMm: toGrid(mm) });
              }}
            />
          </Field>
          <Field label={`${t("common.position")} X (m)`}>
            <Input
              type="text"
              inputMode="decimal"
              key={`x-${object.id}-${object.xMm}`}
              defaultValue={mmToM(object.xMm).toFixed(2)}
              onBlur={(event) => {
                const mm = parseMetresInput(event.target.value);
                if (mm !== null) updateObject(object.id, { xMm: toGrid(mm) });
              }}
            />
          </Field>
          <Field label={`${t("common.position")} Y (m)`}>
            <Input
              type="text"
              inputMode="decimal"
              key={`y-${object.id}-${object.yMm}`}
              defaultValue={mmToM(object.yMm).toFixed(2)}
              onBlur={(event) => {
                const mm = parseMetresInput(event.target.value);
                if (mm !== null) updateObject(object.id, { yMm: toGrid(mm) });
              }}
            />
          </Field>
          <Field label={`${t("common.rotation")} (°)`}>
            <Input
              type="number"
              step={15}
              value={object.rotationDeg}
              onChange={(event) =>
                updateObject(object.id, {
                  rotationDeg: Number(event.target.value) || 0,
                })
              }
              onBlur={() =>
                snapEnabled &&
                updateObject(object.id, {
                  rotationDeg: snapAngle(object.rotationDeg),
                })
              }
            />
          </Field>
          <Field label={t("common.label")}>
            <Input
              value={object.label ?? ""}
              placeholder={itemTypeName(itemType, lang)}
              onChange={(event) =>
                updateObject(object.id, { label: event.target.value || null })
              }
            />
          </Field>
        </div>

        {/* Variant splits one item type into separate procurement lines, so
            "cabine, dubbel" is quoted apart from "cabine". */}
        <Field label={t("common.variant")} hint={t("editor.variantHint")}>
          <Input
            key={`v-${object.id}`}
            defaultValue={object.variant ?? ""}
            placeholder={t("editor.variantPlaceholder")}
            onBlur={(event) => {
              const variant = event.target.value.trim();
              if ((object.variant ?? "") === variant) return;
              updateObject(object.id, { variant: variant || null });
            }}
          />
        </Field>

        <Field label={t("common.notes")}>
          <Textarea
            value={object.notes ?? ""}
            onChange={(event) =>
              updateObject(object.id, { notes: event.target.value || null })
            }
          />
        </Field>

        {isCabinType(itemType) && (
          <CabinStockPanel
            cabinId={object.id}
            itemTypes={doc.itemTypes}
          />
        )}

        <div className="flex flex-wrap gap-1.5">
          {itemType.hasInterior && (
            <Button size="sm" variant="primary" onClick={() => onOpenInterior(object.id)}>
              <Icon name="chevronRight" size={14} /> {t("editor.openInterior")}
            </Button>
          )}
          <Button
            size="sm"
            active={object.locked}
            onClick={() => updateObject(object.id, { locked: !object.locked })}
          >
            <Icon name={object.locked ? "lock" : "unlock"} size={14} />
            {t("editor.locked")}
          </Button>
          <Button size="sm" onClick={() => duplicateObjects([object.id])}>
            <Icon name="copy" size={14} /> {t("common.duplicate")}
          </Button>
          <Button size="sm" onClick={() => raiseObjects([object.id], 1)}>
            {t("editor.bringForward")}
          </Button>
          <Button size="sm" onClick={() => raiseObjects([object.id], -1)}>
            {t("editor.sendBackward")}
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              removeObjects([object.id]);
              setSelection([]);
            }}
          >
            <Icon name="trash" size={14} /> {t("common.delete")}
          </Button>
        </div>

        {line && (
          <>
            <Divider className="h-px w-full" />
            <div className="panel p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="truncate text-xs font-semibold">{line.title}</p>
                <Badge>{`${siblings.length}× ${t("editor.beachScene").toLowerCase()}`}</Badge>
              </div>
              <ProgressBar value={lineCompletion(doc, line)} />
              <dl className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
                <dt className="muted">{t("common.unitPrice")}</dt>
                <dd className="text-right tabular-nums">
                  {formatCents(itemType.unitPriceCents, currency)}
                </dd>
                <dt className="muted">{t("procurement.budget")}</dt>
                <dd className="text-right tabular-nums">
                  {formatCents(line.budgetCents, currency)}
                </dd>
                <dt className="muted">{t("procurement.bestQuote")}</dt>
                <dd className="text-right tabular-nums">
                  {quote
                    ? formatCents(quote.exVatCents, currency)
                    : t("procurement.noQuote")}
                </dd>
              </dl>

              {quote && (
                <div className="mt-2 border-t border-subtle pt-2">
                  <p className="muted text-[10px] tracking-wide uppercase">
                    {t("editor.linkedOfferte")}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-[11px]">
                      {quote.offerte.reference}
                      {supplier ? ` · ${supplier.name}` : ""}
                    </p>
                    <Badge colour={OFFERTE_STATUS_COLOUR[quote.offerte.status]}>
                      {t(`offerteStatus.${quote.offerte.status}`)}
                    </Badge>
                  </div>
                  <Link
                    to={`/offertes?offerte=${quote.offerte.id}`}
                    className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-sea-700 hover:underline dark:text-sea-300"
                  >
                    <Icon name="euro" size={13} /> {t("editor.openOfferte")}
                  </Link>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
