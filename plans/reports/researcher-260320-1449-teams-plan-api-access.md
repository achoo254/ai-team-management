# Research Report: Anthropic Claude Code Analytics API Access for Teams Plan

**Date:** 2026-03-20 | **Scope:** Teams Plan API capabilities vs Enterprise Plan vs API (PAYG)

---

## EXECUTIVE SUMMARY

**Teams Plan does NOT have programmatic API access to Claude Code Analytics.** Dashboard-only analytics available. Admin API key generation IS possible. Enterprise Plan has full Analytics API access.

---

## KEY FINDINGS

### 1. Claude Code Analytics API Access

| Feature | Teams Plan | Enterprise Plan | API (PAYG) |
|---------|-----------|-----------------|-----------|
| Dashboard analytics | YES | YES | YES (via platform.claude.com) |
| Claude Code Analytics API | NO | YES | YES |
| Analytics API | NO | YES | NO |
| Admin API key generation | YES | YES | YES |

**Critical Detail:** Claude Code Analytics API (`/v1/organizations/usage_report/claude_code`) requires **Admin API key** and is **NOT available for Teams Plan**, despite Teams Plan admins being able to generate Admin API keys.

---

### 2. Per-User/Member Usage Data

**Teams Plan:**
- Dashboard only shows aggregated metrics
- No per-member breakdown via API
- CSV export available from dashboard for contribution metrics (GitHub integration)
- Can export member details (name, email, role, seat type) for audit purposes
- Daily active users, sessions, and contributions tracked in dashboard

**Enterprise Plan:**
- Full per-user/per-member data via Analytics API
- Programmatic access to engagement and adoption metrics
- Same metrics available via API that appear in dashboard

**API (PAYG):**
- Per-user spend and line metrics via Usage and Cost API
- Team insights table shows per-user metrics (spend, lines of code)

---

### 3. Admin API Key Access

**Can Teams Plan admin generate Admin API key (`sk-ant-admin-*`)?**

YES. Teams Plan admins with Admin role can:
- Navigate to Console → Settings → Organization
- Select "Admin keys"
- Click "+ Create Admin Key"

**Limitation:** Admin key exists but **cannot be used for Claude Code Analytics API or Analytics API** on Teams Plan.

---

### 4. Data Visibility: Teams Plan Admin Can Actually See

**Via Dashboard (claude.ai/analytics/claude-code):**
- Usage metrics: lines of code accepted, suggestion accept rate, daily active users, sessions
- Contribution metrics: PRs with Claude Code, lines of code shipped (GitHub integration required)
- Leaderboard: top 10 contributors by usage
- Data export: CSV download of all user contribution data
- Spend controls: per-user and organization spend caps visible
- Member management: export member details (name, email, role, seat type)

**Via API:**
- NONE for Claude Code or Analytics APIs
- Can use standard API keys to interact with Claude models, but not for org analytics

---

### 5. Plan Differences: Official Documentation

**Teams Plan vs Enterprise Plan API Access:**

| Capability | Teams | Enterprise |
|-----------|-------|-----------|
| Claude Code Analytics API | ❌ NO | ✅ YES |
| Analytics API (engagement/adoption) | ❌ NO | ✅ YES |
| Usage & Cost API | ❌ NO | ✅ YES |
| Admin API key generation | ✅ YES | ✅ YES |
| Audit logs (programmatic) | ❌ NO | ✅ YES |
| Dashboard analytics | ✅ YES (limited) | ✅ YES (full) |
| Custom data retention controls | ❌ NO | ✅ YES |
| SCIM/SSO | ✅ Basic | ✅ Advanced |

**Pricing Model Difference:**
- Teams Plan: Per-seat pricing, usage included in seat fee
- Enterprise Plan: Seat fee + usage-based billing at API rates (separate)

---

### 6. Unresolved Questions

1. **Roadmap status:** Is Anthropic planning to release Claude Code Analytics API access for Teams Plan in the future? (Not found in public docs)
2. **Exact date of Teams Plan limitation:** When was the decision made to restrict Analytics API to Enterprise? (Not documented)
3. **PAYG to Teams migration:** If upgrading from PAYG (with full API access) to Teams Plan, what data export options exist? (Not explicitly covered)
4. **Compliance API:** Teams Plan support for Compliance API (mentioned for Enterprise). (Not explicitly confirmed for Teams)

---

## SOURCE DOCUMENTATION

- [Claude Code Analytics API - platform.claude.com](https://platform.claude.com/docs/en/build-with-claude/claude-code-analytics-api)
- [Analytics API - support.claude.com](https://support.claude.com/en/articles/13694757-access-engagement-and-adoption-data-with-the-analytics-api)
- [Teams Plan Analytics Dashboard - code.claude.com](https://code.claude.com/docs/en/analytics)
- [Usage Analytics for Teams/Enterprise - support.claude.com](https://support.claude.com/en/articles/12883420-view-usage-analytics-for-team-and-enterprise-plans)
- [Claude Code Usage Analytics - support.claude.com](https://support.claude.com/en/articles/12157520-claude-code-usage-analytics)
- [Admin API Overview - platform.claude.com](https://platform.claude.com/docs/en/build-with-claude/administration-api)
- [What is the Enterprise Plan - support.claude.com](https://support.claude.com/en/articles/9797531-what-is-the-enterprise-plan)
- [What is the Team Plan - support.claude.com](https://support.claude.com/en/articles/9266767-what-is-the-team-plan)

---

## IMPLICATIONS FOR PROJECT ARCHITECTURE

**If your project requires:**
- Programmatic access to Claude Code usage per team member → **Enterprise Plan required**
- Dashboard-only analytics with CSV export → **Teams Plan sufficient**
- Custom integrations with usage data → **Enterprise Plan required**
- Member activity monitoring via API → **Enterprise Plan required**

**Workaround for Teams Plan:** Build custom tracking integration using webhook/event streaming if supported, or manually export CSV reports from dashboard on schedule.

