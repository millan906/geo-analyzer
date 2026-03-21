import type { Signal } from './parse-geo';
import {
  parseStrategyQuickWins,
  parseStrategy30DayPlan,
  parseStrategySchemaChecklist,
  parseStrategyContentGaps,
  parseStrategyProjection,
} from './parse-strategy';

export interface PdfData {
  url: string;
  provider: string;
  model: string;
  geoScore: number | null;
  seoScore: number | null;
  geoSignals: Signal[];
  auditOutput: string;
  strategyOutput?: string;
  mode?: 'audit' | 'strategy';
}

// ── Colors ────────────────────────────────────────────────────────────────────
const PURPLE = '#5B35D5';
const GRAY_900 = '#111827';
const GRAY_700 = '#374151';
const GRAY_600 = '#4B5563';
const GRAY_400 = '#9CA3AF';
const GRAY_100 = '#F3F4F6';
const GREEN = '#16a34a';
const AMBER = '#d97706';
const RED = '#dc2626';

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function signalColor(emoji: 'pass' | 'warn' | 'fail'): string {
  if (emoji === 'pass') return GREEN;
  if (emoji === 'warn') return AMBER;
  return RED;
}

function scoreColor(score: number | null): string {
  if (score === null) return GRAY_400;
  if (score >= 80) return GREEN;
  if (score >= 65) return AMBER;
  return RED;
}

// ── Text helpers ──────────────────────────────────────────────────────────────

/** Strip markdown bold markers and backtick code fences from a string */
function clean(s: string): string {
  return s.replace(/\*\*/g, '').replace(/`/g, '').trim();
}

/** Extract numbered quick-fix lines (1. Fix — ~time) from a text block */
function extractNumberedLines(block: string): string[] {
  return block
    .split('\n')
    .filter((l) => /^\d+\./.test(l.trim()))
    .map((l) => clean(l.replace(/^\d+\.\s*/, '')))
    .filter(Boolean);
}

/** Split audit output into ▸ Signal blocks, skip the header description line */
function extractImprovementBlocks(block: string): Array<{ name: string; lines: string[] }> {
  // Split on ▸ markers, skip any element that is just the instructions header
  const parts = block.split(/\n?▸\s+/).filter((s) => s.trim() && !/^For each/i.test(s.trim()));
  return parts.map((part) => {
    const lines = part.split('\n').filter(Boolean);
    return { name: clean(lines[0] ?? ''), lines: lines.slice(1).map(clean).filter(Boolean) };
  });
}

export async function generateAuditPdf(data: PdfData): Promise<void> {
  const { default: jsPDF } = await import('jspdf');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const PW = 210;
  const PH = 297;
  const ML = 18;
  const MR = 18;
  const CW = PW - ML - MR;

  let y = 0;

  // ── Color setters ───────────────────────────────────────────────────────────
  const setColor = (hex: string) => {
    const [r, g, b] = hexToRgb(hex);
    doc.setTextColor(r, g, b);
  };
  const setFill = (hex: string) => {
    const [r, g, b] = hexToRgb(hex);
    doc.setFillColor(r, g, b);
  };
  const setDraw = (hex: string) => {
    const [r, g, b] = hexToRgb(hex);
    doc.setDrawColor(r, g, b);
  };

  // ── Layout helpers ──────────────────────────────────────────────────────────
  function newPageIfNeeded(needed = 20) {
    if (y + needed > PH - 16) {
      doc.addPage();
      drawPageHeader();
      y = 28;
    }
  }

  function hRule(color = GRAY_100, gap = 5) {
    setDraw(color);
    doc.setLineWidth(0.25);
    doc.line(ML, y, ML + CW, y);
    y += gap;
  }

  function sectionLabel(text: string) {
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    setColor(GRAY_400);
    doc.text(text.toUpperCase(), ML, y);
    y += 4;
  }

  /** Colored filled square as signal indicator (replaces emoji which won't render) */
  function signalSquare(hex: string, x: number, cy: number) {
    setFill(hex);
    doc.rect(x, cy - 2, 2.5, 2.5, 'F');
  }

  function scoreBox(
    x: number,
    bY: number,
    w: number,
    h: number,
    score: number | null,
    lbl: string
  ) {
    setDraw(GRAY_100);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, bY, w, h, 2, 2, 'S');
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    setColor(GRAY_400);
    doc.text(lbl.toUpperCase(), x + 4, bY + 7);
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    setColor(scoreColor(score));
    doc.text(score !== null ? String(score) : '—', x + 4, bY + 21);
    doc.setFontSize(9);
    setColor(GRAY_400);
    const numW = score !== null && score >= 100 ? 18 : score !== null && score >= 10 ? 14 : 10;
    doc.text('/ 100', x + 4 + numW, bY + 21);
  }

  // ── Sticky page sub-header (runs, provider) — shown from page 2 onward ──────
  function drawPageHeader() {
    setFill('#F9FAFB');
    doc.rect(0, 0, PW, 14, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    setColor(PURPLE);
    doc.text('GEO ANALYZER', ML, 9);
    doc.setFont('helvetica', 'normal');
    setColor(GRAY_400);
    const domainStr = data.url
      ? (() => {
          try {
            return new URL(
              data.url.startsWith('http') ? data.url : `https://${data.url}`
            ).hostname.replace('www.', '');
          } catch {
            return data.url;
          }
        })()
      : '';
    doc.text(`${domainStr}   ·   ${data.provider} / ${data.model}`, ML + 22, 9);
  }

  // ── Route by mode ───────────────────────────────────────────────────────────
  if (data.mode === 'strategy') {
    buildStrategyPdf();
  } else {
    buildAuditPdf();
  }

  // ── Footer on every page ──────────────────────────────────────────────────────
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    setDraw(GRAY_100);
    doc.setLineWidth(0.25);
    doc.line(ML, PH - 12, ML + CW, PH - 12);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    setColor(GRAY_400);
    doc.text('GEO Analyzer — geoanalyzer.app', ML, PH - 8);
    doc.text(`Page ${i} of ${total}`, PW - MR, PH - 8, { align: 'right' });
  }

  // ── Save ──────────────────────────────────────────────────────────────────────
  const slug = (() => {
    try {
      return new URL(
        data.url.startsWith('http') ? data.url : `https://${data.url}`
      ).hostname.replace('www.', '');
    } catch {
      return 'report';
    }
  })();
  const label = data.mode === 'strategy' ? 'strategy' : 'audit';
  doc.save(`geo-${label}-${slug}-${new Date().toISOString().split('T')[0]}.pdf`);
  return;

  // ─────────────────────────────────────────────────────────────────────────────
  // ── AUDIT PDF ────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────
  function buildAuditPdf() {
    // Purple header bar
    setFill(PURPLE);
    doc.rect(0, 0, PW, 20, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('GEO ANALYZER', ML, 9);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('The Yoast SEO of the AI Era', ML, 15);
    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    doc.text(dateStr, PW - MR, 9, { align: 'right' });

    y = 28;

    // Report title
    sectionLabel('Marketing Audit Report');
    const domain = (() => {
      try {
        return new URL(
          data.url.startsWith('http') ? data.url : `https://${data.url}`
        ).hostname.replace('www.', '');
      } catch {
        return data.url || 'Report';
      }
    })();
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    setColor(GRAY_900);
    doc.text(domain, ML, y);
    y += 8;

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    setColor(GRAY_400);
    doc.text(`${data.url}`, ML, y);
    y += 4;
    doc.text(
      `${data.provider.charAt(0).toUpperCase() + data.provider.slice(1)}  ·  ${data.model}`,
      ML,
      y
    );
    y += 7;

    hRule(GRAY_100, 6);

    // Score boxes
    const boxH = 30;
    const boxW = CW / 2 - 3;
    scoreBox(ML, y, boxW, boxH, data.geoScore, 'GEO Score');
    scoreBox(ML + boxW + 6, y, boxW, boxH, data.seoScore, 'SEO Score');
    y += boxH + 8;

    // ── GEO Signals table ───────────────────────────────────────────────────────
    if (data.geoSignals.length > 0) {
      hRule(GRAY_100, 4);
      sectionLabel('GEO Signal Breakdown');

      // Column widths: Signal | Score | Max | Finding
      const cols = [50, 18, 14, CW - 50 - 18 - 14];
      const headers = ['Signal', 'Score', 'Max', 'Finding'];

      // Header row
      setFill('#F3F4F6');
      doc.rect(ML, y - 3, CW, 7, 'F');
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      setColor(GRAY_600);
      let cx = ML + 2;
      headers.forEach((h, i) => {
        doc.text(h, cx, y + 1);
        cx += cols[i];
      });
      y += 7;

      data.geoSignals.forEach((sig, idx) => {
        // Estimate row height based on finding text wrapping
        const findingLines = doc.setFontSize(7.5) || doc.splitTextToSize(sig.finding, cols[3] - 4);
        const wrappedFinding = (doc as any).splitTextToSize(sig.finding, cols[3] - 4);
        const rowH = Math.max(8, wrappedFinding.length * 4 + 4);

        newPageIfNeeded(rowH + 2);

        if (idx % 2 === 0) {
          setFill('#FAFAFA');
          doc.rect(ML, y - 3, CW, rowH, 'F');
        }

        cx = ML + 2;

        // Signal name
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        setColor(GRAY_900);
        doc.text(sig.name, cx + 5, y + 1);

        // Colored square indicator
        signalSquare(signalColor(sig.emoji), cx, y + 1);
        cx += cols[0];

        // Score
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        setColor(signalColor(sig.emoji));
        doc.text(String(sig.score), cx, y + 1);
        cx += cols[1];

        // Max
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        setColor(GRAY_400);
        doc.text(String(sig.maxScore), cx, y + 1);
        cx += cols[2];

        // Finding — wrapped, max 2 lines
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        setColor(GRAY_700);
        const maxFindingLines = wrappedFinding.slice(0, 2);
        doc.text(maxFindingLines, cx, y + 1);

        y += rowH;
      });
      y += 4;
    }

    // ── SEO Quick Fixes ─────────────────────────────────────────────────────────
    // Extract from between "SEO QUICK FIXES" and next divider
    const seoQfMatch = data.auditOutput.match(/SEO QUICK FIXES\n([\s\S]*?)(?:━|$)/);
    const seoFixes = seoQfMatch ? extractNumberedLines(seoQfMatch[1]) : [];

    if (seoFixes.length > 0) {
      newPageIfNeeded(seoFixes.length * 9 + 16);
      hRule(GRAY_100, 4);
      sectionLabel('SEO Quick Fixes');
      seoFixes.slice(0, 5).forEach((fix, i) => {
        newPageIfNeeded(10);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        setColor(PURPLE);
        doc.text(`${i + 1}.`, ML, y + 1);
        doc.setFont('helvetica', 'normal');
        setColor(GRAY_700);
        const wrapped = (doc as any).splitTextToSize(
          clean(fix.replace(/—\s*~[\w\s]+$/, '')),
          CW - 8
        );
        doc.text(wrapped, ML + 6, y + 1);
        y += wrapped.length * 4.5 + 3;
      });
      y += 2;
    }

    // ── GEO Improvements ────────────────────────────────────────────────────────
    const geoImprovMatch = data.auditOutput.match(/GEO IMPROVEMENTS\n([\s\S]*?)(?:━|REWRITE|$)/);
    const improvBlocks = geoImprovMatch ? extractImprovementBlocks(geoImprovMatch[1]) : [];

    if (improvBlocks.length > 0) {
      newPageIfNeeded(40);
      hRule(GRAY_100, 4);
      sectionLabel('GEO Improvements');

      improvBlocks.slice(0, 4).forEach((block) => {
        if (!block.name) return;
        newPageIfNeeded(24);

        // Signal name header
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        setColor(GRAY_900);
        doc.text(block.name, ML, y);
        y += 5;

        block.lines.slice(0, 6).forEach((line) => {
          newPageIfNeeded(9);
          const isLabel = /^(Problem|Fix|Example):/i.test(line);
          doc.setFontSize(7.5);
          doc.setFont('helvetica', isLabel ? 'bold' : 'normal');
          setColor(isLabel ? GRAY_900 : GRAY_600);
          const wrapped = (doc as any).splitTextToSize(line, CW - 4);
          doc.text(wrapped, ML + 2, y);
          y += wrapped.length * 4.2 + 1;
        });
        y += 4;
      });
    }

    // ── AI Answer Preview ────────────────────────────────────────────────────────
    const aiMatch = data.auditOutput.match(/AI ANSWER PREVIEW\n([\s\S]*?)(?:━|PRIORITY|$)/);
    if (aiMatch) {
      const aiBlock = aiMatch[1];
      const quotedMatch = aiBlock.match(/["""](.+?)["""]/s);
      const missingMatch = aiBlock.match(/What['']s missing[:\s]+(.+?)(?:\n|$)/is);

      if (quotedMatch || missingMatch) {
        newPageIfNeeded(35);
        hRule(GRAY_100, 4);
        sectionLabel('AI Answer Preview');

        if (quotedMatch) {
          const previewText = `"${clean(quotedMatch[1])}"`;
          const pLines = (doc as any).splitTextToSize(previewText, CW - 8);
          const boxH = pLines.length * 4.5 + 10;
          setFill('#F5F3FF');
          doc.roundedRect(ML, y - 2, CW, boxH, 2, 2, 'F');
          doc.setFontSize(8);
          doc.setFont('helvetica', 'italic');
          setColor(PURPLE);
          doc.text(pLines, ML + 4, y + 4);
          y += boxH + 4;
        }

        if (missingMatch) {
          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'bold');
          setColor(GRAY_700);
          doc.text("What's missing:", ML, y);
          doc.setFont('helvetica', 'normal');
          setColor(GRAY_600);
          const mLines = (doc as any).splitTextToSize(clean(missingMatch[1]), CW - 30);
          doc.text(mLines, ML + 28, y);
          y += mLines.length * 4.5 + 4;
        }
      }
    }

    // ── Priority Roadmap (from audit) ────────────────────────────────────────────
    const roadmapMatch = data.auditOutput.match(/PRIORITY ROADMAP\n([\s\S]*?)(?:━|$)/);
    if (roadmapMatch) {
      newPageIfNeeded(40);
      hRule(GRAY_100, 4);
      sectionLabel('Priority Roadmap');

      const roadmapLines = roadmapMatch[1].split('\n').filter(Boolean);
      let currentWeek = '';
      roadmapLines.forEach((line) => {
        const trimmed = clean(line.trim());
        if (!trimmed) return;
        newPageIfNeeded(8);

        if (trimmed.startsWith('▸')) {
          currentWeek = trimmed.replace('▸', '').trim();
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          setColor(PURPLE);
          doc.text(currentWeek.toUpperCase(), ML, y);
          y += 5;
        } else if (trimmed.startsWith('•')) {
          const task = trimmed.replace(/^•\s*/, '');
          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'normal');
          setColor(GRAY_400);
          doc.text('•', ML + 2, y);
          setColor(GRAY_700);
          const wrapped = (doc as any).splitTextToSize(task, CW - 8);
          doc.text(wrapped, ML + 6, y);
          y += wrapped.length * 4.2 + 1;
        }
      });
      y += 4;
    }
  } // end buildAuditPdf

  // ─────────────────────────────────────────────────────────────────────────────
  // ── STRATEGY PDF ─────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────
  function buildStrategyPdf() {
    if (!data.strategyOutput) return;

    // Purple header bar
    setFill(PURPLE);
    doc.rect(0, 0, PW, 20, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('GEO ANALYZER', ML, 9);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('The Yoast SEO of the AI Era', ML, 15);
    const dateStr2 = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    doc.text(dateStr2, PW - MR, 9, { align: 'right' });

    y = 28;

    // Title
    sectionLabel('Strategy Report');
    const domain2 = (() => {
      try {
        return new URL(
          data.url.startsWith('http') ? data.url : `https://${data.url}`
        ).hostname.replace('www.', '');
      } catch {
        return data.url || 'Report';
      }
    })();
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    setColor(GRAY_900);
    doc.text(domain2, ML, y);
    y += 8;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    setColor(GRAY_400);
    doc.text(`${data.url}`, ML, y);
    y += 4;
    doc.text(
      `${data.provider.charAt(0).toUpperCase() + data.provider.slice(1)}  ·  ${data.model}`,
      ML,
      y
    );
    y += 8;

    hRule(GRAY_100, 6);

    // Projection boxes
    const projection2 = parseStrategyProjection(data.strategyOutput);
    if (projection2) {
      const bW2 = CW / 3 - 4;
      [
        {
          label: 'Current Score',
          value: projection2.current,
          color: scoreColor(projection2.current),
        },
        {
          label: 'After Quick Wins',
          value: projection2.afterQuickWins,
          color: scoreColor(projection2.afterQuickWins),
        },
        {
          label: 'After 30-Day Plan',
          value: projection2.afterFullPlan,
          color: scoreColor(projection2.afterFullPlan),
        },
      ].forEach((p, i) => {
        const bx = ML + i * (bW2 + 6);
        setDraw(GRAY_100);
        doc.setLineWidth(0.4);
        doc.roundedRect(bx, y, bW2, 28, 2, 2, 'S');
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        setColor(GRAY_400);
        doc.text(p.label.toUpperCase(), bx + 4, y + 8);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        setColor(p.color);
        doc.text(String(p.value), bx + 4, y + 21);
        doc.setFontSize(8);
        setColor(GRAY_400);
        const nW = p.value >= 100 ? 16 : p.value >= 10 ? 13 : 10;
        doc.text('/ 100', bx + 4 + nW, y + 21);
        if (i < 2) {
          setColor(GRAY_400);
          doc.setFontSize(10);
          doc.text('->', bx + bW2 + 1, y + 17);
        }
      });
      y += 36;
    }

    hRule(GRAY_100, 4);

    // Quick Wins
    const qw = parseStrategyQuickWins(data.strategyOutput);
    if (qw.length > 0) {
      sectionLabel(`Quick Wins — This Week  (${qw.length} tasks)`);
      qw.forEach((win, i) => {
        newPageIfNeeded(10);
        setFill(i % 2 === 0 ? '#FAFAFA' : '#FFFFFF');
        const wLines = (doc as any).splitTextToSize(win.action, CW - 22);
        const rH = wLines.length * 4.5 + 5;
        doc.rect(ML, y - 3, CW, rH, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        setColor(PURPLE);
        doc.text(`${i + 1}.`, ML + 1, y + 1);
        doc.setFont('helvetica', 'normal');
        setColor(GRAY_900);
        doc.text(wLines, ML + 6, y + 1);
        if (win.time) {
          doc.setFontSize(7);
          setColor(GRAY_400);
          doc.text(win.time, ML + CW - 1, y + 1, { align: 'right' });
        }
        y += rH;
      });
      y += 6;
    }

    // 30-Day Plan
    const plan2 = parseStrategy30DayPlan(data.strategyOutput);
    if (plan2.length > 0) {
      newPageIfNeeded(35);
      hRule(GRAY_100, 4);
      sectionLabel('30-Day Action Plan');
      plan2.forEach((week, wi) => {
        newPageIfNeeded(week.tasks.length * 7 + 14);
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        setColor(PURPLE);
        doc.text(`WEEK ${wi + 1} — ${week.title.toUpperCase()}`, ML, y);
        y += 5;
        week.tasks.forEach((task) => {
          newPageIfNeeded(8);
          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'normal');
          setColor(GRAY_400);
          doc.text('•', ML + 2, y);
          setColor(GRAY_700);
          const tw = (doc as any).splitTextToSize(task, CW - 8);
          doc.text(tw, ML + 6, y);
          y += tw.length * 4.2 + 1;
        });
        y += 5;
      });
    }

    // Schema Checklist + Content Gaps
    const schema2 = parseStrategySchemaChecklist(data.strategyOutput);
    const gaps2 = parseStrategyContentGaps(data.strategyOutput);
    if (schema2.length > 0 || gaps2.length > 0) {
      newPageIfNeeded(50);
      hRule(GRAY_100, 4);
      const halfW2 = CW / 2 - 5;
      if (schema2.length > 0) {
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        setColor(GRAY_400);
        doc.text('SCHEMA CHECKLIST', ML, y);
      }
      if (gaps2.length > 0) {
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        setColor(GRAY_400);
        doc.text('CONTENT GAPS', ML + halfW2 + 10, y);
      }
      y += 5;

      const maxRows2 = Math.max(schema2.length, gaps2.length);
      for (let i = 0; i < maxRows2; i++) {
        newPageIfNeeded(14);
        const rY = y;
        if (schema2[i]) {
          setDraw(GRAY_400);
          doc.setLineWidth(0.4);
          doc.rect(ML, rY - 2, 3, 3, 'S');
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          setColor(GRAY_700);
          const sL = (doc as any).splitTextToSize(schema2[i].item, halfW2 - 8);
          doc.text(sL, ML + 5, rY + 1);
          if (schema2[i].reason) {
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            setColor(GRAY_400);
            doc.text((doc as any).splitTextToSize(schema2[i].reason, halfW2 - 8), ML + 5, rY + 5);
          }
        }
        if (gaps2[i]) {
          const gx2 = ML + halfW2 + 10;
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          setColor(GRAY_700);
          doc.text(
            (doc as any).splitTextToSize(`${i + 1}. ${gaps2[i].title}`, halfW2 - 4),
            gx2,
            rY + 1
          );
          if (gaps2[i].reason) {
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            setColor(GRAY_400);
            doc.text((doc as any).splitTextToSize(gaps2[i].reason, halfW2 - 4), gx2, rY + 5);
          }
        }
        y += 14;
      }
    }
  } // end buildStrategyPdf
}
