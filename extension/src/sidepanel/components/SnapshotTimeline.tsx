import React from "react";
import { useSnapshots } from "../hooks/useSnapshots";
import type { Snapshot } from "../../shared/types";

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function SnapshotCard({
  snapshot,
  isCurrent,
  onRestore,
  onDelete,
}: {
  snapshot: Snapshot;
  isCurrent: boolean;
  onRestore: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`shrink-0 w-40 rounded-lg overflow-hidden border transition-colors duration-150 cursor-pointer hover:border-vibe-accent ${
        isCurrent ? "border-vibe-accent" : "border-vibe-border"
      }`}
      onClick={onRestore}
    >
      {/* Thumbnail */}
      <div className="h-24 bg-vibe-card flex items-center justify-center overflow-hidden">
        {snapshot.thumbnail ? (
          <img
            src={snapshot.thumbnail}
            alt={snapshot.description}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-vibe-muted text-xs">No preview</div>
        )}
      </div>
      {/* Info */}
      <div className="p-2 bg-vibe-card/50">
        <p className="text-xs text-vibe-text truncate">
          {snapshot.description || "Snapshot"}
        </p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-vibe-muted">
            {formatTime(snapshot.createdAt)}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-[10px] text-vibe-muted hover:text-vibe-error transition-colors"
            title="Delete snapshot"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export function SnapshotTimeline() {
  const { snapshots, saveSnapshot, restoreSnapshot, deleteSnapshot } =
    useSnapshots();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-vibe-border shrink-0">
        <span className="text-xs text-vibe-muted font-medium">
          {snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => saveSnapshot()}
          className="text-xs bg-vibe-accent hover:bg-vibe-accent-hover text-white rounded-md px-2.5 py-1 transition-colors duration-150"
        >
          Save Current
        </button>
      </div>

      {/* Timeline */}
      {snapshots.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <p className="text-vibe-muted text-sm mb-1">No snapshots yet</p>
            <p className="text-vibe-muted text-xs">
              Snapshots are saved automatically after each design change, or you
              can save one manually.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {snapshots.map((snap, i) => (
              <SnapshotCard
                key={snap.id}
                snapshot={snap}
                isCurrent={i === snapshots.length - 1}
                onRestore={() => restoreSnapshot(snap)}
                onDelete={() => deleteSnapshot(snap.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
