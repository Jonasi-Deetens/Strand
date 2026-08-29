import { useCallback, useMemo, useState } from "react";
import { EmptyState } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { type Category } from "@/domain/types";
import { useT } from "@/i18n/useT";
import { useEditorStore } from "@/store/useEditorStore";
import { useProjectStore } from "@/store/useProjectStore";
import { beachScene } from "@/store/selectors";
import { ExportMenu } from "@/features/export/ExportMenu";
import { EditorToolbar } from "./EditorToolbar";
import { Inspector } from "./Inspector";
import { LayersLegend } from "./LayersLegend";
import { Palette } from "./Palette";
import { PlanCanvas } from "./PlanCanvas";
import { ShortcutsHelp } from "./ShortcutsHelp";
import { fitView, zoomAt } from "./canvasUtils";
import { useEditorShortcuts } from "./useEditorShortcuts";

export function PlanPage() {
  const t = useT();
  const doc = useProjectStore((state) => state.doc);
  const ensureInteriorScene = useProjectStore(
    (state) => state.ensureInteriorScene,
  );
  const activeSceneId = useEditorStore((state) => state.activeSceneId);
  const setActiveScene = useEditorStore((state) => state.setActiveScene);
  const view = useEditorStore((state) => state.view);
  const setView = useEditorStore((state) => state.setView);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

  useEditorShortcuts();

  const beach = doc ? beachScene(doc) : null;
  const scene = useMemo(() => {
    if (!doc) return null;
    if (activeSceneId) {
      return doc.scenes.find((candidate) => candidate.id === activeSceneId) ?? beach;
    }
    return beach;
  }, [activeSceneId, beach, doc]);

  const itemTypes = useMemo(
    () => new Map((doc?.itemTypes ?? []).map((itemType) => [itemType.id, itemType])),
    [doc?.itemTypes],
  );

  const sceneObjects = useMemo(
    () => (doc && scene ? doc.objects.filter((o) => o.sceneId === scene.id) : []),
    [doc, scene],
  );

  const countByType = useMemo(() => {
    const counts = new Map<string, number>();
    for (const object of sceneObjects) {
      counts.set(object.itemTypeId, (counts.get(object.itemTypeId) ?? 0) + 1);
    }
    return counts;
  }, [sceneObjects]);

  const categoryRows = useMemo(() => {
    const rows = new Map<Category, { count: number; colour: string }>();
    for (const object of sceneObjects) {
      const itemType = itemTypes.get(object.itemTypeId);
      if (!itemType) continue;
      const row = rows.get(itemType.category) ?? {
        count: 0,
        colour: itemType.colour,
      };
      row.count += 1;
      rows.set(itemType.category, row);
    }
    return [...rows.entries()].map(([category, row]) => ({ category, ...row }));
  }, [itemTypes, sceneObjects]);

  const breadcrumb = useMemo(() => {
    if (!doc || !scene || !beach) return [];
    if (scene.kind === "beach") return [{ id: null, name: beach.name }];
    const parent = doc.objects.find(
      (object) => object.id === scene.parentObjectId,
    );
    const parentType = parent ? itemTypes.get(parent.itemTypeId) : null;
    return [
      { id: null, name: beach.name },
      {
        id: scene.id,
        name: parent?.label ?? parentType?.nameNl ?? scene.name,
      },
    ];
  }, [beach, doc, itemTypes, scene]);

  const handleOpenInterior = useCallback(
    (objectId: string) => {
      const sceneId = ensureInteriorScene(objectId);
      if (sceneId) setActiveScene(sceneId);
    },
    [ensureInteriorScene, setActiveScene],
  );

  const handleZoom = useCallback(
    (factor: number) => {
      setView(
        zoomAt(
          view,
          { x: stageSize.width / 2, y: stageSize.height / 2 },
          factor,
        ),
      );
    },
    [setView, stageSize, view],
  );

  const handleZoomFit = useCallback(() => {
    if (!scene) return;
    setView(fitView(scene, stageSize));
  }, [scene, setView, stageSize]);

  if (!doc || !scene) return null;

  return (
    <div className="flex h-full min-w-0">
      <div className="flex w-60 shrink-0 flex-col border-r border-subtle bg-[var(--surface-raised)]">
        <Palette
          itemTypes={doc.itemTypes}
          placement={scene.kind === "interior" ? "interior" : "beach"}
          countByType={countByType}
          currency={doc.project.currency}
        />
        <LayersLegend categories={categoryRows} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <EditorToolbar
          scene={scene}
          breadcrumb={breadcrumb}
          onZoom={handleZoom}
          onZoomFit={handleZoomFit}
          trailing={
            <>
              <ExportMenu />
              <ShortcutsHelp />
            </>
          }
        />
        <div
          className="relative min-h-0 flex-1"
          ref={(node) => {
            if (!node) return;
            const rect = node.getBoundingClientRect();
            if (
              Math.abs(rect.width - stageSize.width) > 1 ||
              Math.abs(rect.height - stageSize.height) > 1
            ) {
              setStageSize({ width: rect.width, height: rect.height });
            }
          }}
        >
          <PlanCanvas
            scene={scene}
            objects={sceneObjects}
            itemTypes={itemTypes}
            onOpenInterior={handleOpenInterior}
          />
          {sceneObjects.length === 0 && (
            {/* Never interactive: it sits over the middle of the canvas, which
                is exactly where the first object gets placed. */}
            <div className="pointer-events-none absolute inset-0 grid place-items-center p-8">
              <div className="max-w-sm">
                <EmptyState
                  icon={
                    <Icon
                      name={scene.kind === "interior" ? "counter" : "umbrella"}
                      size={28}
                    />
                  }
                  title={
                    scene.kind === "interior"
                      ? t("editor.emptyInterior")
                      : t("editor.empty")
                  }
                  hint={
                    scene.kind === "interior"
                      ? t("editor.emptyInteriorHint")
                      : t("editor.emptyHint")
                  }
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="w-72 shrink-0 border-l border-subtle bg-[var(--surface-raised)]">
        <Inspector
          scene={scene}
          objects={sceneObjects}
          itemTypes={itemTypes}
          onOpenInterior={handleOpenInterior}
        />
      </div>
    </div>
  );
}
