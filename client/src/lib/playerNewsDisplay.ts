export function getVisiblePlayerNews<T>(news: T[], showAll: boolean): T[] {
  return showAll ? news : news.slice(0, 3);
}
