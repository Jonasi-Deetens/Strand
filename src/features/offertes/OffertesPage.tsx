import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
} from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import {
  type Offerte,
  type OfferteStatus,
  type ProcurementLine,
} from "@/domain/types";
import { OFFERTE_STATUS_COLOUR, STATUS_COLOUR } from "@/domain/status";
import {
  DEFAULT_VAT_PCT,
  formatCents,
  formatCentsPrecise,
  lineTotalExVat,
  parseAmountInput,
} from "@/lib/money";
import { todayIso } from "@/lib/id";
import { useT } from "@/i18n/useT";
import { useProjectStore } from "@/store/useProjectStore";
import { offerteTotals, quotesForLine } from "@/store/selectors";
import { pickQuoteFile, revealPath } from "@/lib/files";

const OFFERTE_STATUSES: OfferteStatus[] = [
  "aangevraagd",
  "ontvangen",
  "gekozen",
  "afgewezen",
];

export function OffertesPage() {
  const t = useT();
  const doc = useProjectStore((state) => state.doc)!;
  const addOfferte = useProjectStore((state) => state.addOfferte);
  const [tab, setTab] = useState<"quotes" | "compare" | "suppliers">("quotes");

  // Selection lives in the query string so the plan inspector can link straight
  // to the quote behind an object.
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("offerte");
  const setSelectedId = useCallback(
    (id: string) => setParams({ offerte: id }, { replace: true }),
    [setParams],
  );

  // Fall back to the first quote rather than showing an empty pane: the id can
  // go stale when a quote is deleted, and it starts out null when the first
  // quote is created after this page mounted.
  const selected =
    doc.offertes.find((offerte) => offerte.id === selectedId) ??
    doc.offertes[0] ??
    null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title={t("offertes.title")}
        subtitle={t("offertes.subtitle")}
        tabs={[
          { id: "quotes", label: t("offertes.title") },
          { id: "compare", label: t("offertes.comparison") },
          { id: "suppliers", label: t("offertes.suppliers") },
        ]}
        activeTab={tab}
        onTab={(id) => setTab(id as typeof tab)}
        actions={
          tab === "quotes" && (
            <Button
              variant="primary"
              onClick={() => {
                const id = addOfferte({ requestedAt: todayIso() });
                setSelectedId(id);
              }}
            >
              <Icon name="plus" size={14} /> {t("offertes.add")}
            </Button>
          )
        }
      />

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "quotes" && (
          <div className="flex h-full min-h-0">
            <div className="w-72 shrink-0 overflow-y-auto border-r border-subtle">
              {doc.offertes.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={<Icon name="euro" size={24} />}
                    title={t("offertes.empty")}
                    hint={t("offertes.emptyHint")}
                  />
                </div>
              ) : (
                <ul>
                  {doc.offertes.map((offerte) => (
                    <OfferteListItem
                      key={offerte.id}
                      offerte={offerte}
                      active={offerte.id === selected?.id}
                      onSelect={() => setSelectedId(offerte.id)}
                    />
                  ))}
                </ul>
              )}
            </div>
            <div className="min-w-0 flex-1 overflow-y-auto p-4">
              {selected ? (
                <OfferteDetail offerte={selected} />
              ) : (
                <p className="muted text-xs">{t("editor.noSelection")}</p>
              )}
            </div>
          </div>
        )}
        {tab === "compare" && <ComparisonView />}
        {tab === "suppliers" && <SuppliersView />}
      </div>
    </div>
  );
}

function OfferteListItem({
  offerte,
  active,
  onSelect,
}: {
  offerte: Offerte;
  active: boolean;
  onSelect: () => void;
}) {
  const t = useT();
  const doc = useProjectStore((state) => state.doc)!;
  const supplier = doc.suppliers.find(
    (candidate) => candidate.id === offerte.supplierId,
  );
  const totals = offerteTotals(doc, offerte.id);

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={clsx(
          "flex w-full flex-col items-start gap-1 border-b border-subtle px-3 py-2.5 text-left transition-colors",
          active ? "bg-sea-500/10" : "hover:bg-sea-500/5",
        )}
      >
        <span className="flex w-full items-center justify-between gap-2">
          <span className="truncate text-[13px] font-medium">
            {supplier?.name || t("offertes.noSupplier")}
          </span>
          <Badge colour={OFFERTE_STATUS_COLOUR[offerte.status]}>
            {t(`offerteStatus.${offerte.status}`)}
          </Badge>
        </span>
        <span className="muted flex w-full items-center justify-between text-[11px]">
          <span className="truncate">{offerte.reference || "—"}</span>
          <span className="tabular-nums">
            {formatCents(totals.exVatCents, doc.project.currency)}
          </span>
        </span>
      </button>
    </li>
  );
}

function OfferteDetail({ offerte }: { offerte: Offerte }) {
  const t = useT();
  const doc = useProjectStore((state) => state.doc)!;
  const updateOfferte = useProjectStore((state) => state.updateOfferte);
  const removeOfferte = useProjectStore((state) => state.removeOfferte);
  const chooseOfferte = useProjectStore((state) => state.chooseOfferte);
  const addOfferteLine = useProjectStore((state) => state.addOfferteLine);
  const updateOfferteLine = useProjectStore((state) => state.updateOfferteLine);
  const removeOfferteLine = useProjectStore((state) => state.removeOfferteLine);

  const currency = doc.project.currency;
  const lines = doc.offerteLines.filter((line) => line.offerteId === offerte.id);
  const totals = offerteTotals(doc, offerte.id);

  // Split the link target list: the plan can produce dozens of lines, and a flat
  // alphabetical list of everything is the hardest possible thing to pick from.
  const linkGroups = useMemo(() => {
    const byTitle = (a: ProcurementLine, b: ProcurementLine) =>
      a.title.localeCompare(b.title);
    return [
      {
        label: t("procurement.derived"),
        lines: doc.procurementLines.filter((line) => line.derived).sort(byTitle),
      },
      {
        label: t("procurement.manual"),
        lines: doc.procurementLines.filter((line) => !line.derived).sort(byTitle),
      },
    ].filter((group) => group.lines.length > 0);
  }, [doc.procurementLines, t]);

  return (
    <div className="flex flex-col gap-4">
      <div className="panel grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t("common.supplier")}>
          <Select
            value={offerte.supplierId ?? ""}
            onChange={(event) =>
              updateOfferte(offerte.id, {
                supplierId: event.target.value || null,
              })
            }
          >
            <option value="">{t("offertes.noSupplier")}</option>
            {doc.suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("offertes.reference")}>
          <Input
            value={offerte.reference}
            onChange={(event) =>
              updateOfferte(offerte.id, { reference: event.target.value })
            }
          />
        </Field>
        <Field label={t("common.status")}>
          <Select
            value={offerte.status}
            onChange={(event) =>
              updateOfferte(offerte.id, {
                status: event.target.value as OfferteStatus,
              })
            }
          >
            {OFFERTE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`offerteStatus.${status}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("offertes.requestedAt")}>
          <Input
            type="date"
            value={offerte.requestedAt ?? ""}
            onChange={(event) =>
              updateOfferte(offerte.id, {
                requestedAt: event.target.value || null,
              })
            }
          />
        </Field>
        <Field label={t("offertes.receivedAt")}>
          <Input
            type="date"
            value={offerte.receivedAt ?? ""}
            onChange={(event) =>
              updateOfferte(offerte.id, {
                receivedAt: event.target.value || null,
              })
            }
          />
        </Field>
        <Field label={t("offertes.validUntil")}>
          <Input
            type="date"
            value={offerte.validUntil ?? ""}
            onChange={(event) =>
              updateOfferte(offerte.id, {
                validUntil: event.target.value || null,
              })
            }
          />
        </Field>
        <Field label={t("common.notes")} className="sm:col-span-2 lg:col-span-3">
          <Textarea
            value={offerte.notes ?? ""}
            onChange={(event) =>
              updateOfferte(offerte.id, { notes: event.target.value || null })
            }
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={async () => {
            const path = await pickQuoteFile();
            if (path) updateOfferte(offerte.id, { filePath: path });
          }}
        >
          <Icon name="file" size={14} /> {t("offertes.attachFile")}
        </Button>
        {offerte.filePath && (
          <Button variant="ghost" onClick={() => void revealPath(offerte.filePath!)}>
            <Icon name="open" size={14} />
            <span className="max-w-64 truncate">{offerte.filePath}</span>
          </Button>
        )}
        <Button
          variant="primary"
          className="ml-auto"
          onClick={() => chooseOfferte(offerte.id)}
        >
          <Icon name="check" size={14} /> {t("offertes.choose")}
        </Button>
        <Button variant="danger" onClick={() => removeOfferte(offerte.id)}>
          <Icon name="trash" size={14} /> {t("common.delete")}
        </Button>
      </div>

      <div className="panel overflow-hidden">
        <header className="flex items-center justify-between border-b border-subtle px-3 py-2">
          <h2 className="text-xs font-semibold tracking-wide uppercase">
            {t("offertes.lines")}
          </h2>
          <Button size="sm" onClick={() => addOfferteLine(offerte.id)}>
            <Icon name="plus" size={13} /> {t("offertes.addLine")}
          </Button>
        </header>
        <table className="w-full text-left text-xs">
          <thead className="muted border-b border-subtle text-[10px] tracking-wider uppercase">
            <tr>
              <th className="px-3 py-2">{t("offertes.description")}</th>
              <th className="px-3 py-2">{t("offertes.linkLine")}</th>
              <th className="px-3 py-2 w-20 text-right">{t("common.qty")}</th>
              <th className="px-3 py-2 w-28 text-right">
                {t("common.unitPrice")}
              </th>
              <th className="px-3 py-2 w-20 text-right">{t("offertes.vat")}</th>
              <th className="px-3 py-2 w-28 text-right">{t("common.total")}</th>
              <th className="px-3 py-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="border-b border-subtle last:border-b-0">
                <td className="px-3 py-1.5">
                  <input
                    value={line.description}
                    onChange={(event) =>
                      updateOfferteLine(line.id, {
                        description: event.target.value,
                      })
                    }
                    className="w-full bg-transparent outline-none"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <Select
                    value={line.procurementLineId ?? ""}
                    onChange={(event) => {
                      const procurementLineId = event.target.value || null;
                      const target = doc.procurementLines.find(
                        (candidate) => candidate.id === procurementLineId,
                      );
                      updateOfferteLine(line.id, {
                        procurementLineId,
                        // A quote almost always describes the post it is linked
                        // to, so save the retyping unless there is already text.
                        ...(target && line.description.trim() === ""
                          ? { description: target.title }
                          : {}),
                      });
                    }}
                    className="h-7 w-52 text-[11px]"
                  >
                    <option value="">{t("offertes.unlinked")}</option>
                    {linkGroups.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.lines.map((procurementLine) => (
                          <option
                            key={procurementLine.id}
                            value={procurementLine.id}
                          >
                            {procurementLine.title}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                </td>
                <td className="px-3 py-1.5 text-right">
                  <input
                    type="number"
                    value={line.qty}
                    onChange={(event) =>
                      updateOfferteLine(line.id, {
                        qty: Number(event.target.value) || 0,
                      })
                    }
                    className="w-16 bg-transparent text-right outline-none"
                  />
                </td>
                <td className="px-3 py-1.5 text-right">
                  <input
                    defaultValue={(line.unitPriceCents / 100).toFixed(2)}
                    onBlur={(event) => {
                      const cents = parseAmountInput(event.target.value);
                      if (cents !== null)
                        updateOfferteLine(line.id, { unitPriceCents: cents });
                    }}
                    className="w-24 bg-transparent text-right tabular-nums outline-none"
                  />
                </td>
                <td className="px-3 py-1.5 text-right">
                  <input
                    type="number"
                    value={line.vatPct}
                    onChange={(event) =>
                      updateOfferteLine(line.id, {
                        vatPct: Number(event.target.value) || DEFAULT_VAT_PCT,
                      })
                    }
                    className="w-14 bg-transparent text-right outline-none"
                  />
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {formatCentsPrecise(
                    lineTotalExVat(line.qty, line.unitPriceCents),
                    currency,
                  )}
                </td>
                <td className="px-3 py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => removeOfferteLine(line.id)}
                    className="muted hover:text-rose-500"
                    title={t("common.delete")}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td colSpan={7} className="muted px-3 py-4 text-center">
                  {t("common.empty")}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="border-t border-subtle font-medium">
            <tr>
              <td colSpan={5} className="px-3 py-2 text-right">
                {t("offertes.exVat")}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatCentsPrecise(totals.exVatCents, currency)}
              </td>
              <td />
            </tr>
            <tr>
              <td colSpan={5} className="px-3 py-2 text-right">
                {t("offertes.incVat")}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatCentsPrecise(totals.incVatCents, currency)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function ComparisonView() {
  const t = useT();
  const doc = useProjectStore((state) => state.doc)!;
  const chooseOfferte = useProjectStore((state) => state.chooseOfferte);
  const currency = doc.project.currency;

  const rows = useMemo(
    () =>
      doc.procurementLines
        .map((line) => ({
          line,
          quotes: quotesForLine(doc, line.id, { includeRejected: true }),
        }))
        .filter((row) => row.quotes.length > 0),
    [doc],
  );

  if (rows.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          icon={<Icon name="euro" size={24} />}
          title={t("offertes.empty")}
          hint={t("offertes.emptyHint")}
        />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4">
      <div className="flex flex-col gap-3">
        {rows.map(({ line, quotes }) => {
          // Quotes arrive cheapest first, so the first one still in the running
          // is the price everything else is measured against.
          const cheapest =
            quotes.find((quote) => quote.offerte.status !== "afgewezen") ??
            quotes[0]!;
          return (
            <section key={line.id} className="panel p-3">
              <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">{line.title}</h2>
                <span className="muted text-xs tabular-nums">
                  {t("procurement.budget")}:{" "}
                  {formatCents(line.budgetCents, currency)}
                </span>
              </header>
              <ul className="flex flex-col gap-1">
                {quotes.map((quote) => {
                  const supplier = doc.suppliers.find(
                    (candidate) => candidate.id === quote.offerte.supplierId,
                  );
                  const rejected = quote.offerte.status === "afgewezen";
                  const isCheapest =
                    !rejected && quote.offerte.id === cheapest.offerte.id;
                  const delta = quote.exVatCents - cheapest.exVatCents;
                  return (
                    <li
                      key={quote.offerte.id}
                      className={clsx(
                        "flex flex-wrap items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs",
                        isCheapest
                          ? "bg-emerald-500/10"
                          : "bg-[var(--surface-sunken)]",
                        rejected && "opacity-55",
                      )}
                    >
                      <span className="min-w-32 flex-1 truncate font-medium">
                        {supplier?.name || t("offertes.noSupplier")}
                      </span>
                      <Badge colour={OFFERTE_STATUS_COLOUR[quote.offerte.status]}>
                        {t(`offerteStatus.${quote.offerte.status}`)}
                      </Badge>
                      {isCheapest && (
                        <Badge colour={STATUS_COLOUR.gebouwd}>
                          {t("offertes.cheapest")}
                        </Badge>
                      )}
                      <span className="tabular-nums">
                        {formatCents(quote.exVatCents, currency)}
                      </span>
                      {delta > 0 && (
                        <span className="muted tabular-nums">
                          +{formatCents(delta, currency)}
                        </span>
                      )}
                      {quote.offerte.status !== "gekozen" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => chooseOfferte(quote.offerte.id)}
                        >
                          {t("offertes.choose")}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function SuppliersView() {
  const t = useT();
  const doc = useProjectStore((state) => state.doc)!;
  const addSupplier = useProjectStore((state) => state.addSupplier);
  const updateSupplier = useProjectStore((state) => state.updateSupplier);
  const removeSupplier = useProjectStore((state) => state.removeSupplier);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="muted text-xs">
          {t("offertes.suppliers")}: {doc.suppliers.length}
        </p>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Icon name="plus" size={14} /> {t("offertes.addSupplier")}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {doc.suppliers.map((supplier) => (
          <div key={supplier.id} className="panel flex flex-col gap-2 p-3">
            <div className="flex items-start justify-between gap-2">
              <input
                value={supplier.name}
                onChange={(event) =>
                  updateSupplier(supplier.id, { name: event.target.value })
                }
                className="w-full bg-transparent text-sm font-semibold outline-none"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => removeSupplier(supplier.id)}
                title={t("common.delete")}
              >
                <Icon name="trash" size={13} />
              </Button>
            </div>
            <Field label={t("offertes.contact")}>
              <Input
                value={supplier.contact ?? ""}
                onChange={(event) =>
                  updateSupplier(supplier.id, {
                    contact: event.target.value || null,
                  })
                }
                className="h-8 text-xs"
              />
            </Field>
            <Field label={t("offertes.email")}>
              <Input
                value={supplier.email ?? ""}
                onChange={(event) =>
                  updateSupplier(supplier.id, {
                    email: event.target.value || null,
                  })
                }
                className="h-8 text-xs"
              />
            </Field>
            <Field label={t("offertes.phone")}>
              <Input
                value={supplier.phone ?? ""}
                onChange={(event) =>
                  updateSupplier(supplier.id, {
                    phone: event.target.value || null,
                  })
                }
                className="h-8 text-xs"
              />
            </Field>
          </div>
        ))}
        {doc.suppliers.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3">
            <EmptyState
              icon={<Icon name="info" size={24} />}
              title={t("offertes.suppliers")}
              hint={t("offertes.emptyHint")}
            />
          </div>
        )}
      </div>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title={t("offertes.newSupplier")}
        footer={
          <>
            <Button onClick={() => setCreating(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              disabled={name.trim() === ""}
              onClick={() => {
                addSupplier({ name: name.trim() });
                setName("");
                setCreating(false);
              }}
            >
              {t("common.save")}
            </Button>
          </>
        }
      >
        <Field label={t("common.name")}>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}
