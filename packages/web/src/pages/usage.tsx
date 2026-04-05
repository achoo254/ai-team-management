import { UsageSnapshotList } from '@/components/usage-snapshot-list'

export default function UsagePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Usage Metrics</h1>
        <p className="text-muted-foreground">Theo dõi mức sử dụng thời gian thực từ Anthropic API</p>
      </div>

      {/* Latest snapshots grid */}
      <UsageSnapshotList />
    </div>
  )
}
