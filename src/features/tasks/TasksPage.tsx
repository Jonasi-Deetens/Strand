import { useMemo, useState } from "react";
import clsx from "clsx";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/components/Icon";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  ProgressBar,
  Select,
} from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import {
  CATEGORIES,
  STATUSES,
  type Category,
  type Status,
  type Task,
  type TaskStatus,
} from "@/domain/types";
import { STATUS_COLOUR } from "@/domain/status";
import { formatCents, parseAmountInput } from "@/lib/money";
import { useT } from "@/i18n/useT";
import { useProjectStore } from "@/store/useProjectStore";
import { useEditorStore } from "@/store/useEditorStore";
import {
  bestQuoteForLine,
  lineCompletion,
  objectsForLine,
} from "@/store/selectors";

const TASK_STATUSES: TaskStatus[] = ["open", "bezig", "wacht", "klaar"];

export function TasksPage() {
  const t = useT();
  const [tab, setTab] = useState<"tasks" | "lines">("tasks");

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title={t("tasks.title")}
        subtitle={t("tasks.subtitle")}
        tabs={[
          { id: "tasks", label: t("tasks.title") },
          { id: "lines", label: t("procurement.lines") },
        ]}
        activeTab={tab}
        onTab={(id) => setTab(id as "tasks" | "lines")}
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "tasks" ? <TaskList /> : <ProcurementList />}
      </div>
    </div>
  );
}

function TaskList() {
  const t = useT();
  const doc = useProjectStore((state) => state.doc)!;
  const addTask = useProjectStore((state) => state.addTask);
  const updateTask = useProjectStore((state) => state.updateTask);
  const removeTask = useProjectStore((state) => state.removeTask);
  const [showDone, setShowDone] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ title: "", dueDate: "", assignee: "" });

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const visible = doc.tasks.filter((task) => {
      if (!showDone && task.status === "klaar") return false;
      return !needle || task.title.toLowerCase().includes(needle);
    });
    return TASK_STATUSES.filter(
      (status) => showDone || status !== "klaar",
    ).map((status) => ({
      status,
      tasks: visible
        .filter((task) => task.status === status)
        .sort((a, b) => {
          if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
          if (a.dueDate) return -1;
          if (b.dueDate) return 1;
          return a.sortOrder - b.sortOrder;
        }),
    }));
  }, [doc.tasks, query, showDone]);

  const total = doc.tasks.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("common.search")}
          className="max-w-64"
        />
        <Button active={showDone} onClick={() => setShowDone(!showDone)}>
          <Icon name="check" size={14} /> {t("tasks.showDone")}
        </Button>
        <Button
          variant="primary"
          className="ml-auto"
          onClick={() => setCreating(true)}
        >
          <Icon name="plus" size={14} /> {t("tasks.add")}
        </Button>
      </div>

      {total === 0 ? (
        <EmptyState
          icon={<Icon name="tasks" size={26} />}
          title={t("tasks.empty")}
          hint={t("tasks.emptyHint")}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <section key={group.status} className="panel flex flex-col">
              <header className="flex items-center justify-between border-b border-subtle px-3 py-2">
                <h2 className="text-xs font-semibold tracking-wide uppercase">
                  {t(`taskStatus.${group.status}`)}
                </h2>
                <span className="muted text-xs tabular-nums">
                  {group.tasks.length}
                </span>
              </header>
              <ul className="flex flex-col">
                {group.tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onUpdate={updateTask}
                    onRemove={removeTask}
                  />
                ))}
                {group.tasks.length === 0 && (
                  <li className="muted px-3 py-4 text-xs">{t("common.empty")}</li>
                )}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title={t("tasks.newTask")}
        footer={
          <>
            <Button onClick={() => setCreating(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              disabled={draft.title.trim() === ""}
              onClick={() => {
                addTask({
                  title: draft.title.trim(),
                  dueDate: draft.dueDate || null,
                  assignee: draft.assignee || null,
                });
                setDraft({ title: "", dueDate: "", assignee: "" });
                setCreating(false);
              }}
            >
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label={t("common.title")}>
            <Input
              value={draft.title}
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("tasks.due")}>
              <Input
                type="date"
                value={draft.dueDate}
                onChange={(event) =>
                  setDraft({ ...draft, dueDate: event.target.value })
                }
              />
            </Field>
            <Field label={t("tasks.assignee")}>
              <Input
                value={draft.assignee}
                onChange={(event) =>
                  setDraft({ ...draft, assignee: event.target.value })
                }
              />
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function TaskRow({
  task,
  onUpdate,
  onRemove,
}: {
  task: Task;
  onUpdate: (id: string, patch: Partial<Task>) => void;
  onRemove: (id: string) => void;
}) {
  const t = useT();
  const doc = useProjectStore((state) => state.doc)!;
  const setSelection = useEditorStore((state) => state.setSelection);
  const setActiveScene = useEditorStore((state) => state.setActiveScene);
  const navigate = useNavigate();

  const line = task.procurementLineId
    ? doc.procurementLines.find(
        (candidate) => candidate.id === task.procurementLineId,
      )
    : null;
  const objects = line ? objectsForLine(doc, line.id) : [];
  const done = task.status === "klaar";

  const showOnPlan = () => {
    if (objects.length === 0) return;
    const first = objects[0]!;
    setActiveScene(
      doc.scenes.find((scene) => scene.id === first.sceneId)?.kind === "beach"
        ? null
        : first.sceneId,
    );
    setSelection(objects.map((object) => object.id));
    navigate("/plan");
  };

  return (
    <li className="flex flex-col gap-1.5 border-b border-subtle px-3 py-2 last:border-b-0">
      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-label={t("taskStatus.klaar")}
          onClick={() =>
            onUpdate(task.id, { status: done ? "open" : "klaar" })
          }
          className={clsx(
            "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors",
            done
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-subtle hover:border-sea-400",
          )}
        >
          {done && <Icon name="check" size={11} strokeWidth={3} />}
        </button>
        <div className="min-w-0 flex-1">
          <input
            value={task.title}
            onChange={(event) => onUpdate(task.id, { title: event.target.value })}
            className={clsx(
              "w-full bg-transparent text-[13px] outline-none",
              done && "muted line-through",
            )}
          />
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {line && (
              <>
                <Badge colour={STATUS_COLOUR[line.status]}>
                  {t(`status.${line.status}`)}
                </Badge>
                <Badge>{`${line.qtyPlanned} ${line.unit}`}</Badge>
              </>
            )}
            {task.auto ? (
              <Badge>{t("tasks.auto")}</Badge>
            ) : (
              <Badge>{t("tasks.manual")}</Badge>
            )}
            {objects.length > 0 && (
              <button
                type="button"
                onClick={showOnPlan}
                className="text-[10px] text-sea-600 hover:underline dark:text-sea-300"
              >
                {t("dashboard.toPlan")}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pl-6">
        <Select
          value={task.status}
          onChange={(event) =>
            onUpdate(task.id, { status: event.target.value as TaskStatus })
          }
          className="h-7 w-28 text-[11px]"
        >
          {TASK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`taskStatus.${status}`)}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          value={task.dueDate ?? ""}
          onChange={(event) =>
            onUpdate(task.id, { dueDate: event.target.value || null })
          }
          className="h-7 w-36 text-[11px]"
        />
        <Input
          value={task.assignee ?? ""}
          placeholder={t("tasks.assignee")}
          onChange={(event) =>
            onUpdate(task.id, { assignee: event.target.value || null })
          }
          className="h-7 w-28 text-[11px]"
        />
        {!task.auto && (
          <Button
            size="icon"
            variant="ghost"
            className="ml-auto h-7 w-7"
            title={t("common.delete")}
            onClick={() => onRemove(task.id)}
          >
            <Icon name="trash" size={13} />
          </Button>
        )}
      </div>
    </li>
  );
}

function ProcurementList() {
  const t = useT();
  const doc = useProjectStore((state) => state.doc)!;
  const setLineStatus = useProjectStore((state) => state.setLineStatus);
  const updateLine = useProjectStore((state) => state.updateLine);
  const removeLine = useProjectStore((state) => state.removeLine);
  const addManualLine = useProjectStore((state) => state.addManualLine);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    category: "overig" as Category,
    unit: "post",
    qtyPlanned: 1,
    budget: "",
  });

  const currency = doc.project.currency;
  const lines = [...doc.procurementLines].sort(
    (a, b) => b.budgetCents - a.budgetCents,
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="muted text-xs">
          {t("procurement.lines")}: {lines.length}
        </p>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Icon name="plus" size={14} /> {t("procurement.addManual")}
        </Button>
      </div>

      <div className="panel overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="muted border-b border-subtle text-[10px] tracking-wider uppercase">
            <tr>
              <th className="px-3 py-2">{t("common.title")}</th>
              <th className="px-3 py-2">{t("common.category")}</th>
              <th className="px-3 py-2 text-right">{t("common.qty")}</th>
              <th className="px-3 py-2 text-right">{t("procurement.budget")}</th>
              <th className="px-3 py-2 text-right">
                {t("procurement.bestQuote")}
              </th>
              <th className="px-3 py-2">{t("common.status")}</th>
              <th className="px-3 py-2 w-32">{t("procurement.progress")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const quote = bestQuoteForLine(doc, line.id);
              const completion = lineCompletion(doc, line);
              const delta = quote ? quote.exVatCents - line.budgetCents : 0;
              return (
                <tr key={line.id} className="border-b border-subtle last:border-b-0">
                  <td className="px-3 py-2">
                    <input
                      value={line.title}
                      onChange={(event) =>
                        updateLine(line.id, { title: event.target.value })
                      }
                      className="w-full bg-transparent font-medium outline-none"
                    />
                    <span className="muted text-[10px]">
                      {line.derived
                        ? t("procurement.derived")
                        : t("procurement.manual")}
                    </span>
                  </td>
                  <td className="px-3 py-2">{t(`category.${line.category}`)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {line.derived ? (
                      `${line.qtyPlanned} ${line.unit}`
                    ) : (
                      <input
                        type="number"
                        value={line.qtyPlanned}
                        onChange={(event) =>
                          updateLine(line.id, {
                            qtyPlanned: Number(event.target.value) || 0,
                          })
                        }
                        className="w-16 bg-transparent text-right outline-none"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {line.derived ? (
                      formatCents(line.budgetCents, currency)
                    ) : (
                      <input
                        defaultValue={(line.budgetCents / 100).toFixed(0)}
                        onBlur={(event) => {
                          const cents = parseAmountInput(event.target.value);
                          if (cents !== null)
                            updateLine(line.id, { budgetCents: cents });
                        }}
                        className="w-24 bg-transparent text-right outline-none"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {quote ? (
                      <span
                        style={{
                          color:
                            delta > 0 ? STATUS_COLOUR.offerte_aangevraagd : undefined,
                        }}
                      >
                        {formatCents(quote.exVatCents, currency)}
                      </span>
                    ) : (
                      <span className="muted">{t("procurement.noQuote")}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={line.status}
                      onChange={(event) =>
                        setLineStatus(line.id, event.target.value as Status)
                      }
                      className="h-7 w-40 text-[11px]"
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {t(`status.${status}`)}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <ProgressBar value={completion} />
                    <span className="muted text-[10px] tabular-nums">
                      {Math.round(completion * 100)}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!line.derived && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        title={t("common.delete")}
                        onClick={() => removeLine(line.id)}
                      >
                        <Icon name="trash" size={13} />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title={t("procurement.addManual")}
        footer={
          <>
            <Button onClick={() => setCreating(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              disabled={draft.title.trim() === ""}
              onClick={() => {
                addManualLine({
                  title: draft.title.trim(),
                  category: draft.category,
                  unit: draft.unit,
                  qtyPlanned: draft.qtyPlanned,
                  budgetCents: parseAmountInput(draft.budget) ?? 0,
                });
                setDraft({
                  title: "",
                  category: "overig",
                  unit: "post",
                  qtyPlanned: 1,
                  budget: "",
                });
                setCreating(false);
              }}
            >
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label={t("common.title")}>
            <Input
              value={draft.title}
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
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
            <Field label={t("common.unit")}>
              <Input
                value={draft.unit}
                onChange={(event) =>
                  setDraft({ ...draft, unit: event.target.value })
                }
              />
            </Field>
            <Field label={t("common.qty")}>
              <Input
                type="number"
                value={draft.qtyPlanned}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    qtyPlanned: Number(event.target.value) || 1,
                  })
                }
              />
            </Field>
            <Field label={`${t("procurement.budget")} (${currency})`}>
              <Input
                value={draft.budget}
                onChange={(event) =>
                  setDraft({ ...draft, budget: event.target.value })
                }
              />
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}
