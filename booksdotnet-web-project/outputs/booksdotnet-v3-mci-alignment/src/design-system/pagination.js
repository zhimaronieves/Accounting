export function paginationItems(current, count) {
  const total = Math.max(0, Math.floor(count));
  if (!total) return [];
  const page = Math.max(1, Math.min(total, Math.floor(current)));
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const selected = new Set([1, total, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4, 5].forEach(n => selected.add(n));
  if (page >= total - 2) [total - 4, total - 3, total - 2, total - 1].forEach(n => selected.add(n));
  const pages = [...selected].filter(n => n >= 1 && n <= total).sort((a, b) => a - b), items = [];
  pages.forEach((n, i) => {
    if (i && n - pages[i - 1] === 2) items.push(n - 1);
    else if (i && n - pages[i - 1] > 2) items.push('…');
    items.push(n);
  });
  return items;
}
