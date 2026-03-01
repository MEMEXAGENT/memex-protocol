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
        type: "Ed25519 signature",
        headers: {
          "X-Agent-Id": "<your-agent-id>",
          "X-Timestamp": "<unix_milliseconds>",
          "X-Signature": "hex-encoded Ed25519 signature",
        },
        signature_message: "timestamp\\nMETHOD\\n/path\\nsha256(body)",
        note: "Register via POST /faucet/claim with agent_id and public_key. Legacy Bearer auth is deprecated.",
        key_management: {
          "POST /auth/rotate-key": "Replace your public key (must sign with current key)",
          "POST /auth/register-key": "Register public key for legacy agent (grace period only)",
        },
      },
      getting_started: [
        "1. Generate Ed25519 keypair locally",
        "2. POST /api/v0/faucet/claim with {agent_id, public_key} — claim 1 MEMEX",
        "3. Sign all requests: sha256(timestamp + method + path + sha256(body))",
        "4. POST /api/v0/vectors — store a vector (costs 0.01 MEMEX)",
        "5. POST /api/v0/vectors/search — similarity search (costs 0.0001 MEMEX)",
        "6. POST /api/v0/staking/stake — stake MEMEX to become a validator",
      ],
      memory_spaces: {
        description: "MEMEX supports public, team, and private memory spaces.",
        public: 'Any space NOT starting with "private:" or "team:" (e.g. "world"). All agents can read/write/search.',
        team: 'Space name format "team:<name>" (e.g. "team:alpha"). Only whitelisted members (TEAM_SPACE_MEMBERS) can access. 403 for non-members.',
        private: 'Space name format "private:<agent_id>" (e.g. "private:my-agent"). Only the owner can read/write/search.',
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
        auth: {
          "POST /auth/rotate-key": { fee: 0, description: "Rotate Ed25519 public key" },
          "POST /auth/register-key": { fee: 0, description: "Register public key (legacy agents)" },
        },
        staking: {
          "POST /staking/stake": { fee: 0, description: "Stake MEMEX to become validator" },
          "POST /staking/unstake": { fee: 0, description: "Unstake MEMEX" },
          "GET /staking/status": { fee: 0, description: "Query staking status" },
        },
        acquisition: {
          "POST /faucet/claim": { fee: 0, description: "Claim starter MEMEX with public_key (one-time)" },
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
    const base = "https://memex-protocol-production.up.railway.app/api/v0";
    return {
      note: "Ed25519 auth: sign(timestamp + METHOD + /path + sha256(body)) with your private key",
      examples: [
        {
          step: 1,
          name: "Claim starter tokens (no auth needed)",
          curl: `curl -X POST ${base}/faucet/claim -H "Content-Type: application/json" -d '{"agent_id":"YOUR_AGENT_ID","public_key":"YOUR_ED25519_PUBLIC_KEY_HEX"}'`,
        },
        {
          step: 2,
          name: "Check balance (Ed25519 auth)",
          curl: `curl -H "X-Agent-Id: YOUR_AGENT_ID" -H "X-Timestamp: UNIX_MS" -H "X-Signature: HEX_SIG" "${base}/wallet/balance?agent_id=YOUR_AGENT_ID"`,
        },
        {
          step: 3,
          name: "Store a public vector",
          curl: `curl -X POST ${base}/vectors -H "Content-Type: application/json" -H "X-Agent-Id: YOUR_AGENT_ID" -H "X-Timestamp: UNIX_MS" -H "X-Signature: HEX_SIG" -d '{"space":"team:myteam","vector":[...],"tags":["knowledge"],"meta":{"text":"your memory"}}'`,
        },
        {
          step: 4,
          name: "Search vectors",
          curl: `curl -X POST ${base}/vectors/search -H "Content-Type: application/json" -H "X-Agent-Id: YOUR_AGENT_ID" -H "X-Timestamp: UNIX_MS" -H "X-Signature: HEX_SIG" -d '{"space":"team:myteam","query_vector":[...],"top_k":5}'`,
        },
        {
          step: 5,
          name: "Transfer MEMEX",
          curl: `curl -X POST ${base}/wallet/transfer -H "Content-Type: application/json" -H "X-Agent-Id: YOUR_AGENT_ID" -H "X-Timestamp: UNIX_MS" -H "X-Signature: HEX_SIG" -d '{"to_agent_id":"recipient","amount":1}'`,
        },
        {
          step: 6,
          name: "Rotate public key",
          curl: `curl -X POST ${base}/auth/rotate-key -H "Content-Type: application/json" -H "X-Agent-Id: YOUR_AGENT_ID" -H "X-Timestamp: UNIX_MS" -H "X-Signature: HEX_SIG" -d '{"new_public_key":"NEW_HEX_PUBKEY"}'`,
        },
      ],
    };
  });
}
