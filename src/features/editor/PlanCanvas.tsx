import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Circle,
  Group,
  Label,
  Layer,
  Line,
  Rect,
  Stage,
  Tag,
  Text,
  Transformer,
} from "react-konva";
import type Konva from "konva";
import { STATUS_COLOUR } from "@/domain/status";
import { type ItemType, type PlanObject, type Scene } from "@/domain/types";
import {
  arrayPositions,
  boundingBox,
  findGuides,
  rectsOverlap,
  type Rect as ModelRect,
} from "@/lib/geometry";
import {
  MM_PER_M,
  SNAP_MM,
  areaM2,
  clamp,
  formatM,
  formatM2,
  snapAngle,
  snapMm,
} from "@/lib/units";
import { useEditorStore } from "@/store/useEditorStore";
import { useProjectStore } from "@/store/useProjectStore";
import { registerStage } from "@/features/export/png";
import { registerDropTarget } from "./paletteDrag";
import { fitView, gridStepMm, toModel, zoomAt, type Size } from "./canvasUtils";
import { CanvasRulers } from "./CanvasRulers";
import { ObjectShape } from "./ObjectShape";
import { useCanvasTheme } from "./useCanvasTheme";

interface PlanCanvasProps {
  scene: Scene;
  objects: PlanObject[];
  itemTypes: Map<string, ItemType>;
  /** Object id to the number of items on its interior sheet. */
  interiorCounts: Map<string, number>;
  onOpenInterior: (objectId: string) => void;
}

const GUIDE_TOLERANCE_MM = 250;

export function PlanCanvas({
  scene,
  objects,
  itemTypes,
  interiorCounts,
  onOpenInterior,
}: PlanCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodesRef = useRef(new Map<string, Konva.Group>());
  const dragOriginRef = useRef<{ id: string; xMm: number; yMm: number } | null>(
    null,
  );
  const panRef = useRef<{ x: number; y: number } | null>(null);
  const spaceRef = useRef(false);

  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [pointerMm, setPointerMm] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [band, setBand] = useState<ModelRect | null>(null);
  const [guides, setGuides] = useState<{ axis: "x" | "y"; lineMm: number }[]>(
    [],
  );
  const [dragging, setDragging] = useState(false);
  /** Size under an in-progress resize, so the area readout counts up live. */
  const [liveSize, setLiveSize] = useState<{ wMm: number; hMm: number } | null>(
    null,
  );

  const view = useEditorStore((state) => state.view);
  const setView = useEditorStore((state) => state.setView);
  const selection = useEditorStore((state) => state.selection);
  const setSelection = useEditorStore((state) => state.setSelection);
  const toggleInSelection = useEditorStore((state) => state.toggleInSelection);
  const tool = useEditorStore((state) => state.tool);
  const setTool = useEditorStore((state) => state.setTool);
  const placingItemTypeId = useEditorStore((state) => state.placingItemTypeId);
  const paletteDrag = useEditorStore((state) => state.paletteDrag);
  const colourMode = useEditorStore((state) => state.colourMode);
  const showGrid = useEditorStore((state) => state.showGrid);
  const showRulers = useEditorStore((state) => state.showRulers);
  const showLabels = useEditorStore((state) => state.showLabels);
  const snapEnabled = useEditorStore((state) => state.snapEnabled);
  const hiddenCategories = useEditorStore((state) => state.hiddenCategories);
  const lockedCategories = useEditorStore((state) => state.lockedCategories);
  const measure = useEditorStore((state) => state.measure);
  const setMeasure = useEditorStore((state) => state.setMeasure);
  const arraySettings = useEditorStore((state) => state.array);

  const addObjects = useProjectStore((state) => state.addObjects);
  const updateObject = useProjectStore((state) => state.updateObject);
  const beginInteraction = useProjectStore((state) => state.beginInteraction);
  const endInteraction = useProjectStore((state) => state.endInteraction);
  const colours = useCanvasTheme();

  const placingItemType = placingItemTypeId
    ? (itemTypes.get(placingItemTypeId) ?? null)
    : null;

  const visibleObjects = useMemo(
    () =>
      objects.filter((object) => {
        const itemType = itemTypes.get(object.itemTypeId);
        return itemType ? !hiddenCategories.includes(itemType.category) : false;
      }),
    [objects, itemTypes, hiddenCategories],
  );

  const snap = useCallback(
    (value: number) => (snapEnabled ? snapMm(value) : Math.round(value)),
    [snapEnabled],
  );

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Frame the scene the first time it is shown at a usable size.
  const framedSceneRef = useRef<string | null>(null);
  useEffect(() => {
    if (size.width === 0 || framedSceneRef.current === scene.id) return;
    framedSceneRef.current = scene.id;
    setView(fitView(scene, size));
  }, [scene, size, setView]);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    const single = selection.length === 1 ? selection[0] : null;
    const node = single ? nodesRef.current.get(single) : undefined;
    const object = single
      ? visibleObjects.find((candidate) => candidate.id === single)
      : null;
    const itemType = object ? itemTypes.get(object.itemTypeId) : null;
    transformer.nodes(node && object && !object.locked ? [node] : []);
    transformer.resizeEnabled(Boolean(itemType?.resizable));
    transformer.getLayer()?.batchDraw();
  }, [selection, visibleObjects, itemTypes]);

  useEffect(() => {
    registerStage(stageRef.current);
    return () => registerStage(null);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") spaceRef.current = true;
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") spaceRef.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const registerNode = useCallback((id: string, node: Konva.Group | null) => {
    if (node) nodesRef.current.set(id, node);
    else nodesRef.current.delete(id);
  }, []);

  const handleSelect = useCallback(
    (id: string, additive: boolean) => {
      const object = objects.find((candidate) => candidate.id === id);
      const itemType = object ? itemTypes.get(object.itemTypeId) : null;
      if (itemType && lockedCategories.includes(itemType.category)) return;
      if (additive) toggleInSelection(id);
      else if (!selection.includes(id)) setSelection([id]);
    },
    [
      objects,
      itemTypes,
      lockedCategories,
      selection,
      setSelection,
      toggleInSelection,
    ],
  );

  const handleDragStart = useCallback(
    (id: string) => {
      beginInteraction();
      setDragging(true);
      const object = objects.find((candidate) => candidate.id === id);
      if (object) dragOriginRef.current = { id, xMm: object.xMm, yMm: object.yMm };
      if (!selection.includes(id)) setSelection([id]);
    },
    [beginInteraction, objects, selection, setSelection],
  );

  const handleDragMove = useCallback(
    (id: string, rawXMm: number, rawYMm: number) => {
      const origin = dragOriginRef.current;
      const dragged = objects.find((candidate) => candidate.id === id);
      if (!origin || !dragged) return;

      const movingRect: ModelRect = {
        x: rawXMm,
        y: rawYMm,
        w: dragged.wMm,
        h: dragged.hMm,
      };
      const others = objects
        .filter((candidate) => !selection.includes(candidate.id))
        .map((candidate) =>
          boundingBox(
            {
              x: candidate.xMm,
              y: candidate.yMm,
              w: candidate.wMm,
              h: candidate.hMm,
            },
            candidate.rotationDeg,
          ),
        );

      let targetX = snap(rawXMm);
      let targetY = snap(rawYMm);
      const hits = snapEnabled
        ? findGuides(movingRect, others, GUIDE_TOLERANCE_MM)
        : [];
      for (const hit of hits) {
        if (hit.axis === "x") targetX = hit.valueMm;
        else targetY = hit.valueMm;
      }
      setGuides(hits.map((hit) => ({ axis: hit.axis, lineMm: hit.lineMm })));

      const dx = targetX - origin.xMm;
      const dy = targetY - origin.yMm;
      const ids = selection.includes(id) ? selection : [id];

      for (const objectId of ids) {
        const object = objects.find((candidate) => candidate.id === objectId);
        if (!object || object.locked) continue;
        const nextX = clamp(
          object.xMm + dx,
          0,
          Math.max(0, scene.wMm - object.wMm),
        );
        const nextY = clamp(
          object.yMm + dy,
          0,
          Math.max(0, scene.hMm - object.hMm),
        );
        const node = nodesRef.current.get(objectId);
        node?.position({
          x: nextX + object.wMm / 2,
          y: nextY + object.hMm / 2,
        });
      }
    },
    [objects, scene, selection, snap, snapEnabled],
  );

  const handleDragEnd = useCallback(() => {
    const origin = dragOriginRef.current;
    dragOriginRef.current = null;
    setGuides([]);
    setDragging(false);
    if (!origin) return;

    const patches: { id: string; xMm: number; yMm: number }[] = [];
    for (const [id, node] of nodesRef.current) {
      const object = objects.find((candidate) => candidate.id === id);
      if (!object) continue;
      const xMm = Math.round(node.x() - object.wMm / 2);
      const yMm = Math.round(node.y() - object.hMm / 2);
      if (xMm !== object.xMm || yMm !== object.yMm) {
        patches.push({ id, xMm, yMm });
      }
    }
    for (const patch of patches) {
      updateObject(
        patch.id,
        { xMm: patch.xMm, yMm: patch.yMm },
        { history: false },
      );
    }
    endInteraction();
  }, [endInteraction, objects, updateObject]);

  /** Feeds the area readout while a resize handle is being dragged. */
  const handleTransform = useCallback(() => {
    const id = selection[0];
    const node = id ? nodesRef.current.get(id) : undefined;
    const object = objects.find((candidate) => candidate.id === id);
    if (!node || !object) return;
    setLiveSize({
      wMm: Math.max(SNAP_MM * 2, snap(object.wMm * node.scaleX())),
      hMm: Math.max(SNAP_MM * 2, snap(object.hMm * node.scaleY())),
    });
  }, [objects, selection, snap]);

  const handleTransformEnd = useCallback(() => {
    const id = selection[0];
    const node = id ? nodesRef.current.get(id) : undefined;
    const object = objects.find((candidate) => candidate.id === id);
    setLiveSize(null);
    if (!id || !node || !object) return;

    const wMm = Math.max(SNAP_MM * 2, snap(object.wMm * node.scaleX()));
    const hMm = Math.max(SNAP_MM * 2, snap(object.hMm * node.scaleY()));
    const rotationDeg = snapEnabled
      ? snapAngle(node.rotation())
      : Math.round(node.rotation());
    node.scaleX(1);
    node.scaleY(1);

    updateObject(id, {
      wMm,
      hMm,
      rotationDeg,
      xMm: clamp(snap(node.x() - wMm / 2), 0, Math.max(0, scene.wMm - wMm)),
      yMm: clamp(snap(node.y() - hMm / 2), 0, Math.max(0, scene.hMm - hMm)),
    });
  }, [objects, scene, selection, snap, snapEnabled, updateObject]);

  /**
   * Top-left corner in model space for an item dropped at a client point, or
   * null when that point is outside the drawing area.
   */
  const dropAnchor = useCallback(
    (itemTypeId: string, clientX: number, clientY: number) => {
      const itemType = itemTypes.get(itemTypeId);
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!itemType || !bounds) return null;
      if (
        clientX < bounds.left ||
        clientX > bounds.right ||
        clientY < bounds.top ||
        clientY > bounds.bottom
      ) {
        return null;
      }
      const model = toModel(
        { x: clientX - bounds.left, y: clientY - bounds.top },
        view,
      );
      return {
        wMm: itemType.defaultWMm,
        hMm: itemType.defaultHMm,
        colour: itemType.colour,
        xMm: snap(model.x - itemType.defaultWMm / 2),
        yMm: snap(model.y - itemType.defaultHMm / 2),
      };
    },
    [itemTypes, snap, view],
  );

  useEffect(() => {
    registerDropTarget({
      contains: (x, y) => {
        const bounds = containerRef.current?.getBoundingClientRect();
        return Boolean(
          bounds &&
            x >= bounds.left &&
            x <= bounds.right &&
            y >= bounds.top &&
            y <= bounds.bottom,
        );
      },
      drop: (itemTypeId, x, y) => {
        const anchor = dropAnchor(itemTypeId, x, y);
        if (!anchor) return;
        const ids = addObjects([
          { sceneId: scene.id, itemTypeId, xMm: anchor.xMm, yMm: anchor.yMm },
        ]);
        if (ids[0]) setSelection([ids[0]]);
      },
    });
    return () => registerDropTarget(null);
  }, [addObjects, dropAnchor, scene.id, setSelection]);

  /** Returns whether anything was actually placed. */
  const placeAt = useCallback(
    (modelPoint: { x: number; y: number }): boolean => {
      if (!placingItemType) return false;
      const wMm = placingItemType.defaultWMm;
      const hMm = placingItemType.defaultHMm;
      const anchor = {
        x: snap(modelPoint.x - wMm / 2),
        y: snap(modelPoint.y - hMm / 2),
      };

      if (tool === "array") {
        const positions = arrayPositions(
          { ...anchor, w: wMm, h: hMm },
          arraySettings,
        );
        const ids = addObjects(
          positions.map((position) => ({
            sceneId: scene.id,
            itemTypeId: placingItemType.id,
            xMm: position.x,
            yMm: position.y,
          })),
        );
        setSelection(ids);
        return ids.length > 0;
      }

      const id = addObjects([
        {
          sceneId: scene.id,
          itemTypeId: placingItemType.id,
          xMm: anchor.x,
          yMm: anchor.y,
        },
      ])[0];
      if (id) setSelection([id]);
      return Boolean(id);
    },
    [
      addObjects,
      arraySettings,
      placingItemType,
      scene.id,
      setSelection,
      snap,
      tool,
    ],
  );

  const onStageMouseDown = (event: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!stage || !pointer) return;
    const model = toModel(pointer, view);

    if (event.evt.button === 1 || spaceRef.current) {
      panRef.current = { x: pointer.x - view.x, y: pointer.y - view.y };
      return;
    }
    if (event.evt.button !== 0) return;

    if (tool === "place" || tool === "array") {
      const placed = placeAt(model);
      // Shift keeps the tool loaded for repeat placement; a miss keeps it too,
      // so the panel does not vanish before an item has been chosen.
      if (placed && !event.evt.shiftKey) setTool("select");
      return;
    }
    if (tool === "measure") {
      setMeasure({ fromMm: model, toMm: model });
      return;
    }
    // Everything drawn on the plot ignores pointers and object groups stop
    // propagation, so a hit on the bare stage is the only real empty ground.
    // Without this, grabbing a selection handle would clear the selection and
    // leave the transformer without a node to resize.
    if (event.target !== stage) return;
    setBand({ x: model.x, y: model.y, w: 0, h: 0 });
    if (!event.evt.shiftKey) setSelection([]);
  };

  const onStageMouseMove = () => {
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!stage || !pointer) return;
    const model = toModel(pointer, view);
    setPointerMm(model);

    if (panRef.current) {
      setView({ x: pointer.x - panRef.current.x, y: pointer.y - panRef.current.y });
      return;
    }
    if (band) {
      setBand({ ...band, w: model.x - band.x, h: model.y - band.y });
      return;
    }
    if (tool === "measure" && measure) {
      setMeasure({ ...measure, toMm: model });
    }
  };

  const onStageMouseUp = () => {
    panRef.current = null;
    if (!band) return;
    const normalised: ModelRect = {
      x: Math.min(band.x, band.x + band.w),
      y: Math.min(band.y, band.y + band.h),
      w: Math.abs(band.w),
      h: Math.abs(band.h),
    };
    setBand(null);
    if (normalised.w < SNAP_MM && normalised.h < SNAP_MM) return;
    const hits = visibleObjects
      .filter((object) => {
        const itemType = itemTypes.get(object.itemTypeId);
        if (itemType && lockedCategories.includes(itemType.category)) return false;
        return rectsOverlap(
          normalised,
          boundingBox(
            { x: object.xMm, y: object.yMm, w: object.wMm, h: object.hMm },
            object.rotationDeg,
          ),
        );
      })
      .map((object) => object.id);
    setSelection(hits);
  };

  const onWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;
    const factor = event.evt.deltaY < 0 ? 1.12 : 1 / 1.12;
    setView(zoomAt(view, pointer, factor));
  };

  const { minor, major } = gridStepMm(view.scale);
  const gridLines = useMemo(() => {
    if (!showGrid) return [];
    const lines: { points: number[]; major: boolean }[] = [];
    for (let x = 0; x <= scene.wMm; x += minor) {
      lines.push({ points: [x, 0, x, scene.hMm], major: x % major === 0 });
    }
    for (let y = 0; y <= scene.hMm; y += minor) {
      lines.push({ points: [0, y, scene.wMm, y], major: y % major === 0 });
    }
    return lines;
  }, [major, minor, scene.hMm, scene.wMm, showGrid]);

  /**
   * Dashed footprint under the cursor, either for the loaded place/array tool
   * or for an item being dragged in from the palette. Drawn at true scale, so
   * you can see whether a 15 m bar actually fits before letting go.
   */
  const ghost = useMemo(() => {
    const dragged = paletteDrag
      ? (itemTypes.get(paletteDrag.itemTypeId) ?? null)
      : null;
    const item = dragged ?? placingItemType;
    if (!item || !pointerMm) return null;
    if (!dragged && tool !== "place" && tool !== "array") return null;

    const wMm = item.defaultWMm;
    const hMm = item.defaultHMm;
    const anchor = {
      x: snap(pointerMm.x - wMm / 2),
      y: snap(pointerMm.y - hMm / 2),
    };
    const positions =
      !dragged && tool === "array"
        ? arrayPositions({ ...anchor, w: wMm, h: hMm }, arraySettings)
        : [anchor];
    return { positions, wMm, hMm, colour: item.colour };
  }, [
    arraySettings,
    itemTypes,
    paletteDrag,
    placingItemType,
    pointerMm,
    snap,
    tool,
  ]);

  /**
   * Size and area of the single selected object, drawn on the object itself.
   * Counts up live while a resize handle is dragged, and hides while the object
   * is moved because the label is anchored to the stored position.
   */
  const areaReadout = useMemo(() => {
    const id = selection.length === 1 ? selection[0] : null;
    if (dragging || !id) return null;
    const object = visibleObjects.find((candidate) => candidate.id === id);
    if (!object) return null;
    const wMm = liveSize?.wMm ?? object.wMm;
    const hMm = liveSize?.hMm ?? object.hMm;
    const area = areaM2(wMm, hMm);
    const target = itemTypes.get(object.itemTypeId)?.targetAreaM2 ?? null;
    return {
      xMm: object.xMm,
      yMm: object.yMm,
      text: `${formatM(wMm)} × ${formatM(hMm)} · ${formatM2(area)}${
        target === null ? "" : ` / ${formatM2(target)}`
      }`,
      onTarget: target === null || Math.abs(area - target) < 0.5,
    };
  }, [dragging, itemTypes, liveSize, selection, visibleObjects]);

  const measureLength =
    measure &&
    Math.hypot(
      measure.toMm.x - measure.fromMm.x,
      measure.toMm.y - measure.fromMm.y,
    );

  const cursor =
    tool === "place" || tool === "array"
      ? "copy"
      : tool === "measure"
        ? "crosshair"
        : "default";

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden"
      style={{ background: colours.background, cursor }}
    >
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        onMouseDown={onStageMouseDown}
        onMouseMove={onStageMouseMove}
        onMouseUp={onStageMouseUp}
        onMouseLeave={() => {
          panRef.current = null;
          setPointerMm(null);
        }}
        onWheel={onWheel}
        onContextMenu={(event) => event.evt.preventDefault()}
      >
        <Layer>
          <Group x={view.x} y={view.y} scaleX={view.scale} scaleY={view.scale}>
            <Rect
              width={scene.wMm}
              height={scene.hMm}
              fill={colours.plot}
              shadowColor="#000"
              shadowOpacity={0.25}
              shadowBlur={24 / view.scale}
              listening={false}
            />

            {gridLines.map((line, index) => (
              <Line
                key={index}
                points={line.points}
                stroke={line.major ? colours.gridMajor : colours.grid}
                strokeWidth={(line.major ? 1.1 : 0.6) / view.scale}
                listening={false}
              />
            ))}

            <Rect
              width={scene.wMm}
              height={scene.hMm}
              stroke={colours.gridMajor}
              strokeWidth={2 / view.scale}
              listening={false}
            />

            {scene.kind === "interior" && (
              <Rect
                x={100}
                y={100}
                width={Math.max(0, scene.wMm - 200)}
                height={Math.max(0, scene.hMm - 200)}
                stroke={colours.gridMajor}
                strokeWidth={1.4 / view.scale}
                dash={[400 / view.scale, 300 / view.scale]}
                listening={false}
              />
            )}

            {/* Overall dimensions, centred on their own edge so the two labels
                cannot land on the same corner. */}
            <Text
              x={0}
              y={-26 / view.scale}
              width={scene.wMm}
              align="center"
              text={formatM(scene.wMm, 1)}
              fontSize={14 / view.scale}
              fill={colours.text}
              listening={false}
            />
            <Text
              x={-24 / view.scale}
              y={scene.hMm}
              width={scene.hMm}
              align="center"
              text={formatM(scene.hMm, 1)}
              fontSize={14 / view.scale}
              fill={colours.text}
              rotation={-90}
              listening={false}
            />

            {visibleObjects.map((object) => {
              const itemType = itemTypes.get(object.itemTypeId);
              if (!itemType) return null;
              return (
                <ObjectShape
                  key={object.id}
                  object={object}
                  itemType={itemType}
                  colourMode={colourMode}
                  selected={selection.includes(object.id)}
                  scale={view.scale}
                  showLabel={showLabels}
                  interiorCount={interiorCounts.get(object.id) ?? 0}
                  selectable={tool === "select"}
                  draggable={
                    tool === "select" &&
                    !lockedCategories.includes(itemType.category)
                  }
                  onSelect={handleSelect}
                  onOpenInterior={onOpenInterior}
                  onDragStart={handleDragStart}
                  onDragMove={handleDragMove}
                  onDragEnd={handleDragEnd}
                  registerNode={registerNode}
                />
              );
            })}

            {guides.map((guide, index) => (
              <Line
                key={index}
                points={
                  guide.axis === "x"
                    ? [guide.lineMm, 0, guide.lineMm, scene.hMm]
                    : [0, guide.lineMm, scene.wMm, guide.lineMm]
                }
                stroke={colours.guide}
                strokeWidth={1 / view.scale}
                dash={[300 / view.scale, 200 / view.scale]}
                listening={false}
              />
            ))}

            {ghost?.positions.map((position, index) => (
              <Rect
                key={index}
                x={position.x}
                y={position.y}
                width={ghost.wMm}
                height={ghost.hMm}
                fill={`${ghost.colour}33`}
                stroke={ghost.colour}
                strokeWidth={1.5 / view.scale}
                dash={[400 / view.scale, 250 / view.scale]}
                listening={false}
              />
            ))}

            {band && (
              <Rect
                x={Math.min(band.x, band.x + band.w)}
                y={Math.min(band.y, band.y + band.h)}
                width={Math.abs(band.w)}
                height={Math.abs(band.h)}
                fill={`${colours.accent}22`}
                stroke={colours.accent}
                strokeWidth={1 / view.scale}
                listening={false}
              />
            )}

            {measure && (
              <>
                <Line
                  points={[
                    measure.fromMm.x,
                    measure.fromMm.y,
                    measure.toMm.x,
                    measure.toMm.y,
                  ]}
                  stroke={colours.measure}
                  strokeWidth={1.6 / view.scale}
                  listening={false}
                />
                <Circle
                  x={measure.fromMm.x}
                  y={measure.fromMm.y}
                  radius={4 / view.scale}
                  fill={colours.measure}
                  listening={false}
                />
                <Circle
                  x={measure.toMm.x}
                  y={measure.toMm.y}
                  radius={4 / view.scale}
                  fill={colours.measure}
                  listening={false}
                />
                <Text
                  x={(measure.fromMm.x + measure.toMm.x) / 2}
                  y={(measure.fromMm.y + measure.toMm.y) / 2 - 18 / view.scale}
                  text={`${((measureLength ?? 0) / MM_PER_M).toFixed(2)} m`}
                  fontSize={15 / view.scale}
                  fontStyle="600"
                  fill={colours.measure}
                  listening={false}
                />
              </>
            )}

            {areaReadout && (
              <Label
                x={areaReadout.xMm}
                y={areaReadout.yMm - 26 / view.scale}
                listening={false}
              >
                <Tag
                  fill={
                    areaReadout.onTarget
                      ? colours.accent
                      : STATUS_COLOUR.offerte_aangevraagd
                  }
                  cornerRadius={3 / view.scale}
                />
                <Text
                  text={areaReadout.text}
                  fontSize={12 / view.scale}
                  fontStyle="600"
                  fill="#ffffff"
                  padding={4 / view.scale}
                />
              </Label>
            )}
          </Group>

          {/* Outside the scaled group on purpose: the transformer works in
              absolute stage pixels, so inside it every anchor would be blown
              up by the plot scale. */}
          <Transformer
            ref={transformerRef}
            rotateEnabled
            keepRatio={false}
            rotationSnaps={[0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180]}
            anchorSize={9}
            anchorStroke={colours.accent}
            anchorFill="#ffffff"
            anchorCornerRadius={2}
            borderStroke={colours.accent}
            borderStrokeWidth={1.4}
            rotateAnchorOffset={26}
            onTransform={handleTransform}
            onTransformEnd={handleTransformEnd}
            boundBoxFunc={(_oldBox, newBox) => ({
              ...newBox,
              width: Math.max(SNAP_MM * 2 * view.scale, newBox.width),
              height: Math.max(SNAP_MM * 2 * view.scale, newBox.height),
            })}
          />
        </Layer>
      </Stage>

      {showRulers && (
        <CanvasRulers view={view} size={size} pointerMm={pointerMm} />
      )}

      {pointerMm && (
        <div className="pointer-events-none absolute right-3 bottom-3 rounded-md bg-[var(--surface-raised)]/90 px-2 py-1 font-mono text-[11px] text-[var(--text-muted)] shadow-sm">
          {(pointerMm.x / MM_PER_M).toFixed(1)} ,{" "}
          {(pointerMm.y / MM_PER_M).toFixed(1)} m
        </div>
      )}
    </div>
  );
}
