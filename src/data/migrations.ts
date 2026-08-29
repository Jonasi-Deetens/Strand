import init from "../../migrations/001_init.sql?raw";
import catalog from "../../migrations/002_catalog.sql?raw";
import toiletTarget from "../../migrations/003_toilet_target.sql?raw";
import catalogImages from "../../migrations/004_catalog_images.sql?raw";
import cabinStock from "../../migrations/006_cabin_stock.sql?raw";

export interface MigrationScript {
  version: number;
  name: string;
  sql: string;
}

/** Same list, same order as the Rust migration registration. */
export const MIGRATIONS: MigrationScript[] = [
  { version: 1, name: "init", sql: init },
  { version: 2, name: "catalog", sql: catalog },
  { version: 3, name: "toilet_target", sql: toiletTarget },
  { version: 4, name: "catalog_images", sql: catalogImages },
  // Version 5 is the open catalogue-images PR. This list stays at 6 so both
  // branches can merge without fighting over the same sqlx version.
  { version: 6, name: "cabin_stock", sql: cabinStock },
];
