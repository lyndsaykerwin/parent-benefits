import type { Family, FeedCard } from '../../shared/bundle';
import type { ZetarisClient } from '../adapters/zetaris';
import type { Generator } from '../adapters/llm';
import type { BundleMemory } from '../adapters/memory';
import type { TraceLogger } from './trace';

export interface CourtRuling {
  verdict: 'approve' | 'reject';
  citedRuleIds: string[];
  reason: string;
}

export interface AgentContext {
  runId: string;
  family: Family;
  z: ZetarisClient;
  llm: Generator;
  memory: BundleMemory;
  trace: TraceLogger;
}

export interface Candidate extends FeedCard {
  agent: string;
  claim: Record<string, string | number>;
  evidenceSql: string;
  retryCount: number;
}
