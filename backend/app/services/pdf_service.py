from __future__ import annotations

from datetime import datetime
from typing import Any


PAGE_WIDTH = 595.0  # A4 portrait width in pt
PAGE_HEIGHT = 842.0  # A4 portrait height in pt
MARGIN = 50.0


def _safe_text(value: Any) -> str:
    text = '' if value is None else str(value)
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    # Built-in PDF core fonts support WinAnsi-ish range; keep output safe.
    text = text.encode('latin-1', 'replace').decode('latin-1')
    return text


def _escape_pdf_text(value: str) -> str:
    return value.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')


def _wrap_text(text: str, font_size: float, max_width: float) -> list[str]:
    text = _safe_text(text).strip()
    if not text:
        return []

    approx_char_width = max(font_size * 0.52, 4.5)
    max_chars = max(20, int(max_width / approx_char_width))
    words = text.split()
    if not words:
        return []

    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        candidate = f'{current} {word}'
        if len(candidate) <= max_chars:
            current = candidate
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def _build_overview_lines(trip) -> list[dict[str, Any]]:
    constraints = trip.constraints if isinstance(trip.constraints, dict) else {}
    ai_generated = constraints.get('aiGenerated', {}) if isinstance(constraints, dict) else {}
    selection = ai_generated.get('selection', {}) if isinstance(ai_generated, dict) else {}
    overview = ai_generated.get('overview', {}) if isinstance(ai_generated, dict) else {}
    weather = ai_generated.get('weather', []) if isinstance(ai_generated, dict) else []
    budget = ai_generated.get('budget', {}) if isinstance(ai_generated, dict) else {}
    budget_entries = ai_generated.get('budgetEntries', []) if isinstance(ai_generated, dict) else []

    selected_flight_id = str(selection.get('selectedFlightId') or '')
    selected_stay_id = str(selection.get('selectedStayId') or '')

    selected_flight = None
    for option in trip.flight_options:
        if selected_flight_id and str(option.id) == selected_flight_id:
            selected_flight = option
            break
    if not selected_flight and trip.flight_options:
        selected_flight = trip.flight_options[0]

    selected_stay = None
    for option in trip.stay_options:
        if selected_stay_id and str(option.id) == selected_stay_id:
            selected_stay = option
            break
    if not selected_stay and trip.stay_options:
        selected_stay = trip.stay_options[0]

    summary = _safe_text(overview.get('summary', ''))
    notes = _safe_text(overview.get('notes', ''))
    notes_seed = overview.get('notes_seed', []) if isinstance(overview, dict) else []
    if not isinstance(notes_seed, list):
        notes_seed = []

    destination = _safe_text(trip.destination or trip.title or 'Trip')
    date_from = trip.start_date.isoformat() if trip.start_date else '-'
    date_to = trip.end_date.isoformat() if trip.end_date else '-'
    travelers = trip.travelers_count or 1
    origin = _safe_text(trip.origin or '-')
    budget_tier = _safe_text(trip.budget_tier or '-')

    estimated_total = budget.get('total_estimated', budget.get('totalEstimated'))
    currency = _safe_text(budget.get('currency') or 'EUR')
    actual_total = 0.0
    if isinstance(budget_entries, list):
        for entry in budget_entries:
            try:
                actual_total += float((entry or {}).get('amount', 0) or 0)
            except (TypeError, ValueError):
                continue
    delta = None
    if estimated_total is not None:
        try:
            delta = float(estimated_total) - actual_total
        except (TypeError, ValueError):
            delta = None

    lines: list[dict[str, Any]] = []
    lines.append({'text': 'TRIPLY - OVERVIEW', 'size': 18, 'font': 'F2', 'gap_after': 6})
    lines.append({'text': destination, 'size': 15, 'font': 'F2', 'gap_after': 2})
    lines.append({'text': f'{date_from} -> {date_to} | {travelers} traveler(s) | Origin: {origin}', 'size': 10, 'font': 'F1', 'gap_after': 14})

    lines.append({'text': 'Trip Snapshot', 'size': 12, 'font': 'F2', 'gap_after': 5})
    lines.append({'text': f'Budget tier: {budget_tier}', 'size': 10, 'font': 'F1', 'gap_after': 1})
    if estimated_total is not None:
        lines.append({'text': f'Budget estimated: {currency} {float(estimated_total):.2f}', 'size': 10, 'font': 'F1', 'gap_after': 1})
    lines.append({'text': f'Budget actual: {currency} {actual_total:.2f}', 'size': 10, 'font': 'F1', 'gap_after': 1})
    if delta is not None:
        lines.append({'text': f'Budget delta: {currency} {delta:.2f}', 'size': 10, 'font': 'F1', 'gap_after': 1})
    lines.append({'text': '', 'size': 10, 'font': 'F1', 'gap_after': 8})

    lines.append({'text': 'Primary Flight', 'size': 12, 'font': 'F2', 'gap_after': 5})
    if selected_flight:
        details = selected_flight.details or {}
        airline = _safe_text(selected_flight.airline or 'Flight option')
        route = f"{_safe_text(details.get('origin') or '')} -> {_safe_text(details.get('destination') or '')}".strip()
        price = _safe_text(details.get('priceHint') or '-')
        lines.append({'text': f'{airline} | {route} | {price}', 'size': 10, 'font': 'F1', 'gap_after': 8})
    else:
        lines.append({'text': 'No primary flight selected.', 'size': 10, 'font': 'F1', 'gap_after': 8})

    lines.append({'text': 'Primary Stay', 'size': 12, 'font': 'F2', 'gap_after': 5})
    if selected_stay:
        details = selected_stay.details or {}
        stay_name = _safe_text(selected_stay.name or 'Stay option')
        price = _safe_text(details.get('priceRange') or '-')
        lines.append({'text': f'{stay_name} | {price}', 'size': 10, 'font': 'F1', 'gap_after': 8})
    else:
        lines.append({'text': 'No primary stay selected.', 'size': 10, 'font': 'F1', 'gap_after': 8})

    lines.append({'text': 'Weather (Forecast)', 'size': 12, 'font': 'F2', 'gap_after': 5})
    if isinstance(weather, list) and weather:
        for day in weather[:7]:
            date = _safe_text((day or {}).get('date', '-'))
            cond = _safe_text((day or {}).get('condition', 'Forecast'))
            hi = (day or {}).get('high_temp_c', (day or {}).get('highTempC'))
            lo = (day or {}).get('low_temp_c', (day or {}).get('lowTempC'))
            humidity = (day or {}).get('humidity_pct', (day or {}).get('humidityPct'))
            hi_txt = '-' if hi is None else str(hi)
            lo_txt = '-' if lo is None else str(lo)
            hum_txt = '-' if humidity is None else str(humidity)
            lines.append({'text': f'{date}: {cond}, {hi_txt}C/{lo_txt}C, humidity {hum_txt}%', 'size': 10, 'font': 'F1', 'gap_after': 1})
    else:
        lines.append({'text': 'No weather forecast available.', 'size': 10, 'font': 'F1', 'gap_after': 1})
    lines.append({'text': '', 'size': 10, 'font': 'F1', 'gap_after': 8})

    lines.append({'text': 'Summary', 'size': 12, 'font': 'F2', 'gap_after': 5})
    if summary:
        lines.append({'text': summary, 'size': 10, 'font': 'F1', 'gap_after': 8})
    else:
        lines.append({'text': 'No summary generated.', 'size': 10, 'font': 'F1', 'gap_after': 8})

    lines.append({'text': 'Notes', 'size': 12, 'font': 'F2', 'gap_after': 5})
    if notes:
        lines.append({'text': notes, 'size': 10, 'font': 'F1', 'gap_after': 6})
    else:
        lines.append({'text': 'No notes added.', 'size': 10, 'font': 'F1', 'gap_after': 6})
    lines.append({'text': 'Personalized Expert Advice', 'size': 12, 'font': 'F2', 'gap_after': 5})
    advice_rows = notes_seed[:8] if notes_seed else [
        'Buy attraction tickets in advance for popular time slots.',
        'Keep valuables secure in crowded transit hubs and tourist zones.',
        'Group nearby activities on the same day to reduce travel time.',
    ]
    for idx, note in enumerate(advice_rows, start=1):
        lines.append({'text': f'{idx}. {_safe_text(note)}', 'size': 10, 'font': 'F1', 'gap_after': 1})

    lines.append({'text': '', 'size': 10, 'font': 'F1', 'gap_after': 10})
    lines.append({'text': f'Generated on {datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")}', 'size': 9, 'font': 'F1', 'gap_after': 0})

    return lines


def _paginate_lines(lines: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    pages: list[list[dict[str, Any]]] = []
    current_page: list[dict[str, Any]] = []
    y_cursor = PAGE_HEIGHT - MARGIN
    usable_width = PAGE_WIDTH - (2 * MARGIN)

    for line in lines:
        text = _safe_text(line.get('text', ''))
        font = line.get('font', 'F1')
        size = float(line.get('size', 10))
        gap_after = float(line.get('gap_after', max(2.0, size * 0.35)))

        wrapped = _wrap_text(text, size, usable_width) if text else ['']
        line_height = max(12.0, size * 1.35)
        block_height = (line_height * len(wrapped)) + gap_after

        if y_cursor - block_height < MARGIN and current_page:
            pages.append(current_page)
            current_page = []
            y_cursor = PAGE_HEIGHT - MARGIN

        for wrapped_line in wrapped:
            current_page.append({
                'font': font,
                'size': size,
                'x': MARGIN,
                'y': y_cursor,
                'text': wrapped_line,
            })
            y_cursor -= line_height
        y_cursor -= gap_after

    if current_page:
        pages.append(current_page)
    return pages


def _page_stream(lines: list[dict[str, Any]]) -> bytes:
    commands: list[str] = []
    for line in lines:
        text = _escape_pdf_text(_safe_text(line.get('text', '')))
        if not text:
            continue
        x = float(line.get('x', MARGIN))
        y = float(line.get('y', PAGE_HEIGHT - MARGIN))
        size = float(line.get('size', 10))
        font = line.get('font', 'F1')
        commands.append(f"BT /{font} {size:.2f} Tf 1 0 0 1 {x:.2f} {y:.2f} Tm ({text}) Tj ET")
    return '\n'.join(commands).encode('latin-1', 'replace')


def build_overview_pdf(trip) -> bytes:
    lines = _build_overview_lines(trip)
    pages = _paginate_lines(lines)
    if not pages:
        pages = [[{'font': 'F2', 'size': 14, 'x': MARGIN, 'y': PAGE_HEIGHT - MARGIN, 'text': 'Trip overview'}]]

    objects: dict[int, bytes] = {}
    next_id = 3
    page_ids: list[int] = []
    content_ids: list[int] = []

    for page_lines in pages:
        page_id = next_id
        content_id = next_id + 1
        next_id += 2
        page_ids.append(page_id)
        content_ids.append(content_id)
        stream = _page_stream(page_lines)
        objects[content_id] = b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream"

    font_regular_id = next_id
    font_bold_id = next_id + 1

    kids = ' '.join(f'{pid} 0 R' for pid in page_ids)
    objects[1] = b"<< /Type /Catalog /Pages 2 0 R >>"
    objects[2] = f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>".encode()

    for page_id, content_id in zip(page_ids, content_ids):
        objects[page_id] = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_WIDTH:.0f} {PAGE_HEIGHT:.0f}] "
            f"/Resources << /Font << /F1 {font_regular_id} 0 R /F2 {font_bold_id} 0 R >> >> "
            f"/Contents {content_id} 0 R >>"
        ).encode()

    objects[font_regular_id] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
    objects[font_bold_id] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"

    max_id = max(objects.keys())
    out = bytearray()
    out.extend(b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')
    offsets = [0] * (max_id + 1)

    for obj_id in range(1, max_id + 1):
        payload = objects[obj_id]
        offsets[obj_id] = len(out)
        out.extend(f'{obj_id} 0 obj\n'.encode())
        out.extend(payload)
        out.extend(b'\nendobj\n')

    xref_offset = len(out)
    out.extend(f'xref\n0 {max_id + 1}\n'.encode())
    out.extend(b'0000000000 65535 f \n')
    for obj_id in range(1, max_id + 1):
        out.extend(f'{offsets[obj_id]:010d} 00000 n \n'.encode())
    out.extend(f'trailer\n<< /Size {max_id + 1} /Root 1 0 R >>\n'.encode())
    out.extend(f'startxref\n{xref_offset}\n%%EOF\n'.encode())
    return bytes(out)
