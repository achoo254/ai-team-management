---
name: Auto Seat Activity Schedule
status: complete
priority: high
created: 2026-04-06
completed: 2026-04-06
branch: feat/auto-seat-activity-schedule
estimatedPhases: 6
completedPhases: 6
blockedBy: []
blocks: []
---

# Auto Seat Activity Schedule

## Summary

Refactor Schedule module: manual member-assignment → auto-detected seat activity tracking. Schedule becomes read-only heatmap of seat usage patterns derived from UsageSnapshot deltas.

## Key Decisions

1. Remove `user_id` from Schedule — tracks SEAT activity, not member assignments
2. Auto-detect from 5-min snapshot deltas (five_hour_pct increases)
3. New `seat_activity_log` collection (hourly resolution)
4. Weekly pattern generator → auto-create recurring Schedule entries
5. Heatmap UI replaces drag-drop grid (read-only)
6. Deprecate ActiveSession + SessionMetric models
7. Activity anomaly alerts (unexpected active/idle)

## Reports

- [Brainstorm](../reports/brainstorm-260406-0003-auto-seat-activity-schedule.md)

## Phases

| # | Phase | Priority | Status |
|---|-------|----------|--------|
| 1 | [Data Model Refactor](phase-01-data-model-refactor.md) | Critical | Complete |
| 2 | [Activity Detection Service](phase-02-activity-detection-service.md) | Critical | Complete |
| 3 | [Pattern Generator](phase-03-pattern-generator.md) | High | Complete |
| 4 | [API Refactor](phase-04-api-refactor.md) | High | Complete |
| 5 | [Frontend Heatmap](phase-05-frontend-heatmap.md) | High | Complete |
| 6 | [Alerts & Cleanup](phase-06-alerts-cleanup.md) | Medium | Complete |

## Dependencies

```
Phase 1 → Phase 2 → Phase 3
Phase 1 → Phase 4 → Phase 5
Phase 3 + Phase 5 → Phase 6
```

## Migration Strategy

1. Deploy Phase 1-2 first (collect activity data, keep old UI working)
2. After 1-2 weeks of data → deploy Phase 3-5 (pattern + heatmap)
3. Phase 6 last (alerts need pattern data to detect anomalies)
