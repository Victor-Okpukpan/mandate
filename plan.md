# MANDATE — demo readiness + onboarding cut-down

Status: **drafting.** Section 2 is settled. Section 3 (the rewrite) is a set of
open questions — nothing there is built until we agree.

---

## 1. What MANDATE is (the pitch, one breath)

A company owns an ENS name (`acme.eth`). For every AI agent it runs, it issues a
**mandate** — a subname (`researcher.acme.eth`) whose ENS records *are* the
agent's spending authority: total budget, per-payment cap, expiry, allowed
recipient addresses. The agent's wallet is a Privy server wallet — no human holds
keys. Two independent layers enforce the mandate:

- **Privy policy** (off-chain) — the Enforcer service turns each mandate into a
  wallet policy, so Privy blocks a bad transaction before it's signed.
- **Arc contracts** (on-chain) — `AgentTreasury` holds the agent's USDC and
  reverts any payment over budget/cap or to a non-allowlisted address.

Revoke the subname → both layers die at once. That's the kill switch.

**The agent is not part of MANDATE.** MANDATE issues and enforces authority. The
agent itself is whatever the company already runs — ChatGPT, LangChain, a cron
job. It just needs the wallet. This is the thing to say to judges: *"bring your
own agent; we're the seatbelt."*

---

## 2. The demo (settled)

Goal: after issuing a mandate, show the enforcement working — live, on screen, in
under two minutes. **No Anthropic key, no LLM.** A ~30-line script stands in for
"the agent" — it just holds the agent wallet and attempts payments.

### Script: `demo/agent-spend.ts` (to build)

Runs three payments from the agent wallet through `AgentTreasury.payTo`:

| # | Action | Expected | What it proves |
|---|--------|----------|----------------|
| 1 | Pay an allowlisted address, under the per-tx cap | **succeeds** — real tx on Arcscan | the mandate permits what it should |
| 2 | Pay the same address, over the cap (or a non-allowlisted address) | **reverts** on-chain | the contract enforces, not our code |
| 3 | (operator revokes the ENS name in the app) then retry payment 1 | **reverts** | revoking the name kills the agent |

Nothing is simulated — every call hits the real deployed contract and either
lands or reverts.

### Prerequisites

- A fresh org created through the fixed wizard (section 3), which includes its
  **Arc vault** and a first agent. `testorg.eth` is abandoned.
- The vault's treasury funded with a small USDC balance.
- The agent wallet given a little Arc-testnet native USDC for gas.
- One allowlisted recipient address (the org admin wallet is fine).

### Live-run checklist for demo day

1. Fresh org onboarded (mandate issued, Arc vault created), treasury funded.
2. Terminal open with `demo/agent-spend.ts`, app open to the org dashboard.
3. Run payment 1 → refresh dashboard, show the spend.
4. Run payment 2 → show the revert reason.
5. Revoke the mandate in the app → run payment 1 again → show it now reverts.

---

## 3. Onboarding + page cut-down

### Decisions locked (from the conversation)

- **Pitch = two things:** (a) spending limits + the ENS kill switch, (b) the
  money runs on Arc where USDC is the gas token. Agent-hires-agent is **out of
  this version** — it goes in the docs as a roadmap item (section 5). The
  wallet-security quorum stays (it's already built into the Enforcer) but it's a
  spoken footnote, not a demoed screen.
- **Start fresh.** `testorg.eth` is abandoned — it's missing its vault and the
  user won't hand-finish it. The platform factories (`MandateOrgFactory`,
  `ArcVaultFactory`) stay deployed as-is; nothing on-chain gets redeployed. The
  user creates a brand-new org through the fixed flow once it's built.
- **Onboarding = one gated wizard with a horizontal step timeline.** 5–6 markers
  across the top; the active step is highlighted, finished steps get a check,
  each completed step advances to the next. The flow ends with a running agent.
- **Hard gate.** Until the wizard is finished, the user cannot reach the
  dashboard or any org page — landing on one mid-onboarding bounces them back
  into the wizard at the step they left off. Progress is recoverable (resolved
  from on-chain state + local storage), not lost on refresh.
- **Copy:** kill the AI-slop. Every page header is a plain imperative —
  *"Register your agent"*, *"Name your organisation"* — not a 20–35 word
  paragraph. One short helper line max, only where it's actually needed.
- **Nav after the rewrite: the dashboard is the only operational page.**

### The three pages in question — what they do, and the call

**Treasury** — the Arc vault is two contracts: `MandateAnchor` (mirrors the
mandate onto Arc) and `AgentTreasury` (holds the USDC). This page shows the
vault's balance and, per agent, how much it has spent against its budget. You
*need* this data for the demo — you fund the treasury here, and the running
"spent so far" total is exactly what makes the over-budget payment revert.
→ **Keep the data, fold it into the dashboard** (balance + Fund button up top,
"spent X of Y" on each agent row). Delete the standalone page.

**Jobs** — ERC-8183 escrow. One agent creates a job for another, funds it into
escrow, the provider submits work, a third-party evaluator approves, escrow pays
out. It's agent-to-agent commerce — the part of the story you're cutting.
→ **Remove from nav** (feature-flag, keep the code).

**Approvals** — by default an agent's Privy wallet is "ownerless": anyone holding
the Privy app secret could alter its policy. This page + a setup script give the
wallet an *owner* — a signing quorum — so only that quorum can change it. Real
hardening, already wired into the Enforcer, but it needs setup steps and is an
advanced footnote for a demo.
→ **Remove from nav** (feature-flag). Say it out loud, don't show the screen.

### Build plan

**A. Onboarding wizard — `web/app/onboard/page.tsx` rewrite**

One gated flow. Horizontal step timeline pinned at the top the whole way through:

```
①━━②━━③━━④━━⑤━━⑥
```

| # | Marker | What happens | Cost |
|---|--------|--------------|------|
| 1 | **Connect** | Connect / sign in (Privy). Auto-checks when a wallet is present. | — |
| 2 | **Name** | Type the org name; live availability + price. | — |
| 3 | **Add funds** | Show the three balances needed (Sepolia ETH, Sepolia USDC, Arc USDC) with faucet links. **Hard gate** — Next is disabled until each is enough. | — |
| 4 | **Register on ENS** | `commit` tx → 60s countdown (auto) → `approve` (max, once) + `register` tx. Sub-progress inside the one marker. | 2 sigs |
| 5 | **Create Arc vault** | Switch to Arc, `createVaultFor` tx. | 1 sig + switch |
| 6 | **Register your first agent** | The slim agent form (see B). Wallet auto-provisioned. `issueMandate` tx. | 1 sig |

- Finished markers show a check and are not re-editable.
- On refresh mid-flow: rehydrate the current step from on-chain state
  (`isAvailable`, `OrgCreated` log, `VaultCreated` log, `MandateIssued` log) +
  local storage for the in-between commit secret.
- Step 6 done → dashboard, agent already in the tree.
- A route guard (D) keeps every org page unreachable until step 6 is done.

**B. Agent registration — replaces `web/app/org/[orgEnsName]/mandate/new/page.tsx`**
- Used twice: as wizard step 6, and as a standalone "Register agent" screen from
  the dashboard for every agent after the first. Same component.
- Fields: **agent name, budget (USDC), per-tx cap (USDC), expires in (days),
  allowed addresses.** That's it on the surface.
- "Advanced" disclosure holds *budget period* (default: lifetime) and
  *sub-delegation depth* (default: 0 = can't delegate).
- Wallet auto-provisions on submit — no button, no address field to fill.
- One signature → back to the dashboard, new row already in the tree.

**C. Dashboard — `web/app/org/[orgEnsName]/page.tsx`**
- Top strip: org name, Arc treasury balance, **Fund** button.
- Mandate tree stays; each row gains "spent X of Y".
- Row → drawer: ENS records, Arc anchor, **Revoke**.
- New section: **recent agent payments** (the `payTo` events from the treasury) —
  this is where the demo's payments show up live.
- Drop the adversary panel from the default view (feature-flag).

**D. Nav + route guard — `web/app/_components/AppShell.tsx` + org layout**
- Org nav = **Dashboard** + **Register agent**. Nothing else.
- Jobs / Treasury / Approvals behind `NEXT_PUBLIC_SHOW_ADVANCED` (or similar).
- **Guard:** `web/app/org/[orgEnsName]/layout.tsx` (or a client wrapper) checks
  the org resolves *and* has a vault. If not — or if the connected wallet has no
  completed org at all — redirect to `/onboard` at the right step. No way to sit
  on a half-built org.

**E. Demo script — `demo/agent-spend.ts`** (section 2)

**F. Copy pass** — every `<Lede>`/`<Eyebrow>` in the touched files: cut to a
plain imperative + at most one short helper line.


### Current state (measured)

**Onboarding (`/onboard`)** — 5 stacked cards:

1. Connect wallet
2. Choose org name (availability + USDC price check)
3. Preflight — three blocking funding checks: Sepolia ETH (gas), Sepolia USDC
   (ENS registration fee), Arc USDC (vault)
4. Reserve → **commit tx** → **~60s forced wait** (ENSv2 commit-reveal) →
   finalize → **USDC approve tx** + **register tx**
5. Arc vault → **switch to Arc** → **createVault tx**

**Then a separate page, `/mandate/new`** — ~10 fields (org label, agent wallet
[+ provision button], separate Arc wallet, budget total, per-tx cap, budget
period, expiry, sub-delegation depth, allowlist) → **issue tx**.

Total to get one agent running: **6–7 transactions, a chain switch, a 60s wait,
~10 form fields, across 2 pages.** Too much.

**Org pages in the nav:** Mandates (dashboard), Issue mandate, Jobs, Treasury,
Approvals, agent detail.

### What each page is, plainly

| Page | What it does | Do you act on it? |
|------|--------------|-------------------|
| **Mandates** (dashboard) | Tree of every mandate, live state, click a row → detail + **revoke** | Yes — this is the control panel |
| **Issue mandate** | The 10-field form above | Yes, once per agent |
| **Treasury** | Arc vault balance, deposits, per-agent spend ledger | Only to fund it / check balances |
| **Jobs** | ERC-8183 escrow: an agent hires another agent, money held until work is judged | Only if you demo agent-to-agent hiring |
| **Approvals** | Tiered authorization keys protecting who can change an agent's wallet | Only if you demo the security-quorum story |
| **agent/[name]** | One agent's records + Arc anchor + spend | Read-only detail |

### Build order

1. **Wizard + guard (A, D).** The gated horizontal-timeline onboarding, ending
   with the first agent. This is the thing blocking a clean run-through.
2. **Agent registration (B).** Slim form — built as wizard step 6, reused
   standalone.
3. **Dashboard (C).** Fold in treasury balance + Fund + spent-per-agent + recent
   payments. Hide Jobs/Treasury/Approvals from nav.
4. **Demo script (E)** — `demo/agent-spend.ts`.
5. **Copy pass (F).**

Then the user does one clean onboarding run on a fresh org name, and we shoot the
demo.

---

## 4. Verification

- `pnpm --filter web build` + `tsc --noEmit` clean after each of A–D.
- Manual run-through on a throwaway org name on Sepolia/Arc testnet: every step
  advances, refresh mid-flow resumes at the right step, no org page reachable
  until step 6 completes.
- Demo script: payment 1 lands (tx on Arcscan), payment 2 reverts with the
  mandate's own error, payment 3 reverts after revoke.

---

## 5. Roadmap — next version (docs, not built now)

Add a "Roadmap" / "What's next" section to the docs (`landing/app/docs/...`)
covering the deferred pieces:

- **Agent-to-agent commerce (ERC-8183 jobs).** An agent posts a job, funds an
  escrow, another agent delivers, a third-party evaluator releases payment. The
  contracts and the `Jobs` page already exist behind a flag — this version just
  doesn't put it in front of users.
- **Sub-delegation in the UI.** An agent issuing a strictly-narrower mandate to a
  sub-agent. Enforced on-chain today (`MandateRegistrar.attenuate`), no UI.
- **Wallet-ownership quorum as a first-class setup step.** The Approvals flow,
  currently an advanced/manual path.
