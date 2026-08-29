import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@/components/Icon";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ProgressBar,
  Stat,
  StatusPill,
} from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { STATUS_COLOUR } from "@/domain/status";
import { formatCents } from "@/lib/money";
import { formatM2, mmToM } from "@/lib/units";
import { useT } from "@/i18n/useT";
import { useProjectStore } from "@/store/useProjectStore";
import { cabinFillSummary } from "@/domain/cabinStock";
import {
  categorySummaries,
  expiringOffertes,
  openTasks,
  plotCoverage,
  projectTotals,
} from "@/store/selectors";

export function DashboardPage() {
  const t = useT();
  const doc = useProjectStore((state) => state.doc)!;
  const currency = doc.project.currency;

  const today = new Date().toISOString().slice(0, 10);
  const totals = useMemo(() => projectTotals(doc), [doc]);
  const categories = useMemo(() => categorySummaries(doc), [doc]);
  const allOpenTasks = useMemo(() => openTasks(doc), [doc]);
  const tasks = allOpenTasks.slice(0, 8);
  const overdueCount = allOpenTasks.filter(
    (task) => task.dueDate && task.dueDate < today,
  ).length;
  const expiring = useMemo(() => expiringOffertes(doc, 30), [doc]);
  const coverage = useMemo(() => plotCoverage(doc), [doc]);
  const cabins = useMemo(() => cabinFillSummary(doc), [doc]);
  const beach = doc.scenes.find((scene) => scene.kind === "beach");

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title={t("dashboard.title")}
        subtitle={t("dashboard.subtitle")}
        actions={
          <Link to="/plan">
            <Button variant="primary">
              <Icon name="palette" size={14} /> {t("dashboard.toPlan")}
            </Button>
          </Link>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label={t("dashboard.budget")}
            value={formatCents(totals.budgetCents, currency)}
            sub={`${totals.lineCount} ${t("procurement.lines").toLowerCase()}`}
          />
          <Stat
            label={t("dashboard.expected")}
            value={formatCents(totals.expectedCents, currency)}
            sub={
              totals.potentialSavingCents > 0
                ? `${t("dashboard.cheapestSaving")}: ${formatCents(
                    totals.potentialSavingCents,
                    currency,
                  )}`
                : undefined
            }
            colour={
              totals.expectedCents > totals.budgetCents
                ? STATUS_COLOUR.offerte_aangevraagd
                : undefined
            }
          />
          <Stat
            label={t("dashboard.committed")}
            value={formatCents(totals.committedCents, currency)}
            sub={`${totals.doneLineCount}/${totals.lineCount} ${t("dashboard.built").toLowerCase()}`}
          />
          <Stat
            label={t("dashboard.progress")}
            value={`${Math.round(totals.progress * 100)}%`}
            sub={`${totals.openLineCount} ${t("dashboard.openLines").toLowerCase()}`}
            colour={STATUS_COLOUR.gebouwd}
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card title={t("dashboard.byCategory")} className="lg:col-span-2">
            {categories.length === 0 ? (
              <EmptyState
                icon={<Icon name="palette" size={24} />}
                title={t("dashboard.quickStart")}
                hint={t("dashboard.quickStartHint")}
                action={
                  <Link to="/plan">
                    <Button variant="primary">{t("dashboard.toPlan")}</Button>
                  </Link>
                }
              />
            ) : (
              <ul className="flex flex-col gap-2.5">
                {categories.map((summary) => (
                  <li key={summary.category}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                      <span className="font-medium">
                        {t(`category.${summary.category}`)}
                      </span>
                      <span className="muted tabular-nums">
                        {summary.doneObjectCount}/{summary.objectCount} ·{" "}
                        {formatCents(summary.budgetCents, currency)}
                      </span>
                    </div>
                    <ProgressBar
                      value={summary.progress}
                      colour={
                        summary.progress >= 1
                          ? STATUS_COLOUR.gebouwd
                          : STATUS_COLOUR.besteld
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={t("dashboard.plotSize")}>
            <dl className="flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between">
                <dt className="muted">{t("editor.plot")}</dt>
                <dd className="tabular-nums">
                  {beach
                    ? `${mmToM(beach.wMm).toFixed(0)} × ${mmToM(beach.hMm).toFixed(0)} m`
                    : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="muted">{t("dashboard.objects")}</dt>
                <dd className="tabular-nums">{doc.objects.length}</dd>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <dt className="muted">{t("dashboard.cabinsFilled")}</dt>
                  <dd className="tabular-nums">
                    {cabins.total === 0
                      ? "—"
                      : t("dashboard.cabinsFilledSub", {
                          filled: cabins.filled,
                          total: cabins.total,
                        })}
                  </dd>
                </div>
                <ProgressBar
                  value={cabins.total === 0 ? 0 : cabins.filled / cabins.total}
                  colour={
                    cabins.total > 0 && cabins.filled === cabins.total
                      ? STATUS_COLOUR.gebouwd
                      : STATUS_COLOUR.besteld
                  }
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <dt className="muted">{t("dashboard.coverage")}</dt>
                  <dd className="tabular-nums">
                    {Math.round(coverage * 100)}% ·{" "}
                    {beach
                      ? formatM2(
                          (mmToM(beach.wMm) * mmToM(beach.hMm) * coverage),
                          0,
                        )
                      : "—"}
                  </dd>
                </div>
                <ProgressBar value={coverage} colour={STATUS_COLOUR.besteld} />
              </div>
            </dl>
          </Card>

          <Card
            title={t("dashboard.nextUp")}
            className="lg:col-span-2"
            action={
              overdueCount > 0 ? (
                <Badge colour={STATUS_COLOUR.vervallen}>
                  {t("dashboard.overdue", { count: overdueCount })}
                </Badge>
              ) : undefined
            }
          >
            {tasks.length === 0 ? (
              <p className="muted text-xs">{t("dashboard.noTasks")}</p>
            ) : (
              <ul className="flex flex-col">
                {tasks.map((task) => {
                  const line = doc.procurementLines.find(
                    (candidate) => candidate.id === task.procurementLineId,
                  );
                  return (
                    <li
                      key={task.id}
                      className="flex items-center gap-2 border-b border-subtle py-1.5 text-xs last:border-b-0"
                    >
                      <span className="min-w-0 flex-1 truncate">{task.title}</span>
                      {line && <StatusPill status={line.status} />}
                      <Badge>{t(`taskStatus.${task.status}`)}</Badge>
                      {task.dueDate && (
                        <span
                          className={
                            task.dueDate < today
                              ? "shrink-0 font-medium tabular-nums text-rose-500"
                              : "muted shrink-0 tabular-nums"
                          }
                        >
                          {task.dueDate}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <Link
              to="/taken"
              className="mt-2 inline-block text-[11px] text-sea-600 hover:underline dark:text-sea-300"
            >
              {t("tasks.title")} →
            </Link>
          </Card>

          <Card title={t("dashboard.dueSoon")}>
            {expiring.length === 0 ? (
              <p className="muted text-xs">{t("dashboard.noDueSoon")}</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-xs">
                {expiring.map(({ offerte, days }) => {
                  const supplier = doc.suppliers.find(
                    (candidate) => candidate.id === offerte.supplierId,
                  );
                  return (
                    <li key={offerte.id} className="flex items-center gap-2">
                      <Icon
                        name="clock"
                        size={13}
                        className={days < 0 ? "text-rose-500" : "muted"}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {supplier?.name || offerte.reference || "—"}
                      </span>
                      <span
                        className="shrink-0 tabular-nums"
                        style={{
                          color: days < 0 ? STATUS_COLOUR.vervallen : undefined,
                        }}
                      >
                        {days < 0
                          ? t("offertes.expired")
                          : t("offertes.expiresIn", { days })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
