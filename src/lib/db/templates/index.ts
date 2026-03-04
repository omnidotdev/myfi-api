import type { InsertAccount } from "lib/db/schema";

export interface AccountTemplate {
  name: string;
  code: string;
  type: InsertAccount["type"];
  subType?: InsertAccount["subType"];
  isPlaceholder?: boolean;
  children?: AccountTemplate[];
}

export { default as llcTemplate } from "./llc.template";
export { default as personalTemplate } from "./personal.template";
export { default as soleProprietorTemplate } from "./soleProprietor.template";
