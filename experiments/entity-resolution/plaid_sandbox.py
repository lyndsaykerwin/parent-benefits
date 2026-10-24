"""Pull REAL Plaid-format transactions from Plaid's sandbox (practice mode, fake bank).
Uses the custom sandbox user (user_custom) to inject baby-store purchases.
Secrets are read from .secrets/bundle.env.local and never printed. Only talks to sandbox.plaid.com."""
import json, time, urllib.request, pathlib
HERE = pathlib.Path(__file__).parent
ENV = {}
for line in (HERE / '../../.secrets/bundle.env.local').read_text().splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        k, v = line.split('=', 1); ENV[k.strip()] = v.strip().strip('"').strip("'")
assert ENV.get('PLAID_ENV') == 'sandbox'
BASE = 'https://sandbox.plaid.com'
def call(path, body):
    body = {'client_id': ENV['PLAID_CLIENT_ID'], 'secret': ENV['PLAID_SECRET'], **body}
    req = urllib.request.Request(BASE + path, json.dumps(body).encode(), {'Content-Type': 'application/json'})
    try:
        return json.load(urllib.request.urlopen(req, timeout=60))
    except urllib.error.HTTPError as e:
        err = json.load(e); err.pop('request_id', None); raise SystemExit(f'{path} failed: {err}')

# Descriptions written the way card statements really look (store + reference code, no product).
TX = [
  ('2026-09-02', 89.99, 'AMAZON MKTPL*2K4RT81Q3 Amzn.com/bill WA'),
  ('2026-09-03', 249.99, 'TARGET 00012345 BOSTON MA'),
  ('2026-09-05', 34.97, 'WAL-MART #2149 DORCHESTER MA'),
  ('2026-09-07', 159.99, 'BUYBUY BABY #1027 NATICK MA'),
  ('2026-09-09', 299.99, 'GRACO CHILDRENS PRODUCTS ATLANTA GA'),
  ('2026-09-10', 42.99, 'SQ *SIMILAC STORE'),
  ('2026-09-12', 129.00, 'AMZN Mktp US*RT5YH22K0'),
  ('2026-09-14', 1850.00, 'BRIGHT HORIZONS TUITION ACH'),
  ('2026-09-15', 64.12, 'CVS/PHARMACY #01234 BOSTON MA'),
  ('2026-09-18', 23.48, 'TARGET.COM * 800-591-3869 MN'),
]
cfg = {'seed': 'bundle-er-test', 'override_accounts': [{
    'type': 'credit', 'subtype': 'credit card', 'starting_balance': 0,
    'transactions': [{'date_transacted': d, 'date_posted': d, 'amount': a, 'description': desc, 'currency': 'USD'} for d, a, desc in TX]}]}
pt = call('/sandbox/public_token/create', {'institution_id': 'ins_109508', 'initial_products': ['transactions'],
     'options': {'override_username': 'user_custom', 'override_password': json.dumps(cfg)}})
at = call('/item/public_token/exchange', {'public_token': pt['public_token']})['access_token']
added, cursor = [], None
for attempt in range(12):
    body = {'access_token': at, 'count': 500, 'options': {'include_original_description': True}}
    if cursor: body['cursor'] = cursor
    r = call('/transactions/sync', body)
    added += r['added']; cursor = r['next_cursor']
    if r['has_more']: continue
    if added: break
    time.sleep(5)
call('/item/remove', {'access_token': at})  # tidy up the practice item
out = HERE / 'data' / 'plaid_sandbox_transactions.json'
out.write_text(json.dumps(added, indent=2))
print(len(added), 'transactions saved to', out)
for t in added:
    pfc = t.get('personal_finance_category') or {}
    print(t['date'], t['amount'], '|', t['name'], '| merchant:', t.get('merchant_name'), '|', pfc.get('primary'), '/', pfc.get('detailed'), '| site:', t.get('website'))
