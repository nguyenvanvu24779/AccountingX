// Converts a simple Markdown file (headings, paragraphs, lists, one table kind,
// **bold** and `code`) to .docx. Usage: node scripts/md-to-docx.cjs in.md out.docx
const fs = require('node:fs');
const {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} = require('docx');

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('Usage: node scripts/md-to-docx.cjs in.md out.docx');
  process.exit(1);
}

const FONT = 'Calibri';
const TEXT_WIDTH = 9360; // US Letter, 1" margins, in DXA

function runs(text, base = {}) {
  const out = [];
  const pattern = /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), font: FONT, ...base }));
    const token = m[0];
    const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      out.push(
        new ExternalHyperlink({
          link: link[2],
          children: [new TextRun({ text: link[1], font: FONT, color: '0563C1', underline: {}, ...base })],
        })
      );
    } else if (token.startsWith('**')) out.push(new TextRun({ text: token.slice(2, -2), bold: true, font: FONT, ...base }));
    else if (token.startsWith('`'))
      out.push(new TextRun({ text: token.slice(1, -1), font: 'Consolas', ...base, shading: { type: ShadingType.CLEAR, fill: 'F0F0F0' } }));
    else out.push(new TextRun({ text: token.slice(1, -1), italics: true, font: FONT, ...base }));
    last = m.index + token.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), font: FONT, ...base }));
  return out;
}

function splitRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

function buildTable(rows) {
  const [header, , ...body] = rows.map(splitRow);
  const cols = header.length;
  const first = Math.round(TEXT_WIDTH * 0.45);
  const widths = cols === 2 ? [first, TEXT_WIDTH - first] : Array(cols).fill(Math.floor(TEXT_WIDTH / cols));
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' };
  const borders = { top: border, bottom: border, left: border, right: border };
  const cell = (text, i, head) =>
    new TableCell({
      borders,
      width: { size: widths[i], type: WidthType.DXA },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      shading: head ? { type: ShadingType.CLEAR, fill: 'E8EEF7' } : undefined,
      children: [new Paragraph({ children: runs(text, head ? { bold: true } : {}) })],
    });
  return new Table({
    width: { size: TEXT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: header.map((c, i) => cell(c, i, true)) }),
      ...body.map((r) => new TableRow({ children: r.map((c, i) => cell(c, i, false)) })),
    ],
  });
}

const lines = fs.readFileSync(input, 'utf8').split(/\r?\n/);
const children = [];
let numberedRef = 0;
let i = 0;
while (i < lines.length) {
  const line = lines[i];
  if (!line.trim()) {
    i += 1;
    continue;
  }
  if (line.startsWith('|')) {
    const rows = [];
    while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
    children.push(buildTable(rows), new Paragraph({ children: [] }));
    continue;
  }
  const h = line.match(/^(#{1,3})\s+(.*)$/);
  if (h) {
    const level = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][h[1].length - 1];
    children.push(new Paragraph({ heading: level, spacing: { before: h[1].length === 1 ? 0 : 280, after: 120 }, children: runs(h[2]) }));
    i += 1;
    continue;
  }
  const bullet = line.match(/^-\s+(.*)$/);
  if (bullet) {
    children.push(new Paragraph({ numbering: { reference: 'bullets', level: 0 }, spacing: { after: 60 }, children: runs(bullet[1]) }));
    i += 1;
    continue;
  }
  const numbered = line.match(/^(\d+)\.\s+(.*)$/);
  if (numbered) {
    if (numbered[1] === '1') numberedRef += 1;
    children.push(new Paragraph({ numbering: { reference: `numbers${numberedRef}`, level: 0 }, spacing: { after: 60 }, children: runs(numbered[2]) }));
    i += 1;
    continue;
  }
  children.push(new Paragraph({ spacing: { after: 120 }, children: runs(line) }));
  i += 1;
}

const numberConfigs = Array.from({ length: numberedRef }, (_, n) => ({
  reference: `numbers${n + 1}`,
  levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
}));

const doc = new Document({
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 36, bold: true, font: FONT, color: '1F3864' }, paragraph: { outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 28, bold: true, font: FONT, color: '1F3864' }, paragraph: { outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 24, bold: true, font: FONT }, paragraph: { outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      ...numberConfigs,
    ],
  },
  sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children }],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(output, buffer);
  console.log(`wrote ${output} (${buffer.length} bytes)`);
});
