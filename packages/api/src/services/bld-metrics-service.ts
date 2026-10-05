/**
 * BLD Metrics — barrel.
 *
 * Split into focused modules; this file keeps the original import path stable
 * for routes, the Telegram service and tests.
 */

export { getMonthlyCostUsd } from './seat-cost.js'
export { getSeatsInScope, type MetricsScope } from './metrics-scope.js'
export { computeFleetKpis } from './fleet-kpi-service.js'
export { computeWwHistory, computeDdHistory } from './fleet-history-service.js'
export { computeRebalanceSuggestions } from './rebalance-suggestion-service.js'
