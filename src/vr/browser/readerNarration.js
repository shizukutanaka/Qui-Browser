/**
 * Reader narration chunking — the pure part of "Read Aloud" (Edge) / "Listen
 * to Page" (Safari): turn the extracted reader document into a list of
 * utterance-sized strings for SpeechSynthesis.
 *
 * One utterance per call would hand the TTS engine an entire article at once;
 * per-word calls would flood the queue. Paragraphs are the natural unit, with
 * over-long paragraphs re-split at sentence boundaries and, as a last resort,
 * hard-split — code-point-aware so a surrogate pair is never severed.
 */

export const NARRATION_CHUNK_MAX = 200;

const SENTENCE_END = /([。！？!?…]+|[.!?]+\s+|[\r\n]+)/;

function splitSentences(paragraph) {
  const out = [];
  for (const part of paragraph.split(SENTENCE_END)) {
    if (!part) {
      continue;
    }
    // split() keeps the delimiters as their own elements — fold each back onto
    // the sentence it ended so punctuation stays attached to its text.
    if (SENTENCE_END.test(part) && out.length) {
      out[out.length - 1] += part;
    } else if (part.trim() && !SENTENCE_END.test(part)) {
      out.push(part);
    }
  }
  return out;
}

function hardSplit(sentence, maxLen) {
  const cps = [...sentence];
  const pieces = [];
  for (let i = 0; i < cps.length; i += maxLen) {
    const piece = cps.slice(i, i + maxLen).join('').trim();
    if (piece) {
      pieces.push(piece);
    }
  }
  return pieces;
}

/**
 * Build the utterance list for narration.
 *
 * @param {string} [title] article title, spoken first
 * @param {Array<{type?: string, text?: string}>} [blocks] reader blocks
 * @param {number} [maxLen] per-utterance code-point ceiling
 * @returns {string[]} non-empty strings in speaking order
 */
export function narrationChunks(title, blocks, maxLen = NARRATION_CHUNK_MAX) {
  const cap = Number.isFinite(maxLen) && maxLen > 0 ? Math.floor(maxLen) : NARRATION_CHUNK_MAX;
  const paragraphs = [];
  if (typeof title === 'string' && title.trim()) {
    paragraphs.push(title.trim());
  }
  for (const b of Array.isArray(blocks) ? blocks : []) {
    if (b && typeof b.text === 'string' && b.text.trim()) {
      paragraphs.push(b.text.trim());
    }
  }

  const chunks = [];
  let current = '';
  const flush = () => {
    if (current.trim()) {
      chunks.push(current.trim());
    }
    current = '';
  };
  for (const paragraph of paragraphs) {
    for (const sentence of splitSentences(paragraph)) {
      if ([...sentence].length > cap) {
        flush();
        chunks.push(...hardSplit(sentence, cap));
      } else if ([...current].length + [...sentence].length + 1 > cap) {
        flush();
        current = sentence;
      } else {
        current = current ? `${current} ${sentence}` : sentence;
      }
    }
    // Paragraph boundaries always break the chunk — TTS engines pause
    // naturally there and the pack would otherwise blend unrelated blocks.
    flush();
  }
  flush();
  return chunks;
}
