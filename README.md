# MEMEX Protocol v0

Decentralized vector memory and compute protocol for AI agents.

## Architecture

- **Runtime**: Node.js + TypeScript
- **Framework**: Fastify
- **Database**: PostgreSQL + pgvector
- **ORM**: Drizzle ORM

## Quick Start

### 1. Start PostgreSQL

```bash
docker compose up -d
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

### 4. Run Migrations

```bash
npm run db:migrate
```

### 5. Seed Genesis Allocation

```bash
npm run db:seed
```

### 6. Start Development Server

```bash
npm run dev
```

Server runs at `http://localhost:3000`.

## API Endpoints

All endpoints are prefixed with `/api/v0`.

| Method | Path | Description | Fee |
|--------|------|-------------|-----|
| POST | `/vectors` | Store a vector | 0.01 MEMEX |
| GET | `/vectors/:id` | Get vector metadata | - |
| POST | `/vectors/search` | Similarity search | 0.0001 MEMEX |
| POST | `/tasks` | Submit compute task | 0.01 MEMEX |
| GET | `/tasks/:id` | Get task status | - |
| GET | `/wallet/balance` | Get MEMEX balance | - |
| POST | `/wallet/transfer` | Transfer MEMEX | - |
| POST | `/faucet/claim` | Claim starter MEMEX | - |
| POST | `/missions/claim` | Claim mission reward | - |
| POST | `/governance/proposals` | Create proposal | - |
| GET | `/governance/proposals` | List proposals | - |
| POST | `/governance/proposals/:id/vote` | Vote on proposal | - |
| GET | `/config` | Current config | - |
| GET | `/node/status` | Node status | - |
| GET | `/peers` | Peer list | - |
| GET | `/health` | Health check | - |

## Authentication

Use Bearer token with your agent_id:

```bash
curl -H "Authorization: Bearer my-agent-id" http://localhost:3000/api/v0/wallet/balance?agent_id=my-agent-id
```

## Token Economics

- **Max Supply**: 1,000,000,000 MEMEX
- **Reward Pool**: 60% (10-year linear release)
- **Ecosystem**: 25% (faucet, missions, partnerships)
- **Treasury**: 15% (protocol maintenance)

## Governance

Staked agents can propose and vote on parameter changes (fees, min_stake). Proposals require 20% quorum and 2/3 supermajority to pass.

## Protocol Spec

See `spec/memex-v0.yaml` for the full protocol specification and `spec/openapi.yaml` for the OpenAPI v3 definition.
