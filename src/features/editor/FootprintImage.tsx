import { Group, Image } from "react-konva";
import { type ItemType } from "@/domain/types";
import { catalogImageUrl } from "@/lib/catalogImage";
import { useCatalogImage } from "./useCatalogImage";

interface FootprintImageProps {
  itemType: ItemType;
  wMm: number;
  hMm: number;
  opacity?: number;
}

/**
 * Top-down catalog picture stretched to the object's millimetre box. Circles
 * clip to the inscribed disc so a palm canopy stays round on the plan.
 */
export function FootprintImage({
  itemType,
  wMm,
  hMm,
  opacity = 1,
}: FootprintImageProps) {
  const image = useCatalogImage(catalogImageUrl(itemType.image));
  if (!image) return null;

  const picture = (
    <Image
      image={image}
      width={wMm}
      height={hMm}
      opacity={opacity}
      listening={false}
    />
  );

  if (itemType.shape !== "circle") return picture;

  const radius = Math.min(wMm, hMm) / 2;
  return (
    <Group
      clipFunc={(ctx) => {
        ctx.arc(wMm / 2, hMm / 2, radius, 0, Math.PI * 2, false);
      }}
      listening={false}
    >
      {picture}
    </Group>
  );
}
