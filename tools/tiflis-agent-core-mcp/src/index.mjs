#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const VERSION = '0.1.0';
const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(sourceDir, '../../..');
const mode = (process.argv[2] || process.env.TIFLIS_AGENT_MODE || 'brain').toLowerCase();
const MAX_TEXT = 8_000;
const MAX_RECORDS = 500;

function resolveDataPath(envName, fallbackName) {
  const configured = process.env[envName]?.trim();
  if (!configured) return path.join(repoRoot, '.agent-data', fallbackName);
  return path.isAbsolute(configured) ? configured : path.resolve(repoRoot, configured);
}

const brainFile = resolveDataPath('TIFLIS_BRAIN_FILE', 'tiflis-brain.json');
const memoryFile = resolveDataPath('TIFLIS_MEMORY_FILE', 'tiflis-memory.json');
const stringArray = z.array(z.string().max(2_000)).max(100).optional().default([]);

function now() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}_${new Date().toISOString().slice(0, 10).replaceAll('-', '')}_${crypto.randomBytes(5).toString('hex')}`;
}

function redactSecrets(value) {
  if (typeof value !== 'string') return value;
  let output = value.slice(0, MAX_TEXT);
  const patterns = [
    /\b(?:sk|fc|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_\-]{8,}\b/g,
    /((?:authorization\s*[:=]\s*bearer)\s+)[^\s,;]+/gi,
    /((?:password|passwd|secret|token|api[_-]?key)\s*[:=]\s*)[^\s,;]+/gi,
  ];
  for (const pattern of patterns) output = output.replace(pattern, '$1[REDACTED]');
  return output.trim();
}

function sanitize(value) {
  if (typeof value === 'string') return redactSecrets(value);
  if (Array.isArray(value)) return value.slice(0, 100).map(sanitize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitize(item)]));
  }
  return value;
}

async function readStore(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : structuredClone(fallback);
  } catch (error) {
    if (error?.code === 'ENOENT') return structuredClone(fallback);
    throw error;
  }
}

async function writeStore(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  await fs.rename(tempPath, filePath);
}

function textResult(payload) {
  return {
    content: [{ type: 'text', text: typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2) }],
  };
}

function errorResult(error) {
  return {
    isError: true,
    content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
  };
}

function tokenize(value) {
  return new Set(
    String(value || '')
      .toLocaleLowerCase('uk-UA')
      .replace(/[^\p{L}\p{N}_-]+/gu, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 1),
  );
}

function overlapScore(queryTokens, value) {
  if (!queryTokens.size) return 0;
  const valueTokens = tokenize(value);
  let matches = 0;
  for (const token of queryTokens) if (valueTokens.has(token)) matches += 1;
  return matches / queryTokens.size;
}

function createBrainServer() {
  const server = new McpServer({ name: 'tiflis-brain-mcp', version: VERSION });
  const emptyStore = { version: 1, sessions: [] };

  server.registerTool(
    'brain_start',
    {
      description: 'Start a structured Tiflis decision session. Store concise, shareable planning notes only—not private chain-of-thought.',
      inputSchema: z.object({
        goal: z.string().min(3).max(MAX_TEXT),
        scope: z.string().max(1_000).optional().default('Tiflis project'),
        constraints: stringArray,
        expectedSteps: z.number().int().min(1).max(50).optional().default(5),
        tags: z.array(z.string().max(80)).max(30).optional().default([]),
      }),
    },
    async (input) => {
      try {
        const store = await readStore(brainFile, emptyStore);
        const session = sanitize({
          id: makeId('brain'),
          goal: input.goal,
          scope: input.scope,
          constraints: input.constraints,
          expectedSteps: input.expectedSteps,
          tags: input.tags,
          status: 'open',
          createdAt: now(),
          updatedAt: now(),
          steps: [],
          conclusion: null,
        });
        store.sessions.unshift(session);
        store.sessions = store.sessions.slice(0, MAX_RECORDS);
        await writeStore(brainFile, store);
        return textResult({
          sessionId: session.id,
          status: session.status,
          expectedSteps: session.expectedSteps,
          reminder: 'Record decisions, evidence, risks, alternatives, and revisions. Never store credentials or hidden scratchpad.',
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'brain_step',
    {
      description: 'Append a concise hypothesis, evidence note, risk, decision, branch, validation, or revision to an open session.',
      inputSchema: z.object({
        sessionId: z.string().min(3),
        summary: z.string().min(2).max(MAX_TEXT),
        kind: z.enum(['hypothesis', 'evidence', 'risk', 'decision', 'revision', 'validation']).optional().default('hypothesis'),
        nextStepNeeded: z.boolean(),
        totalSteps: z.number().int().min(1).max(100).optional(),
        confidence: z.number().min(0).max(1).optional(),
        evidence: stringArray,
        risks: stringArray,
        nextAction: z.string().max(2_000).optional(),
        branchId: z.string().max(120).optional().default('main'),
        branchFromStep: z.number().int().min(1).optional(),
        revisesStep: z.number().int().min(1).optional(),
      }),
    },
    async (input) => {
      try {
        const store = await readStore(brainFile, emptyStore);
        const session = store.sessions.find((item) => item.id === input.sessionId);
        if (!session) throw new Error(`Brain session not found: ${input.sessionId}`);
        if (session.status !== 'open') throw new Error(`Brain session is ${session.status}; start a new session or review it.`);

        const stepNumber = session.steps.length + 1;
        if (input.revisesStep && !session.steps.some((step) => step.stepNumber === input.revisesStep)) {
          throw new Error(`Cannot revise missing step ${input.revisesStep}.`);
        }
        if (input.branchFromStep && !session.steps.some((step) => step.stepNumber === input.branchFromStep)) {
          throw new Error(`Cannot branch from missing step ${input.branchFromStep}.`);
        }

        const step = sanitize({
          stepNumber,
          totalSteps: Math.max(input.totalSteps || session.expectedSteps || stepNumber, stepNumber),
          kind: input.kind,
          summary: input.summary,
          confidence: input.confidence ?? null,
          evidence: input.evidence,
          risks: input.risks,
          nextAction: input.nextAction || null,
          nextStepNeeded: input.nextStepNeeded,
          branchId: input.branchId || 'main',
          branchFromStep: input.branchFromStep || null,
          revisesStep: input.revisesStep || null,
          createdAt: now(),
        });
        session.steps.push(step);
        session.expectedSteps = Math.max(session.expectedSteps || 1, step.totalSteps);
        session.updatedAt = now();
        await writeStore(brainFile, store);

        return textResult({
          sessionId: session.id,
          stepNumber,
          totalSteps: step.totalSteps,
          nextStepNeeded: step.nextStepNeeded,
          recordedKind: step.kind,
          branches: [...new Set(session.steps.map((item) => item.branchId))],
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'brain_review',
    {
      description: 'Review a decision session, including branches, revisions, unresolved risks, and the next verifiable action.',
      inputSchema: z.object({
        sessionId: z.string().min(3),
        includeSteps: z.boolean().optional().default(true),
      }),
    },
    async ({ sessionId, includeSteps }) => {
      try {
        const store = await readStore(brainFile, emptyStore);
        const session = store.sessions.find((item) => item.id === sessionId);
        if (!session) throw new Error(`Brain session not found: ${sessionId}`);
        const decisions = session.steps.filter((step) => step.kind === 'decision' || step.kind === 'revision');
        const unresolvedRisks = [...new Set(session.steps.flatMap((step) => step.risks || []))];
        const nextAction = [...session.steps].reverse().find((step) => step.nextAction)?.nextAction || null;
        return textResult({
          id: session.id,
          goal: session.goal,
          scope: session.scope,
          status: session.status,
          constraints: session.constraints,
          branches: [...new Set(session.steps.map((step) => step.branchId))],
          decisions,
          unresolvedRisks,
          nextAction,
          conclusion: session.conclusion,
          steps: includeSteps ? session.steps : undefined,
          updatedAt: session.updatedAt,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'brain_close',
    {
      description: 'Close a decision session with an outcome, validation evidence, remaining risks, and an optional rollback plan.',
      inputSchema: z.object({
        sessionId: z.string().min(3),
        outcome: z.string().min(2).max(MAX_TEXT),
        validation: stringArray,
        remainingRisks: stringArray,
        rollback: z.string().max(3_000).optional(),
      }),
    },
    async (input) => {
      try {
        const store = await readStore(brainFile, emptyStore);
        const session = store.sessions.find((item) => item.id === input.sessionId);
        if (!session) throw new Error(`Brain session not found: ${input.sessionId}`);
        session.status = 'closed';
        session.updatedAt = now();
        session.conclusion = sanitize({
          outcome: input.outcome,
          validation: input.validation,
          remainingRisks: input.remainingRisks,
          rollback: input.rollback || null,
          closedAt: now(),
        });
        await writeStore(brainFile, store);
        return textResult({ sessionId: session.id, status: session.status, conclusion: session.conclusion });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'brain_list',
    {
      description: 'List recent structured decision sessions without expanding every step.',
      inputSchema: z.object({
        status: z.enum(['all', 'open', 'closed']).optional().default('all'),
        limit: z.number().int().min(1).max(100).optional().default(20),
      }),
    },
    async ({ status, limit }) => {
      try {
        const store = await readStore(brainFile, emptyStore);
        const sessions = store.sessions
          .filter((session) => status === 'all' || session.status === status)
          .slice(0, limit)
          .map((session) => ({
            id: session.id,
            goal: session.goal,
            scope: session.scope,
            status: session.status,
            stepCount: session.steps.length,
            tags: session.tags,
            updatedAt: session.updatedAt,
          }));
        return textResult({ sessions });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
}

function createMemoryServer() {
  const server = new McpServer({ name: 'tiflis-memory-mcp', version: VERSION });
  const emptyStore = { version: 1, entities: [], relations: [], decisions: [], bugs: [] };

  server.registerTool(
    'memory_upsert_entities',
    {
      description: 'Create or update project knowledge-graph entities with atomic observations and tags.',
      inputSchema: z.object({
        entities: z.array(z.object({
          name: z.string().min(1).max(240),
          entityType: z.string().min(1).max(120),
          observations: stringArray,
          tags: z.array(z.string().max(80)).max(30).optional().default([]),
        })).min(1).max(100),
      }),
    },
    async ({ entities }) => {
      try {
        const store = await readStore(memoryFile, emptyStore);
        const changed = [];
        for (const raw of entities) {
          const input = sanitize(raw);
          let entity = store.entities.find((item) => item.name === input.name);
          if (!entity) {
            entity = { ...input, createdAt: now(), updatedAt: now() };
            store.entities.push(entity);
          } else {
            entity.entityType = input.entityType || entity.entityType;
            entity.observations = [...new Set([...(entity.observations || []), ...input.observations])];
            entity.tags = [...new Set([...(entity.tags || []), ...input.tags])];
            entity.updatedAt = now();
          }
          changed.push(entity.name);
        }
        await writeStore(memoryFile, store);
        return textResult({ upserted: changed });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'memory_create_relations',
    {
      description: 'Create directed active-voice relations between existing project entities.',
      inputSchema: z.object({
        relations: z.array(z.object({
          from: z.string().min(1).max(240),
          to: z.string().min(1).max(240),
          relationType: z.string().min(1).max(160),
        })).min(1).max(200),
      }),
    },
    async ({ relations }) => {
      try {
        const store = await readStore(memoryFile, emptyStore);
        const entityNames = new Set(store.entities.map((entity) => entity.name));
        const created = [];
        for (const raw of relations) {
          const relation = sanitize(raw);
          if (!entityNames.has(relation.from) || !entityNames.has(relation.to)) {
            throw new Error(`Relation endpoints must exist first: ${relation.from} -> ${relation.to}`);
          }
          const duplicate = store.relations.some((item) => item.from === relation.from && item.to === relation.to && item.relationType === relation.relationType);
          if (!duplicate) {
            store.relations.push({ ...relation, createdAt: now() });
            created.push(relation);
          }
        }
        await writeStore(memoryFile, store);
        return textResult({ created });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'memory_add_observations',
    {
      description: 'Add deduplicated atomic observations to existing entities.',
      inputSchema: z.object({
        updates: z.array(z.object({
          entityName: z.string().min(1).max(240),
          observations: z.array(z.string().min(1).max(2_000)).min(1).max(100),
        })).min(1).max(100),
      }),
    },
    async ({ updates }) => {
      try {
        const store = await readStore(memoryFile, emptyStore);
        const result = [];
        for (const update of updates) {
          const entity = store.entities.find((item) => item.name === update.entityName);
          if (!entity) throw new Error(`Entity not found: ${update.entityName}`);
          const observations = sanitize(update.observations);
          const before = new Set(entity.observations || []);
          const added = observations.filter((item) => !before.has(item));
          entity.observations = [...before, ...added];
          entity.updatedAt = now();
          result.push({ entityName: entity.name, added });
        }
        await writeStore(memoryFile, store);
        return textResult({ updates: result });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'memory_remember_decision',
    {
      description: 'Store a durable architecture or product decision with concise rationale, files, validation, and supersession links.',
      inputSchema: z.object({
        title: z.string().min(2).max(300),
        status: z.enum(['accepted', 'experimental', 'superseded', 'rejected']).optional().default('accepted'),
        rationale: z.string().min(2).max(MAX_TEXT),
        alternatives: stringArray,
        affectedFiles: z.array(z.string().max(500)).max(200).optional().default([]),
        validation: stringArray,
        supersedes: z.array(z.string().max(160)).max(30).optional().default([]),
        tags: z.array(z.string().max(80)).max(30).optional().default([]),
      }),
    },
    async (input) => {
      try {
        const store = await readStore(memoryFile, emptyStore);
        const decision = sanitize({ id: makeId('decision'), ...input, createdAt: now(), updatedAt: now() });
        store.decisions.unshift(decision);
        store.decisions = store.decisions.slice(0, MAX_RECORDS);
        await writeStore(memoryFile, store);
        return textResult({ decisionId: decision.id, status: decision.status, title: decision.title });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'memory_remember_bug',
    {
      description: 'Store a reproducible bug record with symptom, cause, fix, affected files, and regression checks.',
      inputSchema: z.object({
        title: z.string().min(2).max(300),
        symptom: z.string().min(2).max(MAX_TEXT),
        cause: z.string().min(2).max(MAX_TEXT),
        fix: z.string().min(2).max(MAX_TEXT),
        affectedFiles: z.array(z.string().max(500)).max(200).optional().default([]),
        regressionTests: stringArray,
        status: z.enum(['fixed', 'monitoring', 'open', 'wont-fix']).optional().default('fixed'),
        tags: z.array(z.string().max(80)).max(30).optional().default([]),
      }),
    },
    async (input) => {
      try {
        const store = await readStore(memoryFile, emptyStore);
        const bug = sanitize({ id: makeId('bug'), ...input, createdAt: now(), updatedAt: now() });
        store.bugs.unshift(bug);
        store.bugs = store.bugs.slice(0, MAX_RECORDS);
        await writeStore(memoryFile, store);
        return textResult({ bugId: bug.id, status: bug.status, title: bug.title });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'memory_search',
    {
      description: 'Search entities, decisions, and bugs by natural-language token overlap.',
      inputSchema: z.object({
        query: z.string().min(1).max(2_000),
        kinds: z.array(z.enum(['entity', 'decision', 'bug'])).max(3).optional().default(['entity', 'decision', 'bug']),
        limit: z.number().int().min(1).max(100).optional().default(20),
      }),
    },
    async ({ query, kinds, limit }) => {
      try {
        const store = await readStore(memoryFile, emptyStore);
        const queryTokens = tokenize(query);
        const results = [];
        if (kinds.includes('entity')) {
          for (const entity of store.entities) {
            const score = overlapScore(queryTokens, [entity.name, entity.entityType, ...(entity.observations || []), ...(entity.tags || [])].join(' '));
            if (score > 0) results.push({ kind: 'entity', score, item: entity });
          }
        }
        if (kinds.includes('decision')) {
          for (const decision of store.decisions) {
            const score = overlapScore(queryTokens, [decision.title, decision.rationale, ...(decision.alternatives || []), ...(decision.affectedFiles || []), ...(decision.tags || [])].join(' '));
            if (score > 0) results.push({ kind: 'decision', score, item: decision });
          }
        }
        if (kinds.includes('bug')) {
          for (const bug of store.bugs) {
            const score = overlapScore(queryTokens, [bug.title, bug.symptom, bug.cause, bug.fix, ...(bug.affectedFiles || []), ...(bug.tags || [])].join(' '));
            if (score > 0) results.push({ kind: 'bug', score, item: bug });
          }
        }
        results.sort((left, right) => right.score - left.score || String(right.item.updatedAt || right.item.createdAt).localeCompare(String(left.item.updatedAt || left.item.createdAt)));
        return textResult({ query, results: results.slice(0, limit) });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'memory_context',
    {
      description: 'Retrieve a compact project context pack for a task before code or UI work starts.',
      inputSchema: z.object({
        task: z.string().min(2).max(2_000),
        limitPerKind: z.number().int().min(1).max(30).optional().default(8),
      }),
    },
    async ({ task, limitPerKind }) => {
      try {
        const store = await readStore(memoryFile, emptyStore);
        const queryTokens = tokenize(task);
        const rank = (items, text) => items
          .map((item) => ({ item, score: overlapScore(queryTokens, text(item)) }))
          .filter((entry) => entry.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, limitPerKind)
          .map((entry) => entry.item);

        const entities = rank(store.entities, (item) => [item.name, item.entityType, ...(item.observations || []), ...(item.tags || [])].join(' '));
        const decisions = rank(store.decisions, (item) => [item.title, item.rationale, ...(item.affectedFiles || []), ...(item.tags || [])].join(' '));
        const bugs = rank(store.bugs, (item) => [item.title, item.symptom, item.cause, item.fix, ...(item.affectedFiles || []), ...(item.tags || [])].join(' '));
        const selectedNames = new Set(entities.map((entity) => entity.name));
        const relations = store.relations.filter((relation) => selectedNames.has(relation.from) || selectedNames.has(relation.to));
        return textResult({ task, entities, relations, decisions, bugs });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'memory_open_nodes',
    {
      description: 'Open specific entities and the relations touching them.',
      inputSchema: z.object({ names: z.array(z.string().min(1).max(240)).min(1).max(100) }),
    },
    async ({ names }) => {
      try {
        const store = await readStore(memoryFile, emptyStore);
        const wanted = new Set(names);
        return textResult({
          entities: store.entities.filter((entity) => wanted.has(entity.name)),
          relations: store.relations.filter((relation) => wanted.has(relation.from) || wanted.has(relation.to)),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    'memory_stats',
    {
      description: 'Return memory-store counts and local file path without exposing stored content.',
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const store = await readStore(memoryFile, emptyStore);
        return textResult({
          entities: store.entities.length,
          relations: store.relations.length,
          decisions: store.decisions.length,
          bugs: store.bugs.length,
          file: memoryFile,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
}

async function main() {
  if (!['brain', 'memory'].includes(mode)) {
    throw new Error(`Unknown TIFLIS_AGENT_MODE '${mode}'. Use 'brain' or 'memory'.`);
  }
  const server = mode === 'brain' ? createBrainServer() : createMemoryServer();
  await server.connect(new StdioServerTransport());
  console.error(`${mode === 'brain' ? 'Tiflis Brain MCP' : 'Tiflis Memory MCP'} running on stdio.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
