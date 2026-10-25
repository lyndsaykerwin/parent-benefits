// "How we got this number" labels must match what the agents really ask Zetaris. These tests tie the screen's matchers to the
// real SQL text in the server files (read from disk), so if a query is reworded the labels fail loudly instead of going blank.
import fs from 'fs';
import path from 'path';
import type { FeedCard } from '@shared/bundle';
import type { TraceLine } from '../bundle';
import { zetarisForCard } from '../howWeChecked';

const server = (f: string) => fs.readFileSync(path.join(__dirname, '../../../../server/agents', f), 'utf8');

const card = (id: string, kind: FeedCard['kind']): FeedCard => ({ id, kind, title: id, body: '', amountCents: null, deadline: null, verdict: 'verified', sources: [], traceId: '' });
let n = 0;
const z = (sql: string): TraceLine => ({ timestamp: '2026-10-23T00:00:00Z', trace_id: `z${n++}`, agent_name: 'zetaris', action: 'query_cached', input_summary: sql, output_summary: '1 rows (sample cache)', target_agent: null, confidence: null, retry_count: 0, status: 'ok' });

describe('the Fact-Checker queries the labels depend on are still in the server', () => {
  const fc = server('factChecker.ts');
  it('money-back (FSA) is re-read as "v_purchase_items WHERE id = N"', () => {
    expect(fc).toContain('FROM bundle_pg.v_purchase_items WHERE id = ${quoteInt(claim.itemId)} AND family_id');
  });
  it('price-drop is re-read as "v_purchase_items p JOIN ... WHERE p.id = N"', () => {
    expect(fc).toContain("'FROM bundle_pg.v_purchase_items p '");
    expect(fc).toContain('`WHERE p.id = ${quoteInt(claim.itemId)} AND p.family_id');
  });
  it('money-back queries read purchase_items only through v_purchase_items (no bank views)', () => {
    for (const f of ['clawback.ts', 'recall.ts', 'factChecker.ts']) {
      const src = server(f);
      expect(src).toContain('v_purchase_items');
      expect(src).not.toMatch(/v_clawback_tx|v_recall_orders/);
    }
  });
});

describe('a money-back card is tied to the queries that built it', () => {
  // The same statements the server sends, with an item id filled in.
  const fsaVerify = "SELECT price_cents AS amount_cents, family_id FROM bundle_pg.v_purchase_items WHERE id = 4 AND family_id = 'maya'";
  const priceVerify = "SELECT p.price_cents AS amount_cents, p.purchased_on AS tx_date FROM bundle_pg.v_purchase_items p JOIN bundle_pg.store_policies sp ON lower(sp.store) = lower(COALESCE(p.store, p.seller)) JOIN bundle_pg.price_observations po ON lower(po.store) = lower(sp.store) WHERE p.id = 5 AND p.family_id = 'maya'";
  const fsaMain = "SELECT DISTINCT p.id AS item_id FROM bundle_pg.v_purchase_items p JOIN bundle_pg.fsa_eligible_categories c ON c.account IN ('FSA', 'HSA') WHERE p.family_id = 'maya'";
  const priceMain = "SELECT p.id AS item_id FROM bundle_pg.v_purchase_items p JOIN bundle_pg.store_policies sp ON 1=1 JOIN bundle_pg.price_observations po ON 1=1 WHERE p.family_id = 'maya' AND po.price_cents < p.price_cents ORDER BY p.purchased_on, p.id";
  const otherItem = "SELECT p.price_cents FROM bundle_pg.v_purchase_items p JOIN bundle_pg.store_policies sp ON 1=1 JOIN bundle_pg.price_observations po ON 1=1 WHERE p.id = 55 AND p.family_id = 'maya'";
  const lines = [z(fsaVerify), z(priceVerify), z(fsaMain), z(priceMain), z(otherItem)];

  it('FSA card: its own check plus the FSA list, with plain-English sources', () => {
    const v = zetarisForCard(card('clawback-fsa-4', 'clawback'), lines)!;
    expect(v.queries).toBe(2);
    expect(v.sources).toEqual(expect.arrayContaining(['Your purchases (private, Neon)', 'FSA eligibility list']));
    expect(v.sql.join(' ')).not.toMatch(/maya/);
  });
  it('price-drop card: its own check (by "p.id") plus the price query, and never another item\'s check', () => {
    const v = zetarisForCard(card('clawback-price-5', 'clawback'), lines)!;
    expect(v.queries).toBe(2); // verification for item 5 + the run-wide price query, not item 55
    expect(v.sources).toEqual(expect.arrayContaining(['Your purchases (private, Neon)', 'Store price-adjustment policies', 'Observed prices']));
  });
  it('does not mix up item 5 with item 55', () => {
    const only55 = zetarisForCard(card('clawback-price-5', 'clawback'), [z(otherItem)]);
    expect(only55).toBeNull();
  });
});
