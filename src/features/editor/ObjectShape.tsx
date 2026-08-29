import { memo } from "react";
import { Circle, Group, Path, Rect, Text } from "react-konva";
import type Konva from "konva";
import { ICON_PATHS } from "@/components/Icon";
import { type ItemType, type PlanObject } from "@/domain/types";
import { catalogImageUrl } from "@/lib/catalogImage";
import { objectStyle } from "./canvasUtils";
import { type ColourMode } from "@/store/useEditorStore";
import { FootprintImage } from "./FootprintImage";
import { useCatalogImage } from "./useCatalogImage";

interface ObjectShapeProps {
  object: PlanObject;
  itemType: ItemType;
  colourMode: ColourMode;
  selected: boolean;
  scale: number;
  showLabel: boolean;
  /** What to write on the shape: the object's own label, or its type name. */
  label: string;
  draggable: boolean;
  /** False for the place, array and measure tools, which own every click. */
  selectable: boolean;
  /** Items drawn on this building's own interior sheet. */
  interiorCount: number;
  /** Packing-list fill for a cabin. Null when the type has no stock list. */
  stock?: { ready: number; needed: number } | null;
  onSelect: (id: string, additive: boolean) => void;
  onOpenInterior: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragMove: (id: string, xMm: number, yMm: number) => void;
  onDragEnd: () => void;
  registerNode: (id: string, node: Konva.Group | null) => void;
}

/**
 * One placed item. The group is positioned by its centre so rotation behaves
 * the way people expect from CAD tools, while the model keeps top-left
 * coordinates.
 */
export const ObjectShape = memo(function ObjectShape({
  object,
  itemType,
  colourMode,
  selected,
  scale,
  showLabel,
  label,
  draggable,
  selectable,
  interiorCount,
  stock,
  onSelect,
  onOpenInterior,
  onDragStart,
  onDragMove,
  onDragEnd,
  registerNode,
}: ObjectShapeProps) {
  const style = objectStyle(object, itemType, colourMode, selected);
  const strokeWidth = (selected ? 2.5 : 1.4) / scale;
  const iconSize = Math.min(object.wMm, object.hMm) * 0.55;
  const iconScale = iconSize / 24;
  const labelSize = 13 / scale;
  const showText = showLabel && object.wMm * scale > 46;
  const picture = useCatalogImage(catalogImageUrl(itemType.image));

  return (
    <Group
      id={object.id}
      ref={(node) => registerNode(object.id, node)}
      x={object.xMm + object.wMm / 2}
      y={object.yMm + object.hMm / 2}
      offsetX={object.wMm / 2}
      offsetY={object.hMm / 2}
      rotation={object.rotationDeg}
      draggable={draggable && !object.locked}
      listening={selectable}
      onMouseDown={(event) => {
        event.cancelBubble = true;
        onSelect(object.id, event.evt.shiftKey || event.evt.metaKey);
      }}
      onDragStart={() => onDragStart(object.id)}
      onDragMove={(event) => {
        const node = event.target;
        onDragMove(
          object.id,
          node.x() - object.wMm / 2,
          node.y() - object.hMm / 2,
        );
      }}
      onDragEnd={onDragEnd}
      onDblClick={() => itemType.hasInterior && onOpenInterior(object.id)}
      onDblTap={() => itemType.hasInterior && onOpenInterior(object.id)}
    >
      {itemType.shape === "circle" ? (
        <Circle
          x={object.wMm / 2}
          y={object.hMm / 2}
          radius={Math.min(object.wMm, object.hMm) / 2}
          fill={picture ? `${style.stroke}18` : style.fill}
          stroke={style.stroke}
          strokeWidth={strokeWidth}
          dash={picture ? undefined : style.dash}
        />
      ) : (
        <Rect
          width={object.wMm}
          height={object.hMm}
          cornerRadius={Math.min(80, object.wMm * 0.04)}
          fill={picture ? `${style.stroke}18` : style.fill}
          stroke={style.stroke}
          strokeWidth={strokeWidth}
          dash={picture ? undefined : style.dash}
        />
      )}

      {picture ? (
        <FootprintImage
          itemType={itemType}
          wMm={object.wMm}
          hMm={object.hMm}
          opacity={style.iconOpacity}
        />
      ) : (
        <Group
          x={object.wMm / 2 - iconSize / 2}
          y={object.hMm / 2 - iconSize / 2}
          scaleX={iconScale}
          scaleY={iconScale}
          opacity={style.iconOpacity}
          listening={false}
        >
          {(ICON_PATHS[itemType.icon] ?? ICON_PATHS.box!)
            .split(" M")
            .map((segment, index) => (
              <Path
                key={index}
                data={index === 0 ? segment : `M${segment}`}
                stroke={style.stroke}
                strokeWidth={1.6 / iconScale / scale}
                lineCap="round"
                lineJoin="round"
              />
            ))}
        </Group>
      )}

      {showText && (
        <Text
          x={6 / scale}
          y={6 / scale}
          width={object.wMm - 12 / scale}
          text={label}
          fontSize={labelSize}
          fontStyle="500"
          fill={style.stroke}
          listening={false}
          ellipsis
          wrap="none"
        />
      )}

      {itemType.hasInterior && (
        <>
          <Rect
            x={object.wMm - 22 / scale}
            y={6 / scale}
            width={16 / scale}
            height={16 / scale}
            cornerRadius={3 / scale}
            fill={style.stroke}
            opacity={0.5}
            listening={false}
          />
          {/* How much is already drawn inside, so two identical buildings can
              be told apart at a glance. */}
          <Text
            x={object.wMm - 22 / scale}
            y={9.5 / scale}
            width={16 / scale}
            align="center"
            text={interiorCount > 0 ? String(interiorCount) : "+"}
            fontSize={10 / scale}
            fontStyle="700"
            fill={style.fill}
            listening={false}
          />
        </>
      )}

      {stock && (
        <>
          <Rect
            x={object.wMm - 28 / scale}
            y={object.hMm - 20 / scale}
            width={22 / scale}
            height={14 / scale}
            cornerRadius={3 / scale}
            fill={
              stock.needed > 0 && stock.ready >= stock.needed
                ? "#22c55e"
                : style.stroke
            }
            opacity={0.85}
            listening={false}
          />
          <Text
            x={object.wMm - 28 / scale}
            y={object.hMm - 18 / scale}
            width={22 / scale}
            align="center"
            text={
              stock.needed > 0 && stock.ready >= stock.needed
                ? "✓"
                : `${stock.ready}/${stock.needed}`
            }
            fontSize={9 / scale}
            fontStyle="700"
            fill="#ffffff"
            listening={false}
          />
        </>
      )}
    </Group>
  );
});
