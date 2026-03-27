import type { DOMSnapshot, DOMNode } from "../types/api";

const MAX_SNAPSHOT_BYTES = 80 * 1024; // 80KB — Opus 4 has 200K context

/**
 * Simplify a DOM snapshot to fit within the token budget.
 * Progressively reduces detail until the serialized size is under the limit.
 */
export function simplifySnapshot(snapshot: DOMSnapshot): DOMSnapshot {
  let serialized = JSON.stringify(snapshot);

  // If already under budget, return as-is
  if (serialized.length <= MAX_SNAPSHOT_BYTES) {
    return snapshot;
  }

  // Clone to avoid mutating the original
  let simplified: DOMSnapshot = JSON.parse(serialized);

  // Pass 1: Truncate text content more aggressively
  truncateTextContent(simplified.tree, 30);
  serialized = JSON.stringify(simplified);
  if (serialized.length <= MAX_SNAPSHOT_BYTES) {
    return simplified;
  }

  // Pass 2: Remove bounds from deeply nested elements (depth > 4)
  removeBoundsAtDepth(simplified.tree, 0, 4);
  serialized = JSON.stringify(simplified);
  if (serialized.length <= MAX_SNAPSHOT_BYTES) {
    return simplified;
  }

  // Pass 3: Collapse children beyond 3 per parent
  collapseExcessChildren(simplified.tree, 3);
  serialized = JSON.stringify(simplified);
  if (serialized.length <= MAX_SNAPSHOT_BYTES) {
    return simplified;
  }

  // Pass 4: Remove styles from deeply nested elements (depth > 3)
  removeStylesAtDepth(simplified.tree, 0, 3);
  serialized = JSON.stringify(simplified);
  if (serialized.length <= MAX_SNAPSHOT_BYTES) {
    return simplified;
  }

  // Pass 5: Limit tree depth to 5
  limitTreeDepth(simplified.tree, 0, 5);
  serialized = JSON.stringify(simplified);
  if (serialized.length <= MAX_SNAPSHOT_BYTES) {
    return simplified;
  }

  // Pass 6: Trim design tokens
  simplified.designTokens.colors = simplified.designTokens.colors.slice(0, 8);
  simplified.designTokens.fonts = simplified.designTokens.fonts.slice(0, 4);
  simplified.designTokens.spacing = simplified.designTokens.spacing.slice(0, 6);
  simplified.designTokens.radii = simplified.designTokens.radii.slice(0, 4);

  // Pass 7: Aggressively collapse to 2 children max
  collapseExcessChildren(simplified.tree, 2);
  limitTreeDepth(simplified.tree, 0, 4);

  return simplified;
}

function truncateTextContent(node: DOMNode, maxLen: number): void {
  if (node.text && node.text.length > maxLen) {
    node.text = node.text.slice(0, maxLen) + "...";
  }
  if (node.children) {
    for (const child of node.children) {
      truncateTextContent(child, maxLen);
    }
  }
}

function removeBoundsAtDepth(
  node: DOMNode,
  currentDepth: number,
  maxDepth: number
): void {
  if (currentDepth >= maxDepth) {
    delete node.bounds;
  }
  if (node.children) {
    for (const child of node.children) {
      removeBoundsAtDepth(child, currentDepth + 1, maxDepth);
    }
  }
}

function removeStylesAtDepth(
  node: DOMNode,
  currentDepth: number,
  maxDepth: number
): void {
  if (currentDepth >= maxDepth) {
    delete node.styles;
  }
  if (node.children) {
    for (const child of node.children) {
      removeStylesAtDepth(child, currentDepth + 1, maxDepth);
    }
  }
}

function collapseExcessChildren(node: DOMNode, maxChildren: number): void {
  if (node.children && node.children.length > maxChildren) {
    const keepCount = Math.max(maxChildren - 1, 1);
    const excess = node.children.length - keepCount;
    const kept = node.children.slice(0, keepCount);
    const sampleTag = node.children[keepCount]?.tag || "element";
    // Add a collapsed note as the final child, staying within maxChildren total
    kept.push({
      tag: "collapsed",
      text: `... ${excess} more <${sampleTag}> siblings`,
    });
    node.children = kept;
  }
  if (node.children) {
    for (const child of node.children) {
      collapseExcessChildren(child, maxChildren);
    }
  }
}

function limitTreeDepth(
  node: DOMNode,
  currentDepth: number,
  maxDepth: number
): void {
  if (currentDepth >= maxDepth) {
    if (node.children && node.children.length > 0) {
      const childCount = countDescendants(node);
      node.children = undefined;
      node.collapsed = `... ${childCount} nested elements`;
    }
    return;
  }
  if (node.children) {
    for (const child of node.children) {
      limitTreeDepth(child, currentDepth + 1, maxDepth);
    }
  }
}

function countDescendants(node: DOMNode): number {
  if (!node.children) return 0;
  let count = node.children.length;
  for (const child of node.children) {
    count += countDescendants(child);
  }
  return count;
}
