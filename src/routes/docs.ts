import type { FastifyInstance } from "fastify";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PROTOCOL } from "../config.js";

const OPENAPI_PATH = resolve(import.meta.dirname ?? ".", "../../spec/openapi.yaml");

export async function docsRoutes(app: FastifyInstance) {
  app.get("/docs", async () => {
    return {
      protocol: "MEMEX v0",
      base_url: "/api/v0",
      authentication: {
        type: "Bearer token",
        header: "Authorization: Bearer <your-agent-id>",
        note: "agent_id is auto-registered on first use",
      },
      getting_started: [
        "1. POST /api/v0/faucet/claim — claim 1 MEMEX starter tokens",
        "2. POST /api/v0/vectors — store a vector (costs 0.01 MEMEX)",
        "3. POST /api/v0/vectors/search — similarity search (costs 0.0001 MEMEX)",
        "4. POST /api/v0/tasks — submit compute task (costs 0.01 MEMEX)",
        "5. POST /api/v0/staking/stake — stake MEMEX to become a validator",
        "6. POST /api/v0/governance/proposals — propose parameter changes",
      ],
      memory_spaces: {
        description: "MEMEX supports private and public memory spaces.",
        public: 'Any space name NOT starting with "private:" (e.g. "world", "knowledge"). All agents can read/write/search.',
        private: 'Space name format "private:<agent_id>" (e.g. "private:my-agent"). Only the owner can read/write/search. 403 if another agent tries to access.',
      },
      endpoints: {
        vectors: {
          "POST /vectors": { fee: PROTOCOL.FEES.VECTORS_STORE, description: "Store a vector embedding" },
          "GET /vectors/:id": { fee: 0, description: "Get vector metadata" },
          "POST /vectors/search": { fee: PROTOCOL.FEES.VECTORS_SEARCH, description: "Cosine similarity search" },
        },
        tasks: {
          "POST /tasks": { fee: PROTOCOL.FEES.TASKS, description: "Submit sandboxed compute task" },
          "GET /tasks/:id": { fee: 0, description: "Get task status and result" },
        },
        wallet: {
          "GET /wallet/balance": { fee: 0, description: "Get MEMEX balance" },
          "POST /wallet/transfer": { fee: 0, description: "Transfer MEMEX between agents" },
        },
        staking: {
          "POST /staking/stake": { fee: 0, description: "Stake MEMEX to become validator" },
          "POST /staking/unstake": { fee: 0, description: "Unstake MEMEX" },
          "GET /staking/status": { fee: 0, description: "Query staking status" },
        },
        acquisition: {
          "POST /faucet/claim": { fee: 0, description: "Claim starter MEMEX (one-time)" },
          "POST /missions/claim": { fee: 0, description: "Claim mission reward" },
        },
        governance: {
          "POST /governance/proposals": { fee: 0, description: "Create governance proposal (min stake 10)" },
          "GET /governance/proposals": { fee: 0, description: "List all proposals" },
          "POST /governance/proposals/:id/vote": { fee: 0, description: "Vote on proposal" },
        },
        system: {
          "GET /config": { fee: 0, description: "Current protocol config" },
          "GET /node/status": { fee: 0, description: "Node health and status" },
          "GET /peers": { fee: 0, description: "Connected peers" },
        },
      },
      token_economics: {
        max_supply: PROTOCOL.MAX_SUPPLY,
        allocation: {
          reward_pool: `${PROTOCOL.ALLOCATION.REWARD_POOL * 100}%`,
          ecosystem: `${PROTOCOL.ALLOCATION.ECOSYSTEM * 100}%`,
          treasury: `${PROTOCOL.ALLOCATION.TREASURY * 100}%`,
        },
        fee_split: {
          validators: `${PROTOCOL.FEE_SPLIT.VALIDATORS * 100}%`,
          contributors: `${PROTOCOL.FEE_SPLIT.CONTRIBUTORS * 100}%`,
          treasury: `${PROTOCOL.FEE_SPLIT.TREASURY * 100}%`,
        },
      },
      staking: {
        min_stake_for_validator: PROTOCOL.STAKING.MIN_STAKE,
        slash_malicious: `${PROTOCOL.STAKING.SLASH_MALICIOUS * 100}%`,
        slash_bad_submission: `${PROTOCOL.STAKING.SLASH_BAD_SUBMISSION * 100}%`,
      },
      governance: {
        min_stake_to_propose: PROTOCOL.GOVERNANCE.MIN_STAKE_TO_PROPOSE,
        quorum: `${PROTOCOL.GOVERNANCE.QUORUM_RATIO * 100}%`,
        pass_ratio: `${PROTOCOL.GOVERNANCE.PASS_RATIO * 100}%`,
      },
      more: {
        openapi_spec: "GET /docs/openapi",
        curl_examples: "GET /docs/examples",
      },
    };
  });

  app.get("/docs/openapi", async (_request, reply) => {
    try {
      const yaml = readFileSync(OPENAPI_PATH, "utf-8");
      return reply.type("text/yaml").send(yaml);
    } catch {
      return reply.status(404).send({ error: { code: "NOT_FOUND", message: "openapi.yaml not found" } });
    }
  });

  app.get("/docs/examples", async () => {
    const base = "http://localhost:3000/api/v0";
    return {
      note: "Replace YOUR_AGENT_ID with your agent identifier",
      examples: [
        {
          step: 1,
          name: "Claim starter tokens",
          curl: `curl -X POST ${base}/faucet/claim -H "Content-Type: application/json" -d '{"agent_id":"YOUR_AGENT_ID"}'`,
        },
        {
          step: 2,
          name: "Check balance",
          curl: `curl -H "Authorization: Bearer YOUR_AGENT_ID" "${base}/wallet/balance?agent_id=YOUR_AGENT_ID"`,
        },
        {
          step: 3,
          name: "Store a public vector (world memory)",
          curl: `curl -X POST ${base}/vectors -H "Authorization: Bearer YOUR_AGENT_ID" -H "Content-Type: application/json" -d '{"space":"world","dim":3,"vector":[0.1,0.2,0.3],"tags":["knowledge"]}'`,
        },
        {
          step: 4,
          name: "Store a private vector (only you can access)",
          curl: `curl -X POST ${base}/vectors -H "Authorization: Bearer YOUR_AGENT_ID" -H "Content-Type: application/json" -d '{"space":"private:YOUR_AGENT_ID","dim":3,"vector":[0.1,0.2,0.3],"tags":["diary"]}'`,
        },
        {
          step: 5,
          name: "Search public vectors",
          curl: `curl -X POST ${base}/vectors/search -H "Authorization: Bearer YOUR_AGENT_ID" -H "Content-Type: application/json" -d '{"space":"world","query_vector":[0.1,0.2,0.3],"top_k":5}'`,
        },
        {
          step: 6,
          name: "Search your private vectors",
          curl: `curl -X POST ${base}/vectors/search -H "Authorization: Bearer YOUR_AGENT_ID" -H "Content-Type: application/json" -d '{"space":"private:YOUR_AGENT_ID","query_vector":[0.1,0.2,0.3],"top_k":5}'`,
        },
        {
          step: 7,
          name: "Stake MEMEX to become validator",
          curl: `curl -X POST ${base}/staking/stake -H "Authorization: Bearer YOUR_AGENT_ID" -H "Content-Type: application/json" -d '{"amount":10}'`,
        },
        {
          step: 8,
          name: "Check staking status",
          curl: `curl -H "Authorization: Bearer YOUR_AGENT_ID" ${base}/staking/status`,
        },
        {
          step: 9,
          name: "Submit a compute task",
          curl: `curl -X POST ${base}/tasks -H "Authorization: Bearer YOUR_AGENT_ID" -H "Content-Type: application/json" -d '{"code":"result = inputs.a + inputs.b","inputs":{"a":1,"b":2}}'`,
        },
        {
          step: 10,
          name: "Create governance proposal",
          curl: `curl -X POST ${base}/governance/proposals -H "Authorization: Bearer YOUR_AGENT_ID" -H "Content-Type: application/json" -d '{"proposer_id":"YOUR_AGENT_ID","changes":[{"key":"economy.fees.prices.vectors_store.flat","new_value":0.02}]}'`,
        },
      ],
    };
  });
}
