"""Generate a filled-form summary PDF from suggested values."""
from pathlib import Path
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

def generate_filled_summary(
    output_path: Path,
    form_name: str,
    agency: str,
    facts: dict,
    suggestions: list[dict],
) -> Path:
    """Create a downloadable summary PDF the citizen can review before filing."""
    output_path = Path(output_path)
    doc = SimpleDocTemplate(str(output_path), pagesize=A4,
                            leftMargin=1.8*cm, rightMargin=1.8*cm,
                            topMargin=1.5*cm, bottomMargin=1.5*cm)
    styles = getSampleStyleSheet()
    story = []

    title_style = ParagraphStyle("Title", parent=styles["Title"],
                                 fontSize=18, textColor=colors.HexColor("#10243e"))
    h2 = ParagraphStyle("H2", parent=styles["Heading2"],
                        fontSize=13, textColor=colors.HexColor("#2b65a5"), spaceBefore=12)
    body = styles["BodyText"]
    small = ParagraphStyle("Small", parent=body, fontSize=8, textColor=colors.grey)

    story.append(Paragraph("Clarify MY — Form Draft", title_style))
    story.append(Paragraph(f"<b>Form:</b> {form_name} &nbsp;&nbsp; <b>Agency:</b> {agency.upper()}", body))
    story.append(Paragraph(f"Generated: {datetime.now().strftime('%d %b %Y, %H:%M')}", small))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "<b>DRAFT — Review before submission.</b> Clarify MY is a citizen tool, "
        "not official agency advice. Under Malaysian law only licensed tax agents "
        "may file returns on your behalf. You remain the signer.", small))
    story.append(Spacer(1, 12))

    # Citizen facts summary
    story.append(Paragraph("Your Situation", h2))
    fact_rows = [[k.replace("_", " ").title(), str(v)] for k, v in facts.items() if v not in (None, "")]
    if fact_rows:
        t = Table([["Fact", "Value"]] + fact_rows, colWidths=[6*cm, 10*cm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#eaf2fa")),
            ("TEXTCOLOR",  (0,0), (-1,0), colors.HexColor("#10243e")),
            ("FONTNAME",   (0,0), (-1,0), "Helvetica-Bold"),
            ("FONTSIZE",   (0,0), (-1,-1), 9),
            ("BOX",        (0,0), (-1,-1), 0.4, colors.HexColor("#cfdce8")),
            ("INNERGRID",  (0,0), (-1,-1), 0.3, colors.HexColor("#eaeff5")),
            ("VALIGN",     (0,0), (-1,-1), "TOP"),
        ]))
        story.append(t)
    else:
        story.append(Paragraph("<i>No facts extracted.</i>", body))

    # Field-by-field suggestions
    story.append(Paragraph("Suggested Field Values", h2))
    header = ["Field", "Label", "Suggested Value", "Confidence", "Source"]
    rows = [header]
    for s in suggestions:
        f = s.get("field", {})
        cit = s.get("citation")
        cit_str = f"{cit['source']} p{cit.get('page')}" if cit else "—"
        rows.append([
            str(f.get("field_code", ""))[:12],
            str(f.get("label", ""))[:40],
            str(s.get("value") if s.get("value") is not None else "(please fill)")[:40],
            str(s.get("confidence", "low")).upper(),
            cit_str[:40],
        ])
    t = Table(rows, colWidths=[2.2*cm, 5.0*cm, 5.5*cm, 2.0*cm, 4.5*cm], repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#2b65a5")),
        ("TEXTCOLOR",  (0,0), (-1,0), colors.white),
        ("FONTNAME",   (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE",   (0,0), (-1,-1), 8),
        ("BOX",        (0,0), (-1,-1), 0.4, colors.HexColor("#cfdce8")),
        ("INNERGRID",  (0,0), (-1,-1), 0.3, colors.HexColor("#eaeff5")),
        ("VALIGN",     (0,0), (-1,-1), "TOP"),
        ("ROWBACKGROUNDS", (0,1), (-1,-1),
         [colors.white, colors.HexColor("#f6f9fc")]),
    ]))
    story.append(t)

    # Reasoning per field
    story.append(PageBreak())
    story.append(Paragraph("Reasoning & Notes per Field", h2))
    for s in suggestions:
        f = s.get("field", {})
        story.append(Paragraph(
            f"<b>{f.get('field_code','')} — {f.get('label','')}</b>", body))
        story.append(Paragraph(f"Suggested: <b>{s.get('value','(please fill)')}</b>  "
                               f"({s.get('confidence','low').upper()})", body))
        if s.get("reasoning"):
            story.append(Paragraph(s["reasoning"], body))
        if s.get("cap_note"):
            story.append(Paragraph(f"<i>Cap / limit:</i> {s['cap_note']}", small))
        if s.get("receipt_required"):
            story.append(Paragraph("<i>Receipt required — keep proof.</i>", small))
        if s.get("citation"):
            c = s["citation"]
            story.append(Paragraph(
                f"<i>Source:</i> {c['source']} p{c.get('page')}", small))
        story.append(Spacer(1, 6))

    doc.build(story)
    return output_path
