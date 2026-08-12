export const MAX_TERM_LENGTH = 60;
export const MAX_DEFINITION_LENGTH = 280;

function parseDelimitedLine(line, delimiter) {
  if (delimiter === "\t") {
    return line.split("\t");
  }

  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function looksLikeHeader(cells) {
  const term = String(cells[0] || "").trim();
  const definition = String(cells[1] || "").trim();
  return /^(term|word|name)$/i.test(term) && /def/i.test(definition);
}

export function parseTermList(text, { maxTerms = 50 } = {}) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  let rows = lines.map((line) => parseDelimitedLine(line, delimiter));
  if (looksLikeHeader(rows[0])) {
    rows = rows.slice(1);
  }

  const terms = [];
  for (const cells of rows) {
    const term = String(cells[0] || "").trim();
    const definition = cells
      .slice(1)
      .join(delimiter)
      .trim();
    if (!term || !definition) continue;
    terms.push({
      term: term.slice(0, MAX_TERM_LENGTH),
      definition: definition.slice(0, MAX_DEFINITION_LENGTH),
    });
    if (terms.length >= maxTerms) break;
  }
  return terms;
}
