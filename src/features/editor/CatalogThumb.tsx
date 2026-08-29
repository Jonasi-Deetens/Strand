import { Icon } from "@/components/Icon";
import { type ItemType } from "@/domain/types";
import { catalogImageUrl } from "@/lib/catalogImage";

interface CatalogThumbProps {
  itemType: ItemType;
  size?: number;
}

/** Palette and catalog row share one thumbnail so a missing image still shows the icon. */
export function CatalogThumb({ itemType, size = 32 }: CatalogThumbProps) {
  const src = catalogImageUrl(itemType.image);
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-md"
      style={{
        width: size,
        height: size,
        backgroundColor: `${itemType.colour}1f`,
        color: itemType.colour,
      }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          draggable={false}
          className="h-full w-full object-contain"
        />
      ) : (
        <Icon name={itemType.icon} size={Math.round(size * 0.53)} />
      )}
    </span>
  );
}
