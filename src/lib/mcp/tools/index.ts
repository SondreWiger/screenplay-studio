import type { ToolDef } from '../tool';
import { adminTools } from './admin';
import { planningTools } from './planning';
import { projectTools } from './projects';
import { recordTools } from './records';
import { scriptTools } from './scripts';
import { teamTools } from './team';

/** Every tool, in the order clients list them. */
export const TOOLS: ToolDef[] = [
  ...projectTools,
  ...scriptTools,
  ...planningTools,
  ...recordTools,
  ...teamTools,
  ...adminTools,
] as ToolDef[];

export const TOOLS_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));
