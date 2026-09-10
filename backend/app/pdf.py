from io import BytesIO
import os
import re
import html

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Preformatted,
    Table,
    TableStyle,
)


# --------------------------------------------------
# Unicode fonts
# --------------------------------------------------

FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BOLD_FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
MONO_FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"

if os.path.exists(FONT_PATH):
    pdfmetrics.registerFont(TTFont("DejaVu", FONT_PATH))

if os.path.exists(BOLD_FONT_PATH):
    pdfmetrics.registerFont(TTFont("DejaVu-Bold", BOLD_FONT_PATH))

if os.path.exists(MONO_FONT_PATH):
    pdfmetrics.registerFont(TTFont("DejaVuMono", MONO_FONT_PATH))


# --------------------------------------------------
# Inline Markdown formatting
# --------------------------------------------------

def format_inline(text: str) -> str:
    """
    Convert basic Markdown into ReportLab markup.
    """

    # Escape XML characters
    text = html.escape(text)

    # Bold: **text**
    text = re.sub(
        r"\*\*(.+?)\*\*",
        r"<b>\1</b>",
        text,
    )

    # Italic: *text*
    text = re.sub(
        r"(?<!\*)\*([^*]+?)\*(?!\*)",
        r"<i>\1</i>",
        text,
    )

    # Inline code: `code`
    text = re.sub(
        r"`([^`]+)`",
        r'<font name="DejaVuMono">\1</font>',
        text,
    )

    return text


# --------------------------------------------------
# Markdown table detection
# --------------------------------------------------

def is_table_separator(line: str) -> bool:
    cells = line.strip().strip("|").split("|")

    return all(
        re.fullmatch(r"\s*:?-+:?\s*", cell)
        for cell in cells
    )


def parse_table(lines, start_index):
    """
    Parse a Markdown table.

    Example:

    | Name | Type |
    |------|------|
    | John | User |
    """

    if start_index + 1 >= len(lines):
        return None, start_index

    header_line = lines[start_index]
    separator_line = lines[start_index + 1]

    if not header_line.strip().startswith("|"):
        return None, start_index

    if not is_table_separator(separator_line):
        return None, start_index

    rows = []

    # Header
    header = [
        cell.strip()
        for cell in header_line.strip().strip("|").split("|")
    ]

    rows.append(header)

    # Rows
    i = start_index + 2

    while i < len(lines):

        line = lines[i].strip()

        if not line.startswith("|"):
            break

        row = [
            cell.strip()
            for cell in line.strip("|").split("|")
        ]

        rows.append(row)

        i += 1

    return rows, i


def create_table(data, table_cell_style):
    """
    Convert parsed Markdown table into a ReportLab table.
    """

    formatted_data = []

    for row_index, row in enumerate(data):

        formatted_row = []

        for cell in row:

            formatted_row.append(
                Paragraph(
                    format_inline(cell),
                    table_cell_style,
                )
            )

        formatted_data.append(formatted_row)

    table = Table(
        formatted_data,
        repeatRows=1,
        hAlign="LEFT",
    )

    table.setStyle(
        TableStyle(
            [
                # Header
                (
                    "FONTNAME",
                    (0, 0),
                    (-1, 0),
                    "DejaVu-Bold",
                ),

                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, 0),
                    colors.lightgrey,
                ),

                # Borders
                (
                    "GRID",
                    (0, 0),
                    (-1, -1),
                    0.4,
                    colors.grey,
                ),

                # Alignment
                (
                    "VALIGN",
                    (0, 0),
                    (-1, -1),
                    "TOP",
                ),

                # Padding
                (
                    "LEFTPADDING",
                    (0, 0),
                    (-1, -1),
                    5,
                ),

                (
                    "RIGHTPADDING",
                    (0, 0),
                    (-1, -1),
                    5,
                ),

                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    4,
                ),

                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    4,
                ),
            ]
        )
    )

    return table


# --------------------------------------------------
# PDF generator
# --------------------------------------------------

def create_pdf(cheatsheet: str) -> BytesIO:

    buffer = BytesIO()

    styles = getSampleStyleSheet()

    # ----------------------------------------------
    # Title
    # ----------------------------------------------

    title_style = ParagraphStyle(
        "CustomTitle",
        parent=styles["Title"],
        fontName="DejaVu-Bold",
        fontSize=20,
        leading=24,
        alignment=TA_LEFT,
        spaceAfter=14,
    )

    # ----------------------------------------------
    # Heading 2
    # ----------------------------------------------

    heading2_style = ParagraphStyle(
        "CustomHeading2",
        parent=styles["Heading2"],
        fontName="DejaVu-Bold",
        fontSize=14,
        leading=18,
        spaceBefore=10,
        spaceAfter=8,
    )

    # ----------------------------------------------
    # Heading 3
    # ----------------------------------------------

    heading3_style = ParagraphStyle(
        "CustomHeading3",
        parent=styles["Heading3"],
        fontName="DejaVu-Bold",
        fontSize=11,
        leading=14,
        spaceBefore=8,
        spaceAfter=5,
    )

    # ----------------------------------------------
    # Body
    # ----------------------------------------------

    body_style = ParagraphStyle(
        "CustomBody",
        parent=styles["BodyText"],
        fontName="DejaVu",
        fontSize=9,
        leading=13,
        spaceAfter=5,
    )

    # ----------------------------------------------
    # Bullet
    # ----------------------------------------------

    bullet_style = ParagraphStyle(
        "CustomBullet",
        parent=body_style,
        leftIndent=12,
        firstLineIndent=-8,
    )

    # ----------------------------------------------
    # Code
    # ----------------------------------------------

    code_style = ParagraphStyle(
        "CustomCode",
        parent=styles["Code"],
        fontName="DejaVuMono",
        fontSize=7.5,
        leading=10,
        leftIndent=8,
        rightIndent=8,
        spaceBefore=4,
        spaceAfter=8,
        backColor=colors.whitesmoke,
    )

    # ----------------------------------------------
    # Table cell
    # ----------------------------------------------

    table_cell_style = ParagraphStyle(
        "TableCell",
        parent=body_style,
        fontName="DejaVu",
        fontSize=7.5,
        leading=10,
        spaceAfter=0,
    )

    # ----------------------------------------------
    # Document
    # ----------------------------------------------

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
    )

    story = []

    lines = cheatsheet.splitlines()

    i = 0
    in_code_block = False
    code_lines = []

    while i < len(lines):

        line = lines[i]
        stripped = line.strip()

        # ------------------------------------------
        # Code block
        # ------------------------------------------

        if stripped.startswith("```"):

            if in_code_block:

                if code_lines:

                    story.append(
                        Preformatted(
                            "\n".join(code_lines),
                            code_style,
                        )
                    )

                code_lines = []
                in_code_block = False

            else:

                in_code_block = True

            i += 1
            continue

        if in_code_block:

            code_lines.append(line)

            i += 1
            continue

        # ------------------------------------------
        # Empty line
        # ------------------------------------------

        if not stripped:

            story.append(
                Spacer(1, 5)
            )

            i += 1
            continue

        # ------------------------------------------
        # Markdown table
        # ------------------------------------------

        if stripped.startswith("|"):

            table_data, next_index = parse_table(
                lines,
                i,
            )

            if table_data:

                story.append(
                    create_table(
                        table_data,
                        table_cell_style,
                    )
                )

                story.append(
                    Spacer(1, 8)
                )

                i = next_index
                continue

        # ------------------------------------------
        # H1
        # ------------------------------------------

        if stripped.startswith("# "):

            text = stripped[2:]

            story.append(
                Paragraph(
                    format_inline(text),
                    title_style,
                )
            )

        # ------------------------------------------
        # H2
        # ------------------------------------------

        elif stripped.startswith("## "):

            text = stripped[3:]

            story.append(
                Paragraph(
                    format_inline(text),
                    heading2_style,
                )
            )

        # ------------------------------------------
        # H3
        # ------------------------------------------

        elif stripped.startswith("### "):

            text = stripped[4:]

            story.append(
                Paragraph(
                    format_inline(text),
                    heading3_style,
                )
            )

        # ------------------------------------------
        # Horizontal rule
        # ------------------------------------------

        elif stripped == "---":

            story.append(
                Spacer(1, 5)
            )

        # ------------------------------------------
        # Bullet
        # ------------------------------------------

        elif stripped.startswith("- "):

            text = stripped[2:]

            story.append(
                Paragraph(
                    "• " + format_inline(text),
                    bullet_style,
                )
            )

        elif stripped.startswith("* "):

            text = stripped[2:]

            story.append(
                Paragraph(
                    "• " + format_inline(text),
                    bullet_style,
                )
            )

        # ------------------------------------------
        # Normal paragraph
        # ------------------------------------------

        else:

            story.append(
                Paragraph(
                    format_inline(stripped),
                    body_style,
                )
            )

        i += 1

    # ----------------------------------------------
    # Handle unclosed code block
    # ----------------------------------------------

    if code_lines:

        story.append(
            Preformatted(
                "\n".join(code_lines),
                code_style,
            )
        )

    # ----------------------------------------------
    # Build
    # ----------------------------------------------

    doc.build(story)

    buffer.seek(0)

    return buffer