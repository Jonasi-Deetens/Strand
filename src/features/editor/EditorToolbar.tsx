import { Icon } from "@/components/Icon";
import { Button, Divider, Input, Toolbar } from "@/components/ui";
import { type Scene } from "@/domain/types";
import { mmToM, mToMm } from "@/lib/units";
import { useT } from "@/i18n/useT";
import { useEditorStore } from "@/store/useEditorStore";
import { useProjectStore } from "@/store/useProjectStore";

interface EditorToolbarProps {
  scene: Scene;
  onZoom: (factor: number) => void;
  onZoomFit: () => void;
  breadcrumb: { id: string | null; name: string }[];
  trailing?: React.ReactNode;
}

export function EditorToolbar({
  scene,
  onZoom,
  onZoomFit,
  breadcrumb,
  trailing,
}: EditorToolbarProps) {
  const t = useT();
  const tool = useEditorStore((state) => state.tool);
  const setTool = useEditorStore((state) => state.setTool);
  const colourMode = useEditorStore((state) => state.colourMode);
  const setColourMode = useEditorStore((state) => state.setColourMode);
  const showGrid = useEditorStore((state) => state.showGrid);
  const toggleGrid = useEditorStore((state) => state.toggleGrid);
  const showRulers = useEditorStore((state) => state.showRulers);
  const toggleRulers = useEditorStore((state) => state.toggleRulers);
  const showLabels = useEditorStore((state) => state.showLabels);
  const toggleLabels = useEditorStore((state) => state.toggleLabels);
  const snapEnabled = useEditorStore((state) => state.snapEnabled);
  const toggleSnap = useEditorStore((state) => state.toggleSnap);
  const setActiveScene = useEditorStore((state) => state.setActiveScene);
  const array = useEditorStore((state) => state.array);
  const setArray = useEditorStore((state) => state.setArray);
  const placingItemTypeId = useEditorStore((state) => state.placingItemTypeId);

  const undo = useProjectStore((state) => state.undo);
  const redo = useProjectStore((state) => state.redo);
  const past = useProjectStore((state) => state.past.length);
  const future = useProjectStore((state) => state.future.length);

  return (
    <div className="flex flex-col gap-2 border-b border-subtle px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <nav className="flex min-w-0 items-center gap-1 text-xs">
          {breadcrumb.map((crumb, index) => (
            <span key={crumb.id ?? "root"} className="flex items-center gap-1">
              {index > 0 && <Icon name="chevronRight" size={12} className="muted" />}
              <button
                type="button"
                onClick={() => setActiveScene(crumb.id)}
                className={
                  index === breadcrumb.length - 1
                    ? "font-semibold"
                    : "muted hover:underline"
                }
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </nav>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Toolbar>
            <Button
              size="icon"
              variant="ghost"
              title={t("editor.undo")}
              disabled={past === 0}
              onClick={undo}
            >
              <Icon name="undoIcon" size={16} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              title={t("editor.redo")}
              disabled={future === 0}
              onClick={redo}
            >
              <Icon name="redoIcon" size={16} />
            </Button>
          </Toolbar>

          <Toolbar>
            <Button
              size="icon"
              variant="ghost"
              active={tool === "select"}
              title={t("editor.escape")}
              onClick={() => setTool("select")}
            >
              <Icon name="cursor" size={16} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              active={tool === "array"}
              title={t("editor.arrayTool")}
              onClick={() => setTool(tool === "array" ? "select" : "array")}
            >
              <Icon name="arrayTool" size={16} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              active={tool === "measure"}
              title={t("editor.measure")}
              onClick={() => setTool(tool === "measure" ? "select" : "measure")}
            >
              <Icon name="measureTool" size={16} />
            </Button>
          </Toolbar>

          <Toolbar>
            <Button
              size="icon"
              variant="ghost"
              title={t("editor.zoomOut")}
              onClick={() => onZoom(1 / 1.2)}
            >
              <Icon name="zoomOut" size={16} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              title={t("editor.zoomIn")}
              onClick={() => onZoom(1.2)}
            >
              <Icon name="zoomIn" size={16} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              title={t("editor.zoomFit")}
              onClick={onZoomFit}
            >
              <Icon name="fit" size={16} />
            </Button>
          </Toolbar>

          <Toolbar>
            <Button
              size="icon"
              variant="ghost"
              active={showGrid}
              title={t("editor.grid")}
              onClick={toggleGrid}
            >
              <Icon name="grid" size={16} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              active={showRulers}
              title={`${t("editor.rulers")} (⇧R)`}
              onClick={toggleRulers}
            >
              {t("editor.rulersShort")}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              active={showLabels}
              title={t("editor.labels")}
              onClick={toggleLabels}
            >
              <Icon name="file" size={16} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              active={snapEnabled}
              title={t("editor.snap")}
              onClick={toggleSnap}
            >
              {t("editor.snap")}
            </Button>
          </Toolbar>

          <Toolbar>
            <span className="muted px-1.5 text-[11px]">
              {t("editor.colourMode")}
            </span>
            <Button
              size="sm"
              variant="ghost"
              active={colourMode === "status"}
              onClick={() => setColourMode("status")}
            >
              {t("editor.colourByStatus")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              active={colourMode === "type"}
              onClick={() => setColourMode("type")}
            >
              {t("editor.colourByType")}
            </Button>
          </Toolbar>

          {trailing}
        </div>
      </div>

      {tool === "array" && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-subtle bg-[var(--surface-sunken)] px-3 py-2">
          <span className="flex items-center gap-1.5 text-xs font-medium">
            <Icon name="arrayTool" size={14} /> {t("editor.arrayTool")}
          </span>
          <Divider />
          {!placingItemTypeId && (
            <span className="muted text-[11px]">{t("editor.arrayNeedsItem")}</span>
          )}
          <label className="flex items-center gap-1.5 text-[11px]">
            {t("editor.arrayCount")}
            <Input
              type="number"
              min={1}
              max={200}
              value={array.count}
              onChange={(event) =>
                setArray({ count: Math.max(1, Number(event.target.value) || 1) })
              }
              className="h-7 w-16 text-xs"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[11px]">
            {t("editor.arraySpacing")} (m)
            <Input
              type="number"
              step={0.1}
              min={0.1}
              value={mmToM(array.spacingMm)}
              onChange={(event) =>
                setArray({
                  spacingMm: mToMm(Math.max(0.1, Number(event.target.value) || 1)),
                })
              }
              className="h-7 w-20 text-xs"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[11px]">
            {t("editor.arrayRows")}
            <Input
              type="number"
              min={1}
              max={50}
              value={array.rows}
              onChange={(event) =>
                setArray({ rows: Math.max(1, Number(event.target.value) || 1) })
              }
              className="h-7 w-16 text-xs"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[11px]">
            {t("editor.arrayRowSpacing")} (m)
            <Input
              type="number"
              step={0.1}
              min={0.1}
              value={mmToM(array.rowSpacingMm)}
              onChange={(event) =>
                setArray({
                  rowSpacingMm: mToMm(
                    Math.max(0.1, Number(event.target.value) || 1),
                  ),
                })
              }
              className="h-7 w-20 text-xs"
            />
          </label>
          <Toolbar className="ml-auto">
            <Button
              size="sm"
              variant="ghost"
              active={array.direction === "horizontal"}
              onClick={() => setArray({ direction: "horizontal" })}
            >
              {t("editor.horizontal")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              active={array.direction === "vertical"}
              onClick={() => setArray({ direction: "vertical" })}
            >
              {t("editor.vertical")}
            </Button>
          </Toolbar>
        </div>
      )}

      {tool === "measure" && (
        <p className="muted px-1 text-[11px]">{t("editor.measureHint")}</p>
      )}
      {scene.kind === "interior" && (
        <p className="muted px-1 text-[11px]">{t("editor.interior")}</p>
      )}
    </div>
  );
}
