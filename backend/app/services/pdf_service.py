from __future__ import annotations

from datetime import datetime
from typing import Any

from fpdf import FPDF

# ── Design tokens (from Triply CSS design system) ──

NAVY_950 = (13, 16, 32)
NAVY_800 = (28, 32, 62)
NAVY_600 = (58, 65, 125)
NAVY_500 = (74, 82, 158)
NAVY_400 = (103, 111, 183)
NAVY_200 = (179, 183, 219)
NAVY_100 = (217, 219, 237)
NAVY_50 = (240, 241, 248)

PRIMARY_600 = (79, 70, 229)
PRIMARY_100 = (224, 231, 255)
PRIMARY_50 = (238, 242, 255)

WHITE = (255, 255, 255)
SUCCESS = (16, 185, 129)

TIME_COLORS = {
    'morning': (234, 88, 12),
    'afternoon': (37, 99, 235),
    'evening': (99, 102, 241),
}
TIME_BG = {
    'morning': (255, 247, 237),
    'afternoon': (239, 246, 255),
    'evening': (238, 242, 255),
}

TIP_COLORS = {
    'transport': PRIMARY_600,
    'free_activities': (22, 163, 106),
    'safety': (220, 38, 38),
    'money': (202, 138, 4),
    'connectivity': (37, 99, 235),
    'food': (234, 88, 12),
    'customs': (22, 163, 106),
    'useful_links': PRIMARY_600,
    'other': NAVY_500,
}
TIP_LABELS = {
    'transport': 'Transport',
    'free_activities': 'Free Activities',
    'safety': 'Safety',
    'money': 'Money',
    'connectivity': 'Connectivity',
    'food': 'Food',
    'customs': 'Customs',
    'useful_links': 'Useful Links',
    'other': 'Other',
}

ML = 15       # margin left
MR = 15       # margin right
PW = 210      # A4 page width mm
CW = PW - ML - MR  # 180 mm content width


_UNICODE_REPLACEMENTS = str.maketrans({
    '\u2018': "'",    # left single quotation mark
    '\u2019': "'",    # right single quotation mark
    '\u201c': '"',    # left double quotation mark
    '\u201d': '"',    # right double quotation mark
    '\u2013': '-',    # en dash
    '\u2014': '-',    # em dash
    '\u2026': '...',  # horizontal ellipsis
    '\u20ac': 'EUR',  # euro sign (not in latin-1)
    '\u00b0': ' deg', # degree sign (handled separately via \xb0 in weather)
    '\u00e9': 'e',
    '\u00e8': 'e',
    '\u00ea': 'e',
    '\u00eb': 'e',
    '\u00e0': 'a',
    '\u00e1': 'a',
    '\u00e2': 'a',
    '\u00e4': 'a',
    '\u00f6': 'o',
    '\u00fc': 'u',
    '\u00df': 'ss',
    '\u00f1': 'n',
    '\u00e7': 'c',
    '\u00ed': 'i',
    '\u00f3': 'o',
    '\u00fa': 'u',
    '\u2022': '-',    # bullet
    '\u00a0': ' ',    # non-breaking space
    '\u00ab': '"',    # left-pointing angle quotation
    '\u00bb': '"',    # right-pointing angle quotation
})


def _safe(value: Any) -> str:
    text = '' if value is None else str(value)
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    text = text.translate(_UNICODE_REPLACEMENTS)
    return text.encode('latin-1', 'replace').decode('latin-1')


def _extract(trip) -> dict[str, Any]:
    """Pull all relevant data from the Trip ORM object into a flat dict."""
    constraints = trip.constraints if isinstance(trip.constraints, dict) else {}
    ai = constraints.get('aiGenerated', {}) or {}
    selection = ai.get('selection', {}) or {}
    overview = ai.get('overview', {}) or {}

    sfid = str(selection.get('selectedFlightId') or '')
    sel_flight = None
    for f in trip.flight_options:
        if sfid and str(f.id) == sfid:
            sel_flight = f
            break
    if not sel_flight and trip.flight_options:
        sel_flight = trip.flight_options[0]

    ssid = str(selection.get('selectedStayId') or '')
    sel_stay = None
    for s in trip.stay_options:
        if ssid and str(s.id) == ssid:
            sel_stay = s
            break
    if not sel_stay and trip.stay_options:
        sel_stay = trip.stay_options[0]

    budget = ai.get('budget', {}) or {}
    entries = ai.get('budgetEntries', []) or []
    estimated = budget.get('total_estimated', budget.get('totalEstimated'))
    currency = _safe(budget.get('currency') or 'EUR')
    actual = 0.0
    for e in (entries if isinstance(entries, list) else []):
        try:
            actual += float((e or {}).get('amount', 0) or 0)
        except (TypeError, ValueError):
            pass

    return {
        'destination': _safe(trip.destination or trip.title or 'Trip'),
        'start_date': trip.start_date.strftime('%b %d, %Y') if trip.start_date else '-',
        'end_date': trip.end_date.strftime('%b %d, %Y') if trip.end_date else '-',
        'travelers': trip.travelers_count or 1,
        'origin': _safe(trip.origin or '-'),
        'budget_tier': _safe(trip.budget_tier or '-').title(),
        'pace': _safe(trip.pace or '-').title(),
        'summary': _safe(overview.get('summary', '')),
        'notes': _safe(overview.get('notes', '')),
        'notes_seed': overview.get('notes_seed') or [],
        'days': trip.days,
        'flight': sel_flight,
        'stay': sel_stay,
        'weather': ai.get('weather') or [],
        'tips': ai.get('tips') or [],
        'currency': currency,
        'estimated': estimated,
        'actual': actual,
        'budget_cats': budget.get('categories') or [],
    }


class TripPDF(FPDF):

    def __init__(self, data: dict[str, Any]):
        super().__init__('P', 'mm', 'A4')
        self.set_auto_page_break(True, 25)
        self.set_margins(ML, 15, MR)
        self.d = data
        self._on_cover = True

    # ── Automatic header / footer on every page ──

    def header(self):
        if self._on_cover:
            return
        self.set_fill_color(*NAVY_950)
        self.rect(0, 0, PW, 2.5, 'F')
        self.set_font('Helvetica', 'B', 7)
        self.set_text_color(*NAVY_400)
        self.set_xy(ML, 4)
        self.cell(30, 4, 'TRIPLY')
        self.set_font('Helvetica', '', 7)
        self.set_xy(PW - MR - 60, 4)
        self.cell(60, 4, self.d['destination'], align='R')
        self.set_y(16)

    def footer(self):
        self.set_y(-18)
        self.set_draw_color(*NAVY_100)
        self.set_line_width(0.3)
        self.line(ML, self.get_y(), PW - MR, self.get_y())
        self.ln(3)
        self.set_font('Helvetica', '', 7)
        self.set_text_color(*NAVY_400)
        self.cell(
            CW / 2, 6,
            f'Generated by Triply  |  {datetime.utcnow().strftime("%B %d, %Y")}',
        )
        self.cell(CW / 2, 6, f'{self.page_no()}', align='R')

    # ── Helpers ──

    def _space(self, h: float):
        if self.get_y() + h > 297 - 25:
            self.add_page()

    def _heading(self, title: str, subtitle: str = ''):
        self._space(22)
        if self.get_y() > 20:
            self.ln(8)
        y = self.get_y()
        self.set_fill_color(*PRIMARY_600)
        self.rect(ML, y + 2.5, 3, 3, 'F')
        self.set_x(ML + 6)
        self.set_font('Helvetica', 'B', 13)
        self.set_text_color(*NAVY_950)
        self.cell(0, 8, title)
        self.ln(9)
        if subtitle:
            self.set_font('Helvetica', '', 9)
            self.set_text_color(*NAVY_500)
            self.cell(0, 5, subtitle)
            self.ln(6)
        self.set_draw_color(*NAVY_100)
        self.set_line_width(0.3)
        self.line(ML, self.get_y(), PW - MR, self.get_y())
        self.ln(5)

    # ── Cover page ──

    def cover(self):
        self.add_page()

        self.set_fill_color(*NAVY_950)
        self.rect(0, 0, PW, 58, 'F')

        self.set_font('Helvetica', 'B', 10)
        self.set_text_color(*NAVY_400)
        self.set_xy(ML, 12)
        self.cell(30, 6, 'TRIPLY')

        self.set_draw_color(*NAVY_600)
        self.set_line_width(0.2)
        self.line(ML, 22, ML + 25, 22)

        self.set_font('Helvetica', 'B', 22)
        self.set_text_color(*WHITE)
        self.set_xy(ML, 26)
        self.cell(CW, 10, self.d['destination'])

        n = self.d['travelers']
        sub = (
            f"{self.d['start_date']}  -  {self.d['end_date']}   |   "
            f"{n} traveler{'s' if n != 1 else ''}   |   From {self.d['origin']}"
        )
        self.set_font('Helvetica', '', 10)
        self.set_text_color(*NAVY_200)
        self.set_xy(ML, 40)
        self.cell(CW, 6, sub)

        self.set_y(66)

        if self.d['summary']:
            self.set_font('Helvetica', '', 10)
            self.set_text_color(*NAVY_600)
            self.multi_cell(CW, 5.5, self.d['summary'])
            self.ln(6)

        self._cover_stats()

        seeds = self.d['notes_seed']
        if seeds:
            self.ln(2)
            self.set_font('Helvetica', 'B', 11)
            self.set_text_color(*NAVY_950)
            self.cell(0, 7, 'Expert Advice')
            self.ln(8)
            for i, note in enumerate(seeds[:6], 1):
                self._space(8)
                self.set_x(ML + 2)
                self.set_font('Helvetica', 'B', 9)
                self.set_text_color(*PRIMARY_600)
                self.cell(5, 5, f'{i}.')
                self.set_font('Helvetica', '', 9)
                self.set_text_color(*NAVY_600)
                self.multi_cell(CW - 7, 5, _safe(note))
                self.ln(1)

        notes = self.d.get('notes', '')
        if notes:
            self._space(16)
            self.ln(4)
            self.set_font('Helvetica', 'B', 11)
            self.set_text_color(*NAVY_950)
            self.cell(0, 7, 'Notes')
            self.ln(7)
            self.set_font('Helvetica', '', 9)
            self.set_text_color(*NAVY_600)
            self.multi_cell(CW, 4.5, notes)

        self._on_cover = False

    def _cover_stats(self):
        bw = (CW - 8) / 3
        y = self.get_y()
        for i, (lbl, val) in enumerate([
            ('Budget', self.d['budget_tier']),
            ('Duration', f"{len(self.d['days'])} days"),
            ('Pace', self.d['pace']),
        ]):
            x = ML + i * (bw + 4)
            self.set_fill_color(*NAVY_50)
            self.set_draw_color(*NAVY_100)
            self.set_line_width(0.3)
            self.rect(x, y, bw, 18, 'DF')
            self.set_xy(x, y + 3)
            self.set_font('Helvetica', '', 8)
            self.set_text_color(*NAVY_400)
            self.cell(bw, 4, lbl, align='C')
            self.set_xy(x, y + 8)
            self.set_font('Helvetica', 'B', 11)
            self.set_text_color(*NAVY_950)
            self.cell(bw, 6, val, align='C')
        self.set_y(y + 24)

    # ── Travel details ──

    def travel(self):
        fl, st = self.d.get('flight'), self.d.get('stay')
        if not fl and not st:
            return
        self._heading('Travel Details', 'Your selected flight and accommodation')
        if fl:
            self._flight_card(fl)
            self.ln(4)
        if st:
            self._stay_card(st)

    def _flight_card(self, f):
        det = f.details or {}
        airline = _safe(f.airline or 'Flight')
        orig = _safe(det.get('origin', '') or '')
        dest = _safe(det.get('destination', '') or '')
        route = f'{orig} -> {dest}' if orig else ''
        # Prefer the real ORM price columns; fall back to the details JSON hint
        if f.price_amount is not None:
            cur = _safe(f.price_currency or 'EUR')
            price = f'{cur} {float(f.price_amount):.0f}'
        else:
            price = _safe(det.get('priceHint', det.get('priceRange', '')) or '')
        dur = _safe(det.get('duration', '') or '')
        stops = f.stops_count
        stops_t = ''
        if stops is not None:
            stops_t = 'Direct' if stops == 0 else f'{stops} stop{"s" if stops != 1 else ""}'

        h = 22
        self._space(h + 4)
        y = self.get_y()

        self.set_fill_color(*NAVY_50)
        self.set_draw_color(*NAVY_100)
        self.set_line_width(0.3)
        self.rect(ML, y, CW, h, 'DF')
        self.set_fill_color(*PRIMARY_600)
        self.rect(ML, y, 3, h, 'F')

        self.set_xy(ML + 8, y + 3)
        self.set_font('Helvetica', 'B', 7)
        self.set_text_color(*PRIMARY_600)
        self.cell(20, 4, 'FLIGHT')

        self.set_xy(ML + 8, y + 8)
        self.set_font('Helvetica', 'B', 10)
        self.set_text_color(*NAVY_950)
        self.cell(80, 5, airline)

        parts = [p for p in [route, dur, stops_t] if p]
        if parts:
            self.set_xy(ML + 8, y + 14)
            self.set_font('Helvetica', '', 9)
            self.set_text_color(*NAVY_600)
            self.cell(90, 5, '  |  '.join(parts))

        if price:
            self.set_font('Helvetica', 'B', 11)
            self.set_text_color(*NAVY_950)
            self.set_xy(PW - MR - 50, y + 8)
            self.cell(45, 6, price, align='R')

        self.set_y(y + h)

    def _stay_card(self, s):
        det = s.details or {}
        name = _safe(s.name or 'Accommodation')
        hood = _safe(s.neighborhood or '')
        # Prefer ORM price columns; fall back to details JSON
        if s.price_amount is not None:
            cur = _safe(s.price_currency or 'EUR')
            price = f'{cur} {float(s.price_amount):.0f}/night'
        else:
            price = _safe(det.get('priceRange', det.get('priceHint', '')) or '')
        rating = float(s.rating) if s.rating else None
        why = _safe(s.why_it_fits or '')

        base_h = 22
        why_extra = 0
        if why:
            self.set_font('Helvetica', 'I', 8)
            sw = self.get_string_width(why)
            avail = CW - 16
            lines = max(1, int(sw / avail) + 1)
            why_extra = lines * 4.5 + 2

        h = base_h + why_extra
        self._space(h + 4)
        y = self.get_y()

        self.set_fill_color(*NAVY_50)
        self.set_draw_color(*NAVY_100)
        self.set_line_width(0.3)
        self.rect(ML, y, CW, h, 'DF')
        self.set_fill_color(*SUCCESS)
        self.rect(ML, y, 3, h, 'F')

        self.set_xy(ML + 8, y + 3)
        self.set_font('Helvetica', 'B', 7)
        self.set_text_color(*SUCCESS)
        self.cell(30, 4, 'ACCOMMODATION')

        self.set_xy(ML + 8, y + 8)
        self.set_font('Helvetica', 'B', 10)
        self.set_text_color(*NAVY_950)
        self.cell(80, 5, name)

        info = [p for p in [hood, f'{rating:.1f} rating' if rating else ''] if p]
        if info:
            self.set_xy(ML + 8, y + 14)
            self.set_font('Helvetica', '', 9)
            self.set_text_color(*NAVY_600)
            self.cell(80, 5, '  |  '.join(info))

        if why:
            self.set_xy(ML + 8, y + 20)
            self.set_font('Helvetica', 'I', 8)
            self.set_text_color(*NAVY_500)
            self.multi_cell(CW - 16, 4.5, why)

        if price:
            self.set_font('Helvetica', 'B', 11)
            self.set_text_color(*NAVY_950)
            self.set_xy(PW - MR - 50, y + 8)
            self.cell(45, 6, price, align='R')

        self.set_y(y + h)

    # ── Day-by-day itinerary ──

    def itinerary(self):
        days = self.d.get('days', [])
        if not days:
            return
        self._heading('Day-by-Day Itinerary', f'{len(days)} days planned')
        for day in days:
            self._day(day)

    def _day(self, day):
        num = day.day_index
        title = _safe(day.title or f'Day {num}')
        date_s = day.date.strftime('%A, %b %d') if day.date else ''
        items = day.plan_items or []

        self._space(18)
        y = self.get_y()

        badge = f'DAY {num}'
        self.set_font('Helvetica', 'B', 8)
        bw = self.get_string_width(badge) + 8
        self.set_fill_color(*PRIMARY_600)
        self.rect(ML, y, bw, 7, 'F')
        self.set_text_color(*WHITE)
        self.set_xy(ML, y)
        self.cell(bw, 7, badge, align='C')

        self.set_xy(ML + bw + 4, y)
        self.set_font('Helvetica', 'B', 11)
        self.set_text_color(*NAVY_950)
        self.cell(80, 7, title)

        if date_s:
            self.set_font('Helvetica', '', 9)
            self.set_text_color(*NAVY_400)
            self.set_xy(PW - MR - 60, y)
            self.cell(60, 7, date_s, align='R')

        self.set_y(y + 10)

        if not items:
            self.set_font('Helvetica', 'I', 9)
            self.set_text_color(*NAVY_400)
            self.cell(0, 6, 'No activities planned for this day.')
            self.ln(8)
            return

        for item in items:
            self._activity(item)
        self.ln(4)

    def _activity(self, item):
        title = _safe(item.title or 'Activity')
        desc = _safe(item.description or '')
        tb = (item.time_block or '').lower().strip()
        dur = item.duration_minutes
        loc = _safe(item.location_name or '')
        cat = _safe(item.category or '')
        cost = _safe(item.cost_hint or '')

        self._space(14)

        tc = TIME_COLORS.get(tb, NAVY_400)
        y = self.get_y()

        self.set_fill_color(*tc)
        self.rect(ML, y + 1.5, 2.5, 2.5, 'F')

        x = ML + 6

        if tb:
            lbl = tb.title()
            self.set_font('Helvetica', 'B', 7)
            tw = self.get_string_width(lbl) + 6
            bg = TIME_BG.get(tb, NAVY_50)
            self.set_fill_color(*bg)
            self.rect(x, y + 0.5, tw, 5, 'F')
            self.set_text_color(*tc)
            self.set_xy(x, y)
            self.cell(tw, 6, lbl, align='C')
            self.set_x(x + tw + 2)
        else:
            self.set_xy(x, y)

        self.set_font('Helvetica', 'B', 10)
        self.set_text_color(*NAVY_950)
        self.cell(0, 6, title)
        self.ln(6)

        if desc:
            self.set_x(x)
            self.set_font('Helvetica', '', 8.5)
            self.set_text_color(*NAVY_600)
            self.multi_cell(CW - 6, 4.5, desc)

        meta = []
        if dur:
            h, m = divmod(dur, 60)
            meta.append(f'{h}h {m}m' if h and m else (f'{h}h' if h else f'{m}m'))
        if loc:
            meta.append(loc)
        if cat:
            meta.append(cat.title())
        if cost:
            meta.append(cost)
        if meta:
            self.set_x(x)
            self.set_font('Helvetica', '', 7.5)
            self.set_text_color(*NAVY_400)
            self.cell(0, 5, '   |   '.join(meta))
            self.ln(5)

        self.ln(1)
        self.set_draw_color(*NAVY_100)
        self.set_line_width(0.15)
        self.line(x, self.get_y(), PW - MR, self.get_y())
        self.ln(3)

    # ── Tips ──

    def tips(self):
        tips_data = self.d.get('tips', [])
        if not tips_data:
            return
        self._heading('Tips & Local Info', 'Practical information for your trip')
        for t in tips_data:
            if isinstance(t, dict):
                self._tip(t)

    def _tip(self, t: dict):
        raw_cat = str(t.get('category', 'other') or 'other').lower().strip()
        cat = raw_cat if raw_cat in TIP_LABELS else 'other'
        title = _safe(t.get('title', ''))
        desc = _safe(t.get('description', ''))

        self._space(14)
        tc = TIP_COLORS.get(cat, NAVY_500)
        y = self.get_y()
        x = ML + 4

        self.set_fill_color(*tc)
        self.rect(ML, y + 1.5, 2.5, 2.5, 'F')

        lbl = TIP_LABELS.get(cat, 'Other')
        self.set_xy(x + 2, y)
        self.set_font('Helvetica', 'B', 7)
        lw = self.get_string_width(lbl) + 6
        self.set_fill_color(*NAVY_50)
        self.rect(x + 2, y + 0.5, lw, 5, 'F')
        self.set_text_color(*tc)
        self.cell(lw, 6, lbl, align='C')

        self.set_x(x + 2 + lw + 3)
        self.set_font('Helvetica', 'B', 9)
        self.set_text_color(*NAVY_950)
        self.cell(0, 6, title)
        self.ln(7)

        if desc:
            self.set_x(x + 2)
            self.set_font('Helvetica', '', 8.5)
            self.set_text_color(*NAVY_600)
            self.multi_cell(CW - 10, 4.5, desc)

        self.ln(1)
        self.set_draw_color(*NAVY_100)
        self.set_line_width(0.15)
        self.line(x, self.get_y(), PW - MR, self.get_y())
        self.ln(3)

    # ── Weather ──

    def weather(self):
        wx = self.d.get('weather', [])
        if not wx:
            return
        self._heading('Weather Forecast')

        cols = [38, 62, 28, 28, 24]
        hdrs = ['Date', 'Condition', 'High', 'Low', 'Humidity']

        self._space(10)
        y = self.get_y()
        self.set_fill_color(*NAVY_950)
        self.rect(ML, y, CW, 7, 'F')
        self.set_font('Helvetica', 'B', 8)
        self.set_text_color(*WHITE)
        cx = ML
        for hdr, w in zip(hdrs, cols):
            self.set_xy(cx, y)
            self.cell(w, 7, hdr, align='C')
            cx += w
        self.set_y(y + 7)

        for i, day in enumerate(wx[:14]):
            if not isinstance(day, dict):
                continue
            self._space(7)
            ry = self.get_y()
            if i % 2 == 0:
                self.set_fill_color(*NAVY_50)
                self.rect(ML, ry, CW, 7, 'F')

            dt = _safe(day.get('date', '-'))
            cond = _safe(day.get('condition', '-'))
            hi = day.get('high_temp_c', day.get('highTempC'))
            lo = day.get('low_temp_c', day.get('lowTempC'))
            hum = day.get('humidity_pct', day.get('humidityPct'))

            cells = [
                dt, cond,
                f'{hi}\xb0C' if hi is not None else '-',
                f'{lo}\xb0C' if lo is not None else '-',
                f'{hum}%' if hum is not None else '-',
            ]
            self.set_font('Helvetica', '', 8)
            self.set_text_color(*NAVY_950)
            cx = ML
            for txt, w in zip(cells, cols):
                self.set_xy(cx, ry)
                self.cell(w, 7, txt, align='C')
                cx += w
            self.set_y(ry + 7)

    # ── Budget ──

    def budget(self):
        est = self.d.get('estimated')
        cats = self.d.get('budget_cats', [])
        if est is None and not cats:
            return

        self._heading('Budget Overview')

        cur = self.d['currency']
        actual = self.d['actual']
        delta = None
        if est is not None:
            try:
                delta = float(est) - actual
            except (TypeError, ValueError):
                pass

        bw = (CW - 8) / 3
        y = self.get_y()
        for i, (lbl, val) in enumerate([
            ('Estimated', f'{cur} {float(est):.0f}' if est is not None else '-'),
            ('Spent', f'{cur} {actual:.0f}'),
            ('Remaining', f'{cur} {delta:.0f}' if delta is not None else '-'),
        ]):
            x = ML + i * (bw + 4)
            self.set_fill_color(*NAVY_50)
            self.set_draw_color(*NAVY_100)
            self.set_line_width(0.3)
            self.rect(x, y, bw, 18, 'DF')
            self.set_xy(x, y + 3)
            self.set_font('Helvetica', '', 8)
            self.set_text_color(*NAVY_400)
            self.cell(bw, 4, lbl, align='C')
            self.set_xy(x, y + 8)
            self.set_font('Helvetica', 'B', 11)
            self.set_text_color(*NAVY_950)
            self.cell(bw, 6, val, align='C')
        self.set_y(y + 24)

        if isinstance(cats, list) and cats:
            self.set_font('Helvetica', 'B', 10)
            self.set_text_color(*NAVY_950)
            self.cell(0, 6, 'By Category')
            self.ln(7)
            for c in cats:
                if not isinstance(c, dict):
                    continue
                self._space(7)
                cn = _safe(c.get('category', ''))
                amt = c.get('estimatedAmount', c.get('estimated_amount'))
                note = _safe(c.get('note', ''))
                self.set_font('Helvetica', 'B', 9)
                self.set_text_color(*NAVY_950)
                self.cell(50, 5, cn.title())
                if amt is not None:
                    self.set_font('Helvetica', '', 9)
                    self.set_text_color(*NAVY_600)
                    self.cell(30, 5, f'{cur} {float(amt):.0f}')
                if note:
                    self.set_font('Helvetica', 'I', 8)
                    self.set_text_color(*NAVY_400)
                    self.cell(0, 5, note[:80])
                self.ln(6)


def build_trip_pdf(trip) -> bytes:
    """Build a comprehensive styled PDF for the given trip."""
    data = _extract(trip)
    pdf = TripPDF(data)
    pdf.cover()
    pdf.travel()
    pdf.itinerary()
    pdf.tips()
    pdf.weather()
    pdf.budget()
    return bytes(pdf.output())


def build_overview_pdf(trip) -> bytes:
    """Backward-compatible alias."""
    return build_trip_pdf(trip)
