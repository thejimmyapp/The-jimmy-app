from __future__ import annotations

import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "reports"


def main() -> None:
    build_pdf(
        source=REPORTS / "The_Jimmy_App_Improvement_Guide.md",
        output=REPORTS / "The_Jimmy_App_What_This_App_Can_Do.pdf",
        subtitle="What This App Can Do and How to Use It to Improve",
    )
    build_pdf(
        source=REPORTS / "INSTALLATION_AND_ENRICHMENT_GUIDE.md",
        output=REPORTS / "The_Jimmy_App_Installation_and_Enrichment_Guide.pdf",
        subtitle="Installation, completed-game import, paired PGNs, and troubleshooting",
    )


def build_pdf(source: Path, output: Path, subtitle: str) -> None:
    title, elements = parse_markdown(source)
    doc = SimpleDocTemplate(
        str(output),
        pagesize=LETTER,
        leftMargin=0.78 * inch,
        rightMargin=0.78 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.68 * inch,
        title=title,
        author="The Jimmy App",
    )
    styles = make_styles()
    story = cover_page(title, subtitle, styles)
    story.extend(elements_to_flowables(elements, styles))
    doc.build(story, onFirstPage=draw_footer, onLaterPages=draw_footer)


def make_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "CustomTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=28,
            leading=33,
            textColor=colors.HexColor("#111827"),
            alignment=TA_CENTER,
            spaceAfter=14,
        ),
        "subtitle": ParagraphStyle(
            "CustomSubtitle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=12,
            leading=17,
            textColor=colors.HexColor("#4b5563"),
            alignment=TA_CENTER,
            spaceAfter=20,
        ),
        "h1": ParagraphStyle(
            "Heading1Custom",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=23,
            textColor=colors.HexColor("#1d4ed8"),
            spaceBefore=14,
            spaceAfter=8,
        ),
        "h2": ParagraphStyle(
            "Heading2Custom",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=13.5,
            leading=18,
            textColor=colors.HexColor("#111827"),
            spaceBefore=10,
            spaceAfter=5,
        ),
        "body": ParagraphStyle(
            "BodyCustom",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=10.2,
            leading=15.2,
            textColor=colors.HexColor("#1f2937"),
            spaceAfter=7,
        ),
        "bullet": ParagraphStyle(
            "BulletCustom",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=10.0,
            leading=14.5,
            leftIndent=16,
            firstLineIndent=-9,
            textColor=colors.HexColor("#1f2937"),
            spaceAfter=3,
        ),
        "code": ParagraphStyle(
            "CodeCustom",
            parent=base["Code"],
            fontName="Courier",
            fontSize=8.8,
            leading=12,
            leftIndent=8,
            rightIndent=8,
            backColor=colors.HexColor("#f3f4f6"),
            borderColor=colors.HexColor("#d1d5db"),
            borderWidth=0.5,
            borderPadding=5,
            textColor=colors.HexColor("#111827"),
            spaceBefore=4,
            spaceAfter=8,
        ),
        "note": ParagraphStyle(
            "NoteCustom",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#92400e"),
            backColor=colors.HexColor("#fffbeb"),
            borderColor=colors.HexColor("#f59e0b"),
            borderWidth=0.7,
            borderPadding=7,
            spaceBefore=6,
            spaceAfter=8,
        ),
    }


def cover_page(title: str, subtitle: str, styles: dict[str, ParagraphStyle]) -> list:
    data = [
        [Paragraph("The Jimmy App", styles["title"])],
        [Paragraph(subtitle, styles["subtitle"])],
        [
            Paragraph(
                "A practical local study system for importing Bughouse games, reviewing two-board positions, "
                "analyzing recurring mistakes, training tactical motifs, and turning personal data into better habits.",
                styles["body"],
            )
        ],
    ]
    table = Table(data, colWidths=[6.7 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#eef6ff")),
                ("BOX", (0, 0), (-1, -1), 1.1, colors.HexColor("#93c5fd")),
                ("LEFTPADDING", (0, 0), (-1, -1), 26),
                ("RIGHTPADDING", (0, 0), (-1, -1), 26),
                ("TOPPADDING", (0, 0), (-1, -1), 22),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 20),
            ]
        )
    )
    return [Spacer(1, 1.2 * inch), table, PageBreak()]


def parse_markdown(path: Path) -> tuple[str, list[tuple[str, str]]]:
    lines = path.read_text(encoding="utf-8").splitlines()
    title = "The Jimmy App"
    elements: list[tuple[str, str]] = []
    in_code = False
    code_lines: list[str] = []
    paragraph_lines: list[str] = []

    def flush_paragraph() -> None:
        if paragraph_lines:
            elements.append(("p", " ".join(line.strip() for line in paragraph_lines).strip()))
            paragraph_lines.clear()

    for line in lines:
        raw = line.rstrip()
        if raw.startswith("```"):
            if in_code:
                elements.append(("code", "\n".join(code_lines)))
                code_lines.clear()
                in_code = False
            else:
                flush_paragraph()
                in_code = True
            continue
        if in_code:
            code_lines.append(raw)
            continue
        if not raw.strip():
            flush_paragraph()
            continue
        if raw.startswith("# "):
            flush_paragraph()
            text = raw[2:].strip()
            title = text if title == "The Jimmy App" else title
            elements.append(("h1", text))
            continue
        if raw.startswith("## "):
            flush_paragraph()
            elements.append(("h1", raw[3:].strip()))
            continue
        if raw.startswith("### "):
            flush_paragraph()
            elements.append(("h2", raw[4:].strip()))
            continue
        if raw.startswith("- "):
            flush_paragraph()
            elements.append(("bullet", raw[2:].strip()))
            continue
        paragraph_lines.append(raw)
    flush_paragraph()
    return title, elements


def elements_to_flowables(elements: list[tuple[str, str]], styles: dict[str, ParagraphStyle]) -> list:
    flowables = []
    for kind, text in elements:
        clean = inline_markup(text)
        if kind == "h1":
            flowables.append(Paragraph(clean, styles["h1"]))
        elif kind == "h2":
            flowables.append(Paragraph(clean, styles["h2"]))
        elif kind == "bullet":
            flowables.append(Paragraph(f"&bull; {clean}", styles["bullet"]))
        elif kind == "code":
            escaped = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br/>")
            flowables.append(Paragraph(escaped, styles["code"]))
        else:
            style = styles["note"] if clean.lower().startswith("important:") else styles["body"]
            flowables.append(Paragraph(clean, style))
    return flowables


def inline_markup(text: str) -> str:
    escaped = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    escaped = re.sub(r"`([^`]+)`", r"<font name='Courier'>\1</font>", escaped)
    escaped = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", escaped)
    return escaped


def draw_footer(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#6b7280"))
    canvas.drawString(doc.leftMargin, 0.38 * inch, "The Jimmy App")
    canvas.drawRightString(LETTER[0] - doc.rightMargin, 0.38 * inch, f"Page {doc.page}")
    canvas.restoreState()


if __name__ == "__main__":
    main()
