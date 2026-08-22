"""Direct AcroForm PDF reading and filling — works on properly fillable government PDFs."""
from pathlib import Path
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, BooleanObject

def read_acroform_fields(pdf_path) -> list[dict]:
    """Read fillable fields from an AcroForm PDF. Returns [] if not AcroForm.
    Each field dict: {name, type, label, options, section}."""
    try:
        reader = PdfReader(str(pdf_path))
    except Exception:
        return []
    raw = reader.get_fields()
    if not raw:
        return []

    out = []
    for name, spec in raw.items():
        ft = spec.get("/FT", "")
        # Map pypdf field-type codes to friendly names
        ftype = {
            "/Tx": "text",
            "/Btn": "checkbox",
            "/Ch": "choice",
            "/Sig": "signature",
        }.get(str(ft), "text")

        # Extract options (for choice/checkbox fields)
        options = []
        if ftype == "choice":
            opts = spec.get("/Opt", [])
            options = [str(o) for o in opts] if opts else []

        # Try to get a human label from /TU (tooltip) or /T (name) or the field name itself
        label = str(spec.get("/TU") or spec.get("/T") or name)

        out.append({
            "field_code": name,      # raw AcroForm name (used to write back)
            "field_name": name,      # duplicate for compatibility
            "label": label,
            "type": ftype,
            "options": options,
            "section": "",
            "instruction": "",
        })
    return out

def fill_acroform_pdf(pdf_path, values: dict, output_path) -> Path:
    """Write string/bool values into an AcroForm PDF. `values` maps field_name -> value.
    Returns the output path."""
    reader = PdfReader(str(pdf_path))
    writer = PdfWriter(clone_from=reader)

    # Ensure the form is set to display filled values (NeedAppearances)
    if writer._root_object.get("/AcroForm"):
        writer._root_object["/AcroForm"].update({
            NameObject("/NeedAppearances"): BooleanObject(True)
        })

    # Coerce values: everything -> str for text fields, keep bool for checkboxes
    coerced: dict = {}
    for k, v in values.items():
        if v is None or v == "":
            continue
        coerced[k] = str(v)

    # Fill each page's fields
    for page in writer.pages:
        try:
            writer.update_page_form_field_values(page, coerced)
        except Exception as e:
            print(f"[fill_acroform] page fill warning: {e}")
            continue

    output_path = Path(output_path)
    with output_path.open("wb") as f:
        writer.write(f)
    return output_path

def is_acroform(pdf_path) -> bool:
    """Quick check whether a PDF is AcroForm-fillable."""
    try:
        reader = PdfReader(str(pdf_path))
        fields = reader.get_fields()
        return bool(fields and len(fields) > 0)
    except Exception:
        return False
