import { useSearchParams } from 'react-router'
import { UsageSnapshotList } from '@/components/usage-snapshot-list'
import { ClaudeSessionsSection } from '@/components/claude-sessions-section'
import { PreResetHistoryTable } from '@/components/pre-reset-history-table'

export default function UsagePage() {
  const [searchParams] = useSearchParams()
  const highlightSeatId = searchParams.get('seat')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Usage Metrics</h1>
        <p className="text-muted-foreground">Theo dõi mức sử dụng thời gian thực từ Anthropic API</p>
      </div>

      {/* Latest snapshots grid */}
      <UsageSnapshotList highlightSeatId={highlightSeatId} />

      {/* Weekly pre-reset usage history */}
      <PreResetHistoryTable />

      {/* Desktop telemetry sessions */}
      <ClaudeSessionsSection initialSeatId={highlightSeatId} />
    </div>
  )
}
