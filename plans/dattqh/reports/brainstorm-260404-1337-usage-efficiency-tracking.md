# Brainstorm: Usage Efficiency Tracking

## Problem
- 5h window auto-resets → mỗi session gần 100% capacity
- Không biết 5h usage ảnh hưởng 7d bao nhiêu
- Cần đo lường hiệu quả: tránh lãng phí (idle) hoặc overuse (7d không kịp reset)

## Solution: Hybrid SessionMetric + Real-time

### New Model: SessionMetric
Persist khi session kết thúc: deltas (5h, 7d), impact_ratio, utilization, reset_count

### Metrics
- **utilization_pct**: Δ5h / (duration/5 × 100) — hiệu suất sử dụng
- **impact_ratio**: Δ7d / Δ5h — chi phí 7d per 1% 5h
- **7d_projection**: current_7d + remaining_sessions × avg_delta_7d
- **waste_sessions**: count(Δ5h < 5%)
- **reset_frequency**: sum(reset_count) per day

### Real-time (ActiveSession)
Live delta từ baseline vs latest snapshot cho session đang active

### Smart Alerts
- `session_waste`: Δ5h < 5% sau session > 2h
- `usage_exceeded`: [đã có]
- `7d_risk`: 7d > 70% + projected > 90%

## Decision
- Approach: Hybrid A+B (persist + real-time)
- Scope: per-user per-session + per-seat per-day
- Output: dashboard metrics + smart alerts
- Alert types: waste, overuse, 7d_risk
