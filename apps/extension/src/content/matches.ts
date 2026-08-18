/** Production page matches are only the two AI hosts. The synthetic fixture host is build-flagged. */
export function contentScriptMatches(
  enableSynthetic = process.env.PLASMO_PUBLIC_ENABLE_SYNTHETIC === 'true',
): string[] {
  const matches = ['https://chat.deepseek.com/*', 'https://chatgpt.com/*']
  if (enableSynthetic) matches.push('*://synthetic.chatstash.test/*')
  return matches
}
