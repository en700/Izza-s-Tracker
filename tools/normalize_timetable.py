import json, re, sys, hashlib
raw = json.load(open(sys.argv[1]))['events']

COURSES = {
 'DH101': 'Preclinical Practice I', 'DH102': 'Practice Environment I', 'DH103': 'Dental Anatomy',
 'DH104': 'Client Management & Education', 'DH105': 'Anatomy, Pathology & Pathophysiology',
 'DH106': 'Radiography Theory', 'DH107': 'Communication Techniques', 'DH108': 'Microbiology & Infection Control',
 'DH109': 'Head & Neck Anatomy', 'DH110': 'Professional Issues I', 'DH111': 'Psychology for the Health Professional',
 'DH112': 'Oral Histology & Embryology', 'DH113': 'Radiography Lab',
 'L1O': 'Level 1 Orientation',
}

def instructors(t):
    t = t.replace('|', ' ')
    out = []
    for m in re.finditer(r'\b(Mrs?|Ms)\.\s*([A-Z][A-Za-z]+)', t):
        name = '%s. %s' % (m.group(1), m.group(2))
        if m.group(2) == 'CGN': name = 'Mrs. CGN'
        if name not in out: out.append(name)
    if not out and re.search(r'\|\s*Moreno\s*\|', '|' + t + '|'): out.append('Ms. Moreno')
    return out

events = []
for r in raw:
    if 'Level 3' in r['hdr']:
        continue  # Level 3 schedule removed on request
    t = r['text']; flat = ' '.join(s.strip() for s in t.split('|'))
    flat = re.sub(r'\s+', ' ', flat)
    e = {'date': r['date'], 'start': r['start'], 'end': r['end']}
    if 'Thanksgiving' in flat:
        events.append({'date': r['date'], 'allDay': True, 'kind': 'closure', 'title': 'Thanksgiving weekend — school closed', 'mode': 'none'})
        continue
    m = re.search(r'DH\s?(\d{3})', flat)
    code = 'DH' + m.group(1) if m else None
    if 'DH 101/DH 113' in flat: code = 'DH101'
    if 'Orientation to L1' in flat: code = 'L1O'
    e['code'] = code
    e['course'] = COURSES.get(code)
    e['instructors'] = instructors(t)
    # kind
    up = flat.upper()
    kind = 'class'
    detail = []
    if r['color'] == '#ffc000' or re.search(r'\bEXAM\b', up) and 'EXAM REVIEW' not in up:
        kind = 'exam'; detail.append('Final exam' if 'FINAL' in up else 'Exam')
    elif re.search(r'TEST', up) and 'RESTEST' not in up:
        kind = 'test'
        m2 = re.search(r'(Test \d|IPAC TEST|Class\+Test)', flat, re.I)
        detail.append({'IPAC TEST': 'IPAC test', 'CLASS+TEST': 'Class + test'}.get(m2.group(1).upper(), m2.group(1)) if m2 else 'Test')
    elif 'EXAM REVIEW' in up: detail.append('Exam review')
    if code is None:
        kind = 'test' if kind == 'test' else 'program'
    # subtitles
    for pat, label in [('Chart Workshop', 'Chart workshop'), ('PCP Integration', 'PCP integration (partner care)'),
                       ('Orientation to L1', 'Orientation to Level 1 + Health & Safety training'),
                       (r'DH 113 \| Orientation', 'Rad lab orientation'), ('Roleplay', 'Roleplay assignment'),
                       ('Restest', 'Retest day (schedule to follow)'), ('Observation', 'Level 3 clinic observation'),
                       ('Remedial', 'Level 1 remedial (DH 101 / DH 113) — Classroom A'), ('Asyncronous', 'Asynchronous')]:
        if re.search(pat, t): detail.insert(0, label)
    if 'PARTNER CARE' in up: detail.insert(0, 'Partner care clinic')
    # title
    if code:
        e['title'] = COURSES[code]
        if code == 'DH101' and 'Remedial' in flat: e['title'] = 'Remedial — Preclinical & Rad Lab'
        for pat, title in [(r'DH 113 \| Orientation', 'Rad Lab Orientation'), ('Roleplay', 'Rad Lab Roleplay Assignment'),
                           ('Restest', 'Rad Lab Retest Day'), ('Chart Workshop', 'Chart Workshop'),
                           ('PCP Integration', 'PCP Integration (Partner Care)'), ('Observation', 'Level 3 Clinic Observation')]:
            if re.search(pat, t): e['title'] = title
    else:
        title = flat.title() if flat.isupper() else flat
        title = {'Clinic': 'Clinic', 'Clinic Ipac Test': 'Clinic — IPAC test', 'L1 4 Chairs Clinic': 'L1 4 chairs — Clinic',
                 'L1 E&P ON-SITE': 'Level 1 E&P', 'L1 Mid-Session Meetings In-Person': 'Level 1 mid-session meetings'}.get(title, title)
        if flat == 'L1 E&P ON-SITE': title = 'Level 1 E&P'
        if 'Mid-Session' in flat: title = 'Level 1 mid-session meetings'
        if 'Orientation to L1' in flat: title = 'Level 1 Orientation'
        e['title'] = title
    # mode
    if re.search(r'online|asyncronous', flat, re.I): mode = 'online'
    elif re.search(r'\bLAB\b|CLINIC|IN.PERSON|ON-SITE|Classroom|Rad Lab', flat, re.I): mode = 'in-person'
    elif code in ('DH101',): mode = 'in-person'
    elif code: mode = 'online'
    else: mode = 'unspecified'
    e['mode'] = mode
    # type
    if code == 'DH113' and 'Rad Lab' in flat and 'Restest' not in flat: e['type'] = 'lab'
    elif code == 'DH101' and re.search(r'\bCLINIC\b', up): e['type'] = 'clinic'
    elif re.search(r'\bLAB\b', up): e['type'] = 'lab'
    else: e['type'] = 'lecture' if mode == 'online' and code else ('session' if code else 'program')
    # groups
    g = None
    m = re.search(r'Group ([AB]) Clinician.*Group ([AB]) Client', flat)
    if m:
        g = {'type': 'pair', 'clinician': m.group(1), 'client': m.group(2)}
    elif re.search(r'Rad Groups', flat):
        g = {'type': 'rad', 'values': re.findall(r'[AB]\d', flat)}
    elif re.search(r'Group ([AB]\d)', flat):
        g = {'type': 'rad', 'values': re.findall(r'Group ([AB]\d)', flat)}
    elif re.search(r'Group ([AB])\b', flat):
        g = {'type': 'pre', 'values': re.findall(r'Group ([AB])\b', flat)}
    if g: e['group'] = g
    if kind != 'class': e['kind'] = kind
    else: e['kind'] = 'class' if code else 'program'
    e['detail'] = '; '.join(dict.fromkeys(detail)) or None
    events.append(e)

def closure(date, title):
    events.append({'date': date, 'allDay': True, 'kind': 'closure', 'title': title, 'mode': 'none'})
closure('2027-02-15', 'No classes — Family Day')
import datetime
d = datetime.date(2026, 12, 19)
while d <= datetime.date(2027, 1, 3):
    closure(d.isoformat(), 'Winter break — no classes scheduled'); d += datetime.timedelta(days=1)
closure('2027-03-26', 'No classes scheduled'); closure('2027-03-27', 'No classes scheduled')

for e in events:
    key = '|'.join(str(e.get(k)) for k in ('date', 'start', 'code', 'title', 'group'))
    e['id'] = 's_' + hashlib.sha1(key.encode()).hexdigest()[:10]
    for k in [k for k, v in e.items() if v in (None, [], '')]: del e[k]
ids = [e['id'] for e in events]; assert len(ids) == len(set(ids)), 'dup ids'
events.sort(key=lambda e: (e['date'], e.get('start', '00:00')))
json.dump({'term': {'name': 'Level 1 Schedule', 'program': 'Dental Hygiene', 'start': '2026-10-05', 'end': '2027-03-27'},
           'courses': COURSES, 'sessions': events}, open(sys.argv[2], 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(events))
