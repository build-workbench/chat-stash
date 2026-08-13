export const LIMITS = {
  title: { min: 1, max: 240 },
  sourceUrl: { min: 1, max: 2048 },
  sourceId: { min: 1, max: 512 },
  messageMarkdown: { min: 1, max: 500_000 },
  captureJsonBytes: 1_100_000,
  folderTagName: { min: 1, max: 80 },
  searchQuery: { min: 2, max: 200 },
  pageSize: { default: 30, max: 100 },
} as const
