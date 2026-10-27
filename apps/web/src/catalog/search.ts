import type { CatalogProduct } from "@szop/shared";
import type { CatalogNode } from "./tree.ts";

// Case- and accent-insensitive: Unicode NFD, the combining marks removed.
export function foldForSearch(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

// Where the query is in the name, as indices into the name itself, or null.
// The name is folded one code point at a time, remembering which part of the
// original each folded character came from, because folding can change the
// length (a precomposed "è" is two code points in NFD).
export function findMatch(
  name: string,
  query: string,
): [start: number, end: number] | null {
  const needle = foldForSearch(query.trim());
  if (needle === "") return null;

  let folded = "";
  const starts: number[] = [];
  const ends: number[] = [];
  let index = 0;
  for (const char of name) {
    const piece = foldForSearch(char);
    for (let i = 0; i < piece.length; i++) {
      starts.push(index);
      ends.push(index + char.length);
    }
    folded += piece;
    index += char.length;
  }

  const at = folded.indexOf(needle);
  if (at === -1) return null;
  const start = starts[at];
  const end = ends[at + needle.length - 1];
  return start === undefined || end === undefined ? null : [start, end];
}

// A category of the tree as the search keeps it. products and children hold
// only what matches; node is the whole category, for when it matches itself
// and the user opens it by hand.
export interface SearchNode {
  node: CatalogNode;
  matched: boolean;
  products: CatalogProduct[];
  children: SearchNode[];
  shownCount: number;
}

export interface SearchResult {
  nodes: SearchNode[];
  // The categories to open: every one with a match inside.
  open: Set<string>;
  // The matching products, what the line above the tree says.
  productCount: number;
}

// Filters the tree by the query; null when the query is blank.
export function searchTree(
  tree: CatalogNode[],
  query: string,
): SearchResult | null {
  const text = query.trim();
  if (text === "") return null;

  const open = new Set<string>();
  const visit = (nodes: readonly CatalogNode[]): SearchNode[] => {
    const kept: SearchNode[] = [];
    for (const node of nodes) {
      const matched = findMatch(node.category.name, text) !== null;
      const products = node.products.filter(
        (product) => findMatch(product.name, text) !== null,
      );
      const children = visit(node.children);
      if (!matched && products.length === 0 && children.length === 0) continue;

      const inside =
        products.length +
        children.reduce((sum, child) => sum + child.shownCount, 0);
      if (products.length > 0 || children.length > 0) {
        open.add(node.category.id);
      }
      kept.push({
        node,
        matched,
        products,
        children,
        shownCount: matched && inside === 0 ? node.productCount : inside,
      });
    }
    return kept;
  };

  const nodes = visit(tree);
  return {
    nodes,
    open,
    productCount: nodes.reduce((sum, node) => sum + node.shownCount, 0),
  };
}
