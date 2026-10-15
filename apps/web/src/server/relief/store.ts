import { seedRelief, type ReliefState } from "@floodsetu/relief";
import { ENV } from "../env";
import { fileStore } from "../persist";

/** Relief store — physically separate file (.data/relief.json). Never imported by rescue-side code. */
export const reliefDb = fileStore<ReliefState>("relief", () => seedRelief(ENV.pepper));
