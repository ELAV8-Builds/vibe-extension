/// Snapshot capture — records current CSS and DOM change state.

import type { ChangeInstruction } from "../shared/types";
import {
  getAppliedChanges,
  getCssState,
  undoAll,
  setCssState,
  applyChanges,
} from "./change-applicator";

export interface SnapshotState {
  cssState: string;
  domChanges: ChangeInstruction[];
}

export function captureSnapshotState(): SnapshotState {
  const applied = getAppliedChanges();
  const cssState = getCssState();
  const domChanges = applied
    .filter((c) => c.instruction.type === "dom")
    .map((c) => c.instruction);

  return { cssState, domChanges };
}

export function restoreSnapshotState(
  cssState: string,
  domChanges: ChangeInstruction[]
): void {
  // First, undo everything
  undoAll();

  // Restore CSS state directly
  setCssState(cssState);

  // Re-apply DOM changes
  if (domChanges.length > 0) {
    applyChanges(domChanges);
  }
}
