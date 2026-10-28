import {
  compareNames,
  orderCategories,
  type Catalog,
  type CatalogCategory,
  type CatalogProduct,
} from "@szop/shared";

// One category of the tree with what the page shows under it. productCount
// is over the whole subtree, what the count pill says.
export interface CatalogNode {
  category: CatalogCategory;
  depth: number;
  products: CatalogProduct[];
  children: CatalogNode[];
  productCount: number;
}

// The tree the page shows: categories in the store's order (orderCategories),
// each with its own products sorted by name. A product with no category is
// not in the tree.
export function buildCatalogTree(catalog: Catalog): CatalogNode[] {
  const productsOf = new Map<string, CatalogProduct[]>();
  for (const product of catalog.products) {
    // Stryker disable next-line ConditionalExpression: a product stored under the key null is never looked up: no category has a null ID
    if (product.categoryId === null) continue;
    const group = productsOf.get(product.categoryId);
    if (group) group.push(product);
    else productsOf.set(product.categoryId, [product]);
  }

  // orderCategories is depth-first, so a category's parent is the last
  // category seen one level up.
  const roots: CatalogNode[] = [];
  // Stryker disable next-line ArrayDeclaration: each entry is set before it is read: a parent is always seen first
  const parents: CatalogNode[] = [];
  const all: { node: CatalogNode; parent: CatalogNode | undefined }[] = [];
  for (const { depth, ...category } of orderCategories(catalog.categories)) {
    const node: CatalogNode = {
      category,
      depth,
      products: (productsOf.get(category.id) ?? []).toSorted((a, b) =>
        compareNames(a.name, b.name),
      ),
      children: [],
      productCount: 0,
    };
    // Stryker disable next-line ConditionalExpression: `parents[-1]` is undefined, the same as the root's parent
    const parent = depth === 0 ? undefined : parents[depth - 1];
    if (parent) parent.children.push(node);
    else roots.push(node);
    parents[depth] = node;
    all.push({ node, parent });
  }

  // Children come after their parent in `all`, so going backwards finishes
  // each subtree before it is added to its parent.
  for (const { node, parent } of all.toReversed()) {
    node.productCount += node.products.length;
    if (parent) parent.productCount += node.productCount;
  }
  return roots;
}

// Every category ID in the nodes, at every level: "Expand all".
export function allCategoryIds(nodes: readonly CatalogNode[]): Set<string> {
  const ids = new Set<string>();
  const visit = (list: readonly CatalogNode[]) => {
    for (const node of list) {
      ids.add(node.category.id);
      visit(node.children);
    }
  };
  visit(nodes);
  return ids;
}

export function pluralize(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}
