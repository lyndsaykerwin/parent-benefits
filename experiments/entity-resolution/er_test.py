"""Entity-resolution test for Bundle recall matching.

Scores three strategies on a hand-labelled set of FAKE purchases against the REAL live
CPSC + openFDA recall feeds (saved in data/ on Oct 24, 2026):
  A  = today's rule copied from bundle/server/agents/recall.ts (word net + exact-name auto-accept,
       loose pairs go to the AI with the same yes/no prompt; offline = loose pairs rejected)
  B  = structured fields + hard rules (brand, product type, product-line word, sale window,
       FDA status/shelf life, size conflict). No AI.
  C  = B's brand+type join and hard date/status rules, then an AI verifier that must QUOTE
       matching evidence from both records; code checks every quote really appears.
Run:  python3 er_test.py            (uses cached AI answers in data/ai_cache.json if present)
      python3 er_test.py --no-ai    (skip AI strategies)
Secrets are read from ../../.secrets/bundle.env.local and never printed.
"""
import json, re, sys, pathlib, urllib.request, hashlib, datetime as dt

HERE = pathlib.Path(__file__).parent
DATA = HERE / 'data'
USE_AI = '--no-ai' not in sys.argv
PURCHASE_FILE = DATA / (sys.argv[sys.argv.index('--set') + 1] if '--set' in sys.argv else 'purchases.json')

# ----------------------------------------------------------------------------- load recalls
def month(s):  # 'YYYY-MM-DD' or 'YYYYMMDD' -> date
    s = s.replace('-', '')
    return dt.date(int(s[:4]), int(s[4:6]), int(s[6:8]))

recalls = []
for r in json.load(open(DATA / 'cpsc.json')):
    for p in r.get('Products') or [{}]:
        recalls.append({
            'id': f"cpsc-{r['RecallID']}", 'src': 'cpsc', 'product': p.get('Name') or '', 'title': r.get('Title') or '',
            'desc': r.get('Description') or '', 'retail': ' '.join(x.get('Name', '') for x in r.get('Retailers') or []),
            'upcs': [u.get('UPC') for u in r.get('ProductUPCs') or [] if u.get('UPC')],
            'makers': [m.get('Name', '') for m in (r.get('Manufacturers') or []) + (r.get('Importers') or []) + (r.get('Distributors') or [])],
            'date': month(r['RecallDate'][:10]), 'status': 'Ongoing'})
for x in json.load(open(DATA / 'fda.json'))['results']:
    recalls.append({
        'id': f"fda-{x['recall_number']}", 'src': 'fda', 'product': x['product_description'], 'title': f"FDA recall: {x['recalling_firm']}",
        'desc': x['product_description'] + ' ' + x.get('code_info', ''), 'retail': x.get('distribution_pattern', ''),
        'upcs': re.findall(r'\b\d{11,13}\b', (x['product_description'] + ' ' + x.get('code_info', '')).replace(' ', '')),
        'makers': [x['recalling_firm']], 'date': month(x['recall_initiation_date']), 'status': x['status']})
BY_ID = {}
for r in recalls:
    BY_ID.setdefault(r['id'], r)
purchases = json.load(open(PURCHASE_FILE))['purchases']
for p in purchases:
    p['d'] = month(p['date'])

# ----------------------------------------------------------------------------- AI helper
ENV = {}
envf = HERE / '../../.secrets/bundle.env.local'
if envf.exists():
    for line in envf.read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            k, v = line.split('=', 1); ENV[k.strip()] = v.strip().strip('"').strip("'")
CACHE_F = DATA / 'ai_cache.json'
CACHE = json.loads(CACHE_F.read_text()) if CACHE_F.exists() else {}
AI_CALLS = {'live': 0, 'cached': 0, 'failed': 0}

def ask_json(prompt):
    """Same call shape as bundle/server/adapters/llm.ts: reasoning model, temp 0.2, JSON-only system line."""
    key = hashlib.sha256(prompt.encode()).hexdigest()
    if key in CACHE:
        AI_CALLS['cached'] += 1; return CACHE[key]
    if not (USE_AI and ENV.get('MODEL_API_KEY')) or '--cache-only' in sys.argv:
        return None
    body = {'model': ENV['MODEL_REASONING'], 'temperature': 0.2, 'max_tokens': 1500, 'messages': [
        {'role': 'system', 'content': 'Reply with valid JSON only. No prose, no code fences.'},
        {'role': 'user', 'content': prompt}]}
    req = urllib.request.Request(ENV['MODEL_BASE_URL'].rstrip('/') + '/chat/completions', json.dumps(body).encode(),
                                 {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ENV['MODEL_API_KEY']})
    import signal
    def _boom(*a): raise TimeoutError('hard 120s limit')
    signal.signal(signal.SIGALRM, _boom); signal.alarm(120)
    try:
        txt = json.load(urllib.request.urlopen(req, timeout=60))['choices'][0]['message']['content'] or ''
        txt = re.sub(r'^```(json)?|```$', '', txt.strip()).strip()
        val = json.loads(txt[txt.find('{'): txt.rfind('}') + 1])
    except Exception as e:
        signal.alarm(0); AI_CALLS['failed'] += 1; print('  AI call failed:', type(e).__name__, file=sys.stderr, flush=True); return None
    signal.alarm(0)
    AI_CALLS['live'] += 1
    CACHE[key] = val; CACHE_F.write_text(json.dumps(CACHE, indent=1))
    return val

# ============================================================================= STRATEGY A: today's rule
STOP = ['baby', 'infant', 'child', 'kids', 'kid', 'toddler', 'newborn', 'crib', 'with', 'from', 'pack', 'size', 'count',
        'and', 'the', 'for', 'set', 'new', 'little', 'light', 'night']
def words(t): return re.sub(r'[^a-z0-9]+', ' ', t.lower()).strip().split(' ')
def tokens(t): return {w for w in words(t) if len(w) >= 3 and w not in STOP}
def first_word(t): return words(t)[0]
def norm(t): return re.sub(r'\s+', ' ', t.lower()).strip()
def exact(item, product): p = norm(product); return len(p) >= 4 and p in norm(item)

def a_net(item, product):
    """recall.ts pairsSql ON clause, re-written in Python."""
    if product.lower() in item.lower():
        return True
    if len(tokens(item) & tokens(product)) >= 2:
        return True
    b = first_word(product)
    return len(b) >= 4 and b not in STOP and b in tokens(item)

def strategy_a(with_ai, cap=25):
    """Faithful to checkRecalls(): all net pairs ordered newest recall first; exact-name pairs auto-accepted;
    only the first `cap` loose pairs (MAX_PAIRS = 25 in recall.ts) get the AI yes/no question; the rest are dropped."""
    out, net = {}, []
    for p in purchases:
        for r in recalls:
            if a_net(p['text'], r['product']):
                net.append((p['id'], r['id']))
    net.sort(key=lambda k: BY_ID[k[1]]['date'], reverse=True)
    loose = [k for k in net if not exact(next(x for x in purchases if x['id'] == k[0])['text'], BY_ID[k[1]]['product'])]
    for k in net:
        if k not in loose:
            out[k] = 'exact name'
    judged = loose[:cap] if with_ai else []
    for pid, rid in judged:
        p, r = next(x for x in purchases if x['id'] == pid), BY_ID[rid]
        prompt = ('Is the product a family bought the SAME product (same brand and model) as the product named in a safety recall? '
                  'Different products from the same category do not count. Reply as JSON: {"same": true} or {"same": false}.\n'
                  f"Bought: {p['text']}\nRecalled: {r['product']}\nRecall: {r['title']}")
        v = ask_json(prompt)
        if v and v.get('same') is True:
            out[(pid, rid)] = 'AI said same'
    strategy_a.cut = len(loose) - len(judged)
    return out, net

# ============================================================================= STRATEGY B: structured fields + rules
GENERIC = set(STOP) | {'organic', 'cotton', 'portable', 'premium', 'various', 'brands', 'children', 'childrens', 'play', 'yards',
                       'high', 'chairs', 'chair', 'convertible', 'retractable', 'safety', 'electric', 'electronic', 'abbott', 'brand',
                       'recall', 'recalls', 'recalled', 'expanded', 'inc', 'llc', 'ltd', 'corp', 'company', 'of', 'usa', 'north',
                       'america', 'international', 'trading', 'technology', 'enterprises', 'group', 'products', 'direct', 'store',
                       'whole', 'milk', 'nutrition', 'formula', 'powder', 'mattress', 'mattresses', 'personalized', 'braided',
                       'multi', 'point', 'aftermarket', 'criblike', 'design', 'this', 'involves', 'a', 'b', 'c', '1', '2', '3', 'x'}
# canonical product types: (type, regex). Order does not matter; suppression rules below.
TYPES = [
    ('car_seat_adapter', r'car seat adapters?'), ('car_seat', r'car seats?'), ('stroller', r'strollers?'),
    ('crib_mattress', r'(mini )?crib (mattress|pad)|crib mattresses'), ('playyard_mattress', r'(pack ?n ?play|play ?yard|playard) mattress(es)?'),
    ('mattress', r'mattress(es)?'), ('play_yard', r'play ?yards?|playards?|pack ?n ?play'), ('crib', r'\bcribs?\b'),
    ('bassinet', r'bassinets?|bedside sleepers?'), ('high_chair', r'high ?chairs?'), ('swing', r'\bswings?\b'),
    ('baby_gate', r'(baby|safety) gates?|gates?\b'), ('lounger', r'loungers?'), ('bottle', r'bottles?'), ('teether', r'teethers?|teething'),
    ('monitor', r'monitors?'), ('walker', r'walkers?'), ('bath_seat', r'bath (seats?|tubs?)'), ('bumper', r'bumpers?'),
    ('glider', r'gliders?|recliners?'), ('nursing_pillow', r'nursing pillows?'), ('formula', r'infant formula|formula'),
    ('bib', r'\bbibs?\b'), ('toy', r'toys?|plush|stuffed animal|activity center'), ('carrier', r'carriers?'),
]
SUPPRESS = {'car_seat_adapter': {'car_seat', 'stroller'}, 'crib_mattress': {'crib', 'mattress'}, 'playyard_mattress': {'play_yard', 'mattress', 'crib'},
            'bassinet': {'play_yard'}}
TYPE_WORDS = {'seat', 'seats', 'adapter', 'adapters', 'stroller', 'strollers', 'crib', 'mattress', 'mattresses', 'pad', 'play', 'yard', 'yards',
              'playard', 'bassinet', 'bassinets', 'sleepers', 'sleeper', 'high', 'chair', 'chairs', 'highchair', 'highchairs', 'swing', 'swings',
              'gate', 'gates', 'lounger', 'loungers', 'bottle', 'bottles', 'teether', 'teethers', 'monitor', 'monitors', 'walker', 'walkers',
              'bath', 'tub', 'tubs', 'bumpers', 'glider', 'gliders', 'recliner', 'recliners', 'pillow', 'pillows', 'formula', 'car', 'toy', 'toys'}

def ptypes(text):
    t = re.split(r'\bfor\b', text.lower())[0]  # head noun comes before "for ..." ("Adapters for Joolz Aer 2 Stroller")
    found = {name for name, rx in TYPES if re.search(rx, t)}
    for k, sup in SUPPRESS.items():
        if k in found: found -= sup
    return found

def squash(t): return re.sub(r'[^a-z0-9]', '', t.lower())
MODEL_RX = re.compile(r'\b(?=[A-Z0-9-]*\d)(?=[A-Z0-9-]*[A-Z])[A-Z0-9][A-Z0-9-]{3,}\b')
UNIT_RX = re.compile(r'^\d+(\.\d+)?(OZ|IN|FT|LB|LBS|G|ML|CT|PK|P|HD|MM|CM)$|IN-1$|^\d+X\d+$')
def models(text):
    return {m.replace('-', '') for m in MODEL_RX.findall(text.upper()) if not UNIT_RX.search(m) and not m.startswith('ISO')}
def sizes(text): return {f"{float(n):g}oz" for n in re.findall(r'(\d+(?:\.\d+)?)\s*-?\s*(?:oz|fl oz)\b', text.lower())}

MONTHS = {m: i for i, m in enumerate(['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'], 1)}
def sale_window(r):
    """From CPSC 'Retailers' text such as 'from August 2024 through July 2025'. Missing end = recall date."""
    if r['src'] == 'fda':
        return None
    m = re.search(r'from (\w+) (\d{4})(?: (?:through|to|until) (\w+) (\d{4}))?', r['retail'], re.I)
    if not m or m.group(1).lower() not in MONTHS:
        return None
    start = dt.date(int(m.group(2)), MONTHS[m.group(1).lower()], 1)
    if m.group(3) and m.group(3).lower() in MONTHS:
        y, mo = int(m.group(4)), MONTHS[m.group(3).lower()]
        end = dt.date(y + (mo == 12), mo % 12 + 1, 1) - dt.timedelta(days=1)
    else:
        end = r['date']
    return start, end

def recall_brands(r):
    """Brand candidates: first real word of the product name, the recalling firm in the title, the
    'This recall involves X' phrase, listed makers. Each kept as a squashed 1-2 word string."""
    cands = []
    def add(phrase):
        ws = [w for w in words(phrase) if w]
        while ws and ws[0] in GENERIC: ws = ws[1:]
        if ws:
            cands.append(ws[0]);
            if len(ws) > 1: cands.append(ws[0] + ws[1])
    add(r['product'])
    if r['src'] == 'fda':
        add(re.sub(r'^\W*(a\.\)|1\.)?', '', r['product']))
        for w in words(r['product'])[:4]:
            if w not in GENERIC and len(w) >= 2: cands.append(w)
    m = re.match(r'(.+?) recalls? ', r['title'], re.I)
    if m: add(m.group(1))
    m = re.search(r'this recall involves (?:the )?(.{0,60})', r['desc'], re.I)
    if m: add(m.group(1))
    for mk in r['makers']: add(mk.split(',')[0])
    return {c for c in cands if len(c) >= 2 and c not in GENERIC}

def purchase_brand(p):
    ws = [w for w in words(p['text']) if w]
    return {ws[0], ws[0] + ws[1]} if len(ws) > 1 else set(ws)

def line_words(r, brands):
    """Distinctive product-line words in the recall name (not brand, not type, not generic)."""
    return {w for w in words(r['product']) if len(w) >= 3 and w not in GENERIC and w not in TYPE_WORDS
            and w not in brands and not w.isdigit() and not re.match(r'\d+(oz|in)$', w)}

SELLER_WORDS = {'amazon': 'amazon', 'walmart': 'walmart', 'target': 'target', 'carters': 'carter'}
FORMULA_SHELF_LIFE = dt.timedelta(days=730)  # powdered formula lasts ~12-24 months; treat 24 as the outer limit

def hard_rules(p, r):
    """Returns (ok, reasons). Applies the date / status rules that both B and C use."""
    why = []
    if r['src'] == 'fda':
        if r['status'] == 'Terminated':
            return False, ['FDA status is Terminated (recall closed)']
        lo, hi = r['date'] - FORMULA_SHELF_LIFE, r['date'] + FORMULA_SHELF_LIFE
        if not (lo <= p['d'] <= hi):
            return False, [f"bought {p['date']}, outside recalled-stock shelf life around {r['date']}"]
        why.append(f"FDA recall {r['status']}, bought within shelf-life window")
    else:
        w = sale_window(r)
        if w:
            if not (w[0] <= p['d'] <= w[1]):
                return False, [f"bought {p['date']}, outside CPSC sale window {w[0]:%b %Y}-{w[1]:%b %Y}"]
            why.append(f"bought inside sale window {w[0]:%b %Y}-{w[1]:%b %Y}")
        elif p['d'] > r['date']:
            return False, ['bought after the recall date']
        # Seller rule: if the notice names where it was sold, with no catch-all ("other stores", "various", "including"),
        # and the purchase came from a store the notice never mentions, it is not the recalled unit.
        seller = SELLER_WORDS.get(p['source'])
        if seller and r['retail'] and not re.search(r'\bother\b|\bvarious\b|\bincluding\b', r['retail'], re.I):
            if not re.search(seller, r['retail'], re.I):
                return False, [f"notice says sold only at: {r['retail'][:80]}... ; bought at {p['source']}"]
            why.append(f"seller {p['source']} named in notice")
    return True, why

def join_b(p, r):
    """Brand + product-type join (the structured 'blocking' step). Plaid rows have no product, so never join."""
    if p['format'] == 'plaid':
        return None
    rb = recall_brands(r)
    pb = purchase_brand(p)
    if not (pb & rb) and not any(b in squash(p['text']) for b in rb if len(b) >= 5):
        return None
    rt, pt = ptypes(r['product']), ptypes(p['text'])
    if not rt or not pt or not (rt & pt):
        return None
    return {'brand': sorted(pb & rb) or sorted(b for b in rb if b in squash(p['text'])), 'type': sorted(rt & pt), 'rb': rb}

def strategy_b():
    out, considered = {}, []
    for p in purchases:
        for r in recalls:
            j = join_b(p, r)
            if not j:
                continue
            ok, why = hard_rules(p, r)
            ev = [f"brand={j['brand'][0]}", f"type={j['type'][0]}"] + why
            if ok:
                lw = line_words(r, j['rb']) if r['src'] == 'cpsc' else set()  # FDA descriptions are long paragraphs, not names
                if lw and not any(w in squash(p['text']) for w in lw):
                    ok, why = False, [f"product-line word missing ({', '.join(sorted(lw))})"]
            if ok:
                rs, ps = sizes(r['product']), sizes(p['text'])
                if rs and ps and not (rs & ps):
                    ok, why = False, [f"size conflict {sorted(ps)} vs recalled {sorted(rs)}"]
            if ok:
                rm, pm = models(r['desc']), models(p['text'])
                if pm and rm and not (pm & rm):
                    ok, why = False, [f"model conflict {sorted(pm)} vs recalled {sorted(rm)}"]
                elif pm & rm:
                    ev.append(f"model={sorted(pm & rm)[0]}")
            considered.append((p['id'], r['id'], ok, ev if ok else why))
            if ok:
                out[(p['id'], r['id'])] = '; '.join(ev)
    return out, considered

# ============================================================================= STRATEGY C: B join + AI evidence verifier
def strategy_c():
    out, considered = {}, []
    for p in purchases:
        for r in recalls:
            j = join_b(p, r)
            if not j:
                continue
            ok, why = hard_rules(p, r)
            if not ok:
                considered.append((p['id'], r['id'], False, why)); continue
            w = sale_window(r)
            recall_text = (f"Product name: {r['product']}\nTitle: {r['title']}\nDetails: {r['desc'][:700]}\n"
                           f"Sold: {r['retail'][:250]}")
            prompt = (
                'You check whether a family\'s purchase is the SAME product as a recalled product. Be strict: same brand AND same '
                'product (same product line/model, and the recalled variant if the notice limits it by size, colour or part). '
                'A different product from the same brand does NOT count. An accessory or part counts only if that part is what was recalled.\n'
                'Return JSON: {"same": true|false, "brand_purchase": "<exact words copied from PURCHASE>", "brand_recall": "<exact words copied from RECALL>", '
                '"product_purchase": "<exact words copied from PURCHASE naming the product line/type>", "product_recall": "<exact words copied from RECALL>", '
                '"conflict": "<any detail that contradicts the match, or empty>", "how_to_confirm": "<what the parent should check on the item, from the notice>"}\n'
                'Quotes must be copied character-for-character. If same is false, quotes may be empty.\n'
                f"PURCHASE: {p['text']}\nRECALL:\n{recall_text}")
            v = ask_json(prompt)
            if v is None:
                considered.append((p['id'], r['id'], False, ['no AI answer: rejected (fail safe)'])); continue
            def inside(q, txt): return bool(q) and norm(q) in norm(txt)
            quotes_ok = (inside(v.get('brand_purchase'), p['text']) and inside(v.get('brand_recall'), recall_text)
                         and inside(v.get('product_purchase'), p['text']) and inside(v.get('product_recall'), recall_text))
            if v.get('same') is True and quotes_ok and not (v.get('conflict') or '').strip():
                ev = f"brand '{v['brand_purchase']}'='{v['brand_recall']}'; product '{v['product_purchase']}'='{v['product_recall']}'; " + '; '.join(why)
                out[(p['id'], r['id'])] = ev + (f"; check: {v.get('how_to_confirm')}" if v.get('how_to_confirm') else '')
                considered.append((p['id'], r['id'], True, [ev]))
            else:
                reason = 'AI said different' if v.get('same') is not True else ('quote not found in source text' if not quotes_ok else f"conflict: {v.get('conflict')}")
                considered.append((p['id'], r['id'], False, [reason + (f" ({v.get('conflict')})" if v.get('conflict') and 'conflict' not in reason else '')]))
    return out, considered

# ============================================================================= scoring
truth = {(p['id'], rid) for p in purchases for rid in p['should_alert']}
def score(name, alerts):
    got = set(alerts)
    tp, fp, fn = got & truth, got - truth, truth - got
    prec = len(tp) / len(got) if got else float('nan')
    rec = len(tp) / len(truth) if truth else float('nan')
    return {'strategy': name, 'alerts': len(got), 'right': len(tp), 'wrong_alarms': sorted(fp), 'misses': sorted(fn),
            'precision': round(prec, 3), 'recall': round(rec, 3)}

def label(pid, rid):
    p = next(x for x in purchases if x['id'] == pid)
    return f"{pid} '{p['text'][:55]}' -> {rid} '{BY_ID[rid]['product'][:55]}'"

if __name__ == '__main__':
    results, details = [], {}
    a_off, net = strategy_a(with_ai=False)
    results.append(score('A0 net only (every candidate pair = alarm)', {k: 1 for k in net}))
    results.append(score('A1 current rule, offline (exact name only)', a_off))
    if USE_AI:
        a_ai, _ = strategy_a(with_ai=True)
        results.append(score(f'A2 current rule + its AI yes/no check (25-pair cap; {strategy_a.cut} loose pairs never judged)', a_ai)); details['A2'] = a_ai
        a_unc, _ = strategy_a(with_ai=True, cap=10**6) if '--uncapped' in sys.argv else (None, None)
        if a_unc is not None: results.append(score('A3 current rule + AI, no cap', a_unc))
    b, b_cons = strategy_b()
    results.append(score('B structured fields + rules (no AI)', b)); details['B'] = b
    if USE_AI:
        c, c_cons = strategy_c()
        results.append(score('C structured join + AI evidence verifier', c)); details['C'] = c
    print(f"purchases={len(purchases)}  recalls checked={len(recalls)} product rows  true matches={len(truth)}  candidate pairs from today's net={len(net)}")
    print('AI calls:', AI_CALLS)
    for r in results:
        print(f"\n== {r['strategy']}: alerts {r['alerts']}, right {r['right']}, precision {r['precision']}, recall {r['recall']}")
        for k in r['wrong_alarms']: print('   WRONG ALARM', label(*k))
        for k in r['misses']: print('   MISS       ', label(*k))
    print('\n-- B decisions (every pair that passed the brand+type join):')
    for pid, rid, ok, why in b_cons: print('  ', 'ALERT ' if ok else 'reject', label(pid, rid), '|', '; '.join(why))
    if USE_AI:
        print('\n-- C decisions:')
        for pid, rid, ok, why in c_cons: print('  ', 'ALERT ' if ok else 'reject', label(pid, rid), '|', '; '.join(why)[:300])
    out = {'run_at': dt.datetime.now().isoformat(timespec='seconds'), 'purchase_file': PURCHASE_FILE.name, 'ai_calls': AI_CALLS,
           'results': results, 'net_pairs': [label(*k) for k in net],
           'b_decisions': [(label(p, r), ok, why) for p, r, ok, why in b_cons]}
    if USE_AI:
        out['c_decisions'] = [(label(p, r), ok, why) for p, r, ok, why in c_cons]
    (DATA / f"results_{PURCHASE_FILE.stem}.json").write_text(json.dumps(out, indent=1, default=str))
