import sys, json, re
import pdfplumber, pypdfium2 as pdfium

PDF = sys.argv[1]
SCALE = 3
pdf = pdfplumber.open(PDF)
doc = pdfium.PdfDocument(PDF)
DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

def cluster(vals, tol=1.5):
    out = []
    for v in sorted(vals):
        if out and v - out[-1][-1] <= tol: out[-1].append(v)
        else: out.append([v])
    return [sum(c)/len(c) for c in out]

def tmin(label, idx_prev):
    h, m = map(int, label.split(':'))
    return h, m

all_events = []
pages_meta = []
for pi, p in enumerate(pdf.pages):
    img = doc[pi].render(scale=SCALE).to_pil().convert('RGB')
    words = p.extract_words(keep_blank_chars=False, use_text_flow=False, extra_attrs=['non_stroking_color'])
    black = [r for r in p.rects if str(r['non_stroking_color']) == '0.0']
    H = [r for r in black if r['width'] > r['height']]
    V = [r for r in black if r['width'] <= r['height']]
    # day header words
    dayw = [w for w in words if w['text'] in DAYS and w['top'] < 80]
    dayw.sort(key=lambda w: w['x0'])
    # header colored rects in first header row
    hdr_top = min(w['top'] for w in dayw) - 3
    hdr_rects = [r for r in p.rects if str(r['non_stroking_color']) != '0.0' and abs(r['top'] - hdr_top) < 6]
    hdr_rects.sort(key=lambda r: r['x0'])
    days = []
    for w in dayw:
        cx = (w['x0'] + w['x1']) / 2
        rr = [r for r in hdr_rects if r['x0'] - 1 <= cx <= r['x1'] + 1]
        if not rr: print('NOHDR', pi+1, w['text'], [(round(r['x0']),round(r['x1']),round(r['top']),str(r['non_stroking_color'])) for r in p.rects if r['top']<90 and str(r['non_stroking_color'])!='0.0'])
        r = min(rr, key=lambda r: r['height'])
        days.append({'name': w['text'], 'x0': r['x0'], 'x1': r['x1']})
    # time labels
    timew = [w for w in words if re.fullmatch(r'\d{1,2}:\d{2}', w['text']) and w['x0'] < days[0]['x0']]
    timew.sort(key=lambda w: w['top'])
    if not timew:
        rows, mins = prev_rows, prev_mins
    else:
      tc_right = days[0]['x0']
      hb = cluster([r['top'] for r in H if r['x1'] <= tc_right + 3 and r['x0'] < tc_right - 10])
      hb = [y for y in hb if y > timew[0]['top'] - 25]
      # rows: for each time label find boundary above and below
      rows = []
      for w in timew:
          c = (w['top'] + w['bottom']) / 2
          above = max([y for y in hb if y <= c] or [w['top'] - 8])
          below = min([y for y in hb if y > c] or [w['bottom'] + 8])
          rows.append([w['text'], above, below])
      for i in range(len(rows) - 1):
          w0, w1 = timew[i], timew[i + 1]
          if rows[i][2] > (w1['top'] + w1['bottom']) / 2:
              mid = (w0['bottom'] + w1['top']) / 2
              rows[i][2] = mid; rows[i + 1][1] = mid
      # convert labels to minutes (6:30 .. 8:30 pm)
      mins = []
      prev = -1
      for lab, a, b in rows:
          h, m = map(int, lab.split(':'))
          t = h * 60 + m
          while t <= prev: t += 12 * 60
          mins.append(t); prev = t
    prev_rows, prev_mins = rows, mins
    grid_top = rows[0][1]; grid_bot = rows[-1][2]
    # date per day
    datew = [w for w in words if w['top'] < hdr_top + 30 and w['top'] > hdr_top + 8]
    for d in days:
        txt = ' '.join(w['text'].replace('Janury','January') for w in sorted(datew, key=lambda w: (round(w['top']/4), w['x0'])) if d['x0'] - 1 <= (w['x0'] + w['x1']) / 2 <= d['x1'] + 1)
        if not re.search(r'(' + '|'.join(MONTHS) + r') (\d{1,2}) ?,? ?(\d{4})', txt): print('NODATE', pi+1, d['name'], repr(txt))
        m = re.search(r'(' + '|'.join(MONTHS) + r') (\d{1,2}) ?,? ?(\d{4})', txt)
        d['date'] = '%s-%02d-%02d' % (m.group(3), MONTHS.index(m.group(1)) + 1, int(m.group(2)))
        lvl = [w['text'] for w in words if w['top'] > hdr_top + 30 and w['top'] < grid_top - 12 and d['x0'] - 1 <= (w['x0'] + w['x1']) / 2 <= d['x1'] + 1]
        d['hdr'] = ' '.join(lvl)
    # vertical boundaries in grid
    vx = cluster([(r['x0'] + r['x1']) / 2 for r in V if r['bottom'] > grid_top + 5 and r['top'] < grid_bot - 5])
    subcols = []
    for d in days:
        xs = [d['x0']] + [x for x in vx if d['x0'] + 5 < x < d['x1'] - 5] + [d['x1']]
        for i in range(len(xs) - 1):
            subcols.append({'day': d, 'x0': xs[i], 'x1': xs[i + 1], 'sub': i, 'nsub': len(xs) - 1})
    def px(x, y):
        return img.getpixel((int(x * SCALE), int(y * SCALE)))
    def classify(rgb):
        r, g, b = rgb
        if abs(r - 182) < 12 and abs(g - 215) < 12 and abs(b - 168) < 12: return 'free'
        if abs(r - g) < 8 and abs(g - b) < 8 and 100 < r < 180: return 'free'  # grey
        return '#%02x%02x%02x' % rgb
    def dark(rgb): return sum(rgb) < 200
    def hline_at(y, x0, x1):
        n = 80; hit = 0
        for k in range(n):
            x = x0 + 3 + (x1 - x0 - 6) * k / (n - 1)
            if any(dark(img.getpixel((int(x * SCALE), int(y * SCALE) + dy))) for dy in range(-3, 4)): hit += 1
        return hit >= 0.95 * n
    def vline_at(x, y0, y1):
        n = 80; hit = 0
        for k in range(n):
            y = y0 + (y1 - y0) * k / (n - 1)
            if any(dark(img.getpixel((int(x * SCALE) + dx, int(y * SCALE)))) for dx in range(-3, 4)): hit += 1
        return hit >= 0.95 * n
    evs = []
    for sc in subcols:
        cur = None
        for i, (lab, a, b) in enumerate(rows):
            cy = (a + b) / 2
            samples = [classify(px(sc['x0'] + 2.5, cy)), classify(px(sc['x1'] - 2.5, cy))]
            occ = [s for s in samples if s != 'free']
            st = occ[0] if len(occ) == 2 else 'free'
            if st == 'free':
                if cur: evs.append(cur); cur = None
                continue
            if cur and not hline_at(a, sc['x0'], sc['x1']):
                cur['r1'] = i
            else:
                if cur: evs.append(cur)
                cur = {'sc': sc, 'r0': i, 'r1': i, 'color': st}
        if cur: evs.append(cur)
    # merge across subcols when no vertical line between
    merged = []
    used = set()
    for i, e in enumerate(evs):
        if i in used: continue
        for j, f in enumerate(evs):
            if j <= i or j in used: continue
            if f['sc']['day'] is e['sc']['day'] and f['r0'] == e['r0'] and f['r1'] == e['r1'] and abs(f['sc']['x0'] - e['sc']['x1']) < 1:
                y0 = rows[e['r0']][1]; y1 = rows[e['r1']][2]
                if not vline_at(e['sc']['x1'], y0 + 2, y1 - 2):
                    e = dict(e); e['sc'] = dict(e['sc']); e['sc']['x1'] = f['sc']['x1']; e['sc']['merged'] = True
                    used.add(j)
        merged.append(e)
    for e in merged:
        sc = e['sc']; y0 = rows[e['r0']][1]; y1 = rows[e['r1']][2]
        ws = [w for w in words if sc['x0'] <= (w['x0'] + w['x1']) / 2 <= sc['x1'] and y0 <= (w['top'] + w['bottom']) / 2 <= y1]
        ws.sort(key=lambda w: (round(w['top']), w['x0']))
        lines = []
        for w in ws:
            if lines and abs(lines[-1][0] - w['top']) < 3: lines[-1][1].append(w['text'])
            else: lines.append([w['top'], [w['text']]])
        text = ' | '.join(' '.join(l[1]) for l in lines)
        if not text.strip(): continue
        start = mins[e['r0']]; end = mins[e['r1']] + 30
        all_events.append({'page': pi + 1, 'date': sc['day']['date'], 'day': sc['day']['name'], 'hdr': sc['day']['hdr'],
                           'sub': sc['sub'], 'nsub': sc['nsub'], 'merged': sc.get('merged', False),
                           'start': '%02d:%02d' % divmod(start, 60), 'end': '%02d:%02d' % divmod(end, 60),
                           'color': e['color'], 'text': text})
    pages_meta.append({'page': pi + 1, 'days': [(d['name'], d['date'], d['hdr']) for d in days], 'nrows': len(rows)})
json.dump({'events': all_events, 'pages': pages_meta}, open(sys.argv[2], 'w'), indent=1)
print(len(all_events))
