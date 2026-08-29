import { useMemo, useState } from "react";
import { Icon, ICON_PATHS } from "@/components/Icon";
import { CatalogThumb } from "@/features/editor/CatalogThumb";
import {
  Badge,
  Button,
  Field,
  Input,
  Modal,
  Select,
} from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import {
  CATEGORIES,
  type Category,
  type ItemType,
  type Placement,
} from "@/domain/types";
import { formatCents, parseAmountInput } from "@/lib/money";
import { mmToM, parseMetresInput } from "@/lib/units";
import { useT } from "@/i18n/useT";
import { useProjectStore } from "@/store/useProjectStore";

export function CatalogPage() {
  const t = useT();
  const doc = useProjectStore((state) => state.doc)!;
  const addItemType = useProjectStore((state) => state.addItemType);
  const updateItemType = useProjectStore((state) => state.updateItemType);
  const removeItemType = useProjectStore((state) => state.removeItemType);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    nameNl: "",
    nameEn: "",
    category: "meubilair" as Category,
    icon: "box",
    width: "2",
    height: "1",
    price: "0",
  });

  const usage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const object of doc.objects) {
      counts.set(object.itemTypeId, (counts.get(object.itemTypeId) ?? 0) + 1);
    }
    return counts;
  }, [doc.objects]);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return CATEGORIES.map((category) => ({
      category,
      items: doc.itemTypes.filter(
        (itemType) =>
          itemType.category === category &&
          (!needle ||
            itemType.nameNl.toLowerCase().includes(needle) ||
            itemType.nameEn.toLowerCase().includes(needle)),
      ),
    })).filter((group) => group.items.length > 0);
  }, [doc.itemTypes, query]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title={t("catalog.title")}
        subtitle={t("catalog.subtitle")}
        actions={
          <>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("common.search")}
              className="w-48"
            />
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Icon name="plus" size={14} /> {t("catalog.add")}
            </Button>
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <section key={group.category} className="panel overflow-hidden">
              <header className="border-b border-subtle px-3 py-2">
                <h2 className="text-xs font-semibold tracking-wide uppercase">
                  {t(`category.${group.category}`)}
                </h2>
              </header>
              <table className="w-full text-left text-xs">
                <thead className="muted border-b border-subtle text-[10px] tracking-wider uppercase">
                  <tr>
                    <th className="px-3 py-2">{t("common.name")}</th>
                    <th className="px-3 py-2 w-24">{t("common.width")}</th>
                    <th className="px-3 py-2 w-24">{t("common.height")}</th>
                    <th className="px-3 py-2 w-28 text-right">
                      {t("common.unitPrice")}
                    </th>
                    <th className="px-3 py-2 w-28">{t("catalog.placement")}</th>
                    <th className="px-3 py-2 w-28">{t("catalog.targetArea")}</th>
                    <th className="px-3 py-2 w-24" />
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((itemType) => (
                    <CatalogRow
                      key={itemType.id}
                      itemType={itemType}
                      currency={doc.project.currency}
                      usedCount={usage.get(itemType.id) ?? 0}
                      onUpdate={updateItemType}
                      onRemove={removeItemType}
                    />
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      </div>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title={t("catalog.newType")}
        footer={
          <>
            <Button onClick={() => setCreating(false)}>{t("common.cancel")}</Button>
            <Button
              variant="primary"
              disabled={draft.nameNl.trim() === ""}
              onClick={() => {
                addItemType({
                  nameNl: draft.nameNl.trim(),
                  nameEn: (draft.nameEn || draft.nameNl).trim(),
                  category: draft.category,
                  icon: draft.icon,
                  defaultWMm: parseMetresInput(draft.width) ?? 1000,
                  defaultHMm: parseMetresInput(draft.height) ?? 1000,
                  unitPriceCents: parseAmountInput(draft.price) ?? 0,
                });
                setCreating(false);
              }}
            >
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label={`${t("common.name")} (NL)`}>
            <Input
              value={draft.nameNl}
              onChange={(event) =>
                setDraft({ ...draft, nameNl: event.target.value })
              }
            />
          </Field>
          <Field label={`${t("common.name")} (EN)`}>
            <Input
              value={draft.nameEn}
              onChange={(event) =>
                setDraft({ ...draft, nameEn: event.target.value })
              }
            />
          </Field>
          <Field label={t("common.category")}>
            <Select
              value={draft.category}
              onChange={(event) =>
                setDraft({ ...draft, category: event.target.value as Category })
              }
            >
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {t(`category.${category}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("catalog.icon")}>
            <Select
              value={draft.icon}
              onChange={(event) => setDraft({ ...draft, icon: event.target.value })}
            >
              {Object.keys(ICON_PATHS).map((icon) => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={`${t("common.width")} (m)`}>
            <Input
              value={draft.width}
              onChange={(event) => setDraft({ ...draft, width: event.target.value })}
            />
          </Field>
          <Field label={`${t("common.height")} (m)`}>
            <Input
              value={draft.height}
              onChange={(event) =>
                setDraft({ ...draft, height: event.target.value })
              }
            />
          </Field>
          <Field label={t("common.unitPrice")}>
            <Input
              value={draft.price}
              onChange={(event) => setDraft({ ...draft, price: event.target.value })}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function CatalogRow({
  itemType,
  currency,
  usedCount,
  onUpdate,
  onRemove,
}: {
  itemType: ItemType;
  currency: string;
  usedCount: number;
  onUpdate: (id: string, patch: Partial<ItemType>) => void;
  onRemove: (id: string) => void;
}) {
  const t = useT();

  return (
    <tr className="border-b border-subtle last:border-b-0">
      <td className="px-3 py-1.5">
        <div className="flex items-center gap-2">
          <CatalogThumb itemType={itemType} size={28} />
          <div className="min-w-0">
            <input
              value={itemType.nameNl}
              onChange={(event) =>
                onUpdate(itemType.id, { nameNl: event.target.value })
              }
              className="w-full bg-transparent font-medium outline-none"
            />
            <input
              value={itemType.nameEn}
              onChange={(event) =>
                onUpdate(itemType.id, { nameEn: event.target.value })
              }
              className="muted w-full bg-transparent text-[10px] outline-none"
            />
          </div>
        </div>
      </td>
      <td className="px-3 py-1.5">
        <input
          key={`w-${itemType.defaultWMm}`}
          defaultValue={mmToM(itemType.defaultWMm).toFixed(2)}
          onBlur={(event) => {
            const mm = parseMetresInput(event.target.value);
            if (mm && mm > 0) onUpdate(itemType.id, { defaultWMm: mm });
          }}
          className="w-16 bg-transparent tabular-nums outline-none"
        />
      </td>
      <td className="px-3 py-1.5">
        <input
          key={`h-${itemType.defaultHMm}`}
          defaultValue={mmToM(itemType.defaultHMm).toFixed(2)}
          onBlur={(event) => {
            const mm = parseMetresInput(event.target.value);
            if (mm && mm > 0) onUpdate(itemType.id, { defaultHMm: mm });
          }}
          className="w-16 bg-transparent tabular-nums outline-none"
        />
      </td>
      <td className="px-3 py-1.5 text-right">
        <input
          key={`p-${itemType.unitPriceCents}`}
          defaultValue={(itemType.unitPriceCents / 100).toFixed(0)}
          onBlur={(event) => {
            const cents = parseAmountInput(event.target.value);
            if (cents !== null) onUpdate(itemType.id, { unitPriceCents: cents });
          }}
          className="w-24 bg-transparent text-right tabular-nums outline-none"
          title={formatCents(itemType.unitPriceCents, currency)}
        />
      </td>
      <td className="px-3 py-1.5">
        <Select
          value={itemType.placement}
          onChange={(event) =>
            onUpdate(itemType.id, {
              placement: event.target.value as Placement,
            })
          }
          className="h-7 text-[11px]"
        >
          <option value="beach">{t("catalog.placementBeach")}</option>
          <option value="interior">{t("catalog.placementInterior")}</option>
          <option value="both">{t("catalog.placementBoth")}</option>
        </Select>
      </td>
      <td className="px-3 py-1.5">
        <input
          key={`t-${itemType.targetAreaM2}`}
          defaultValue={itemType.targetAreaM2 ?? ""}
          placeholder="—"
          onBlur={(event) => {
            const value = event.target.value.trim().replace(",", ".");
            onUpdate(itemType.id, {
              targetAreaM2: value === "" ? null : Number(value) || null,
            });
          }}
          className="w-16 bg-transparent tabular-nums outline-none"
        />
      </td>
      <td className="px-3 py-1.5 text-right">
        {usedCount > 0 ? (
          <Badge>{t("catalog.inUse", { count: usedCount })}</Badge>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title={t("common.delete")}
            onClick={() => onRemove(itemType.id)}
          >
            <Icon name="trash" size={13} />
          </Button>
        )}
      </td>
    </tr>
  );
}
