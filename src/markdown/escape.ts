/**
 * @file src/markdown/escape.ts
 * @desc escapeMarkdown: backslash-escapes text so markdown shows it as typed.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 11, 2026
 * @modified Sun Oct 11, 2026
 */

const INLINE = /[\\*_`[\]~]/g;

/**
 * @function escapeMarkdown
 * @param text {string} plain text from a BBCode text node
 * @param atLineStart {boolean} whether the text begins a line (then `#`, `>`, `-`, `+`, `1.` are escaped)
 * @returns {string} the text with every markdown marker escaped
 */
export const escapeMarkdown = (text: string, atLineStart: boolean): string => {
  const inline = text.replace(INLINE, "\\$&");
  if (!atLineStart) return inline;
  return inline.replace(/^(\s*)([#>+-])/, "$1\\$2").replace(/^(\s*\d+)\./, "$1\\.");
};
