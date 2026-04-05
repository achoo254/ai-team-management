/**
 * BLD PDF Service
 * Generates weekly digest PDFs using pdfkit.
 * Scope: seats with include_in_overview=true (resolved via getSeatsInScope).
 */

import PDFDocument from 'pdfkit'
import fs from 'node:fs'
import path from 'node:path'
import { config } from '../config.js'
import {
  computeFleetKpis,
  computeWwHistory,
  computeRebalanceSuggestions,
  getSeatsInScope,
} from './bld-metrics-service.js'
import { latestSnapshotsForSeats } from './bld-pdf-data-helper.js'

// ── Constants ─────────────────────────────────────────────────────────────────

const DIGEST_RETENTION_DAYS = 30

export function getDigestDir(): string {
  // Read DATA_DIR at call time so tests can override process.env.DATA_DIR
  const dataDir = process.env.DATA_DIR || config.dataDir
  return path.resolve(dataDir, 'bld-digests')
}

// ── PDF rendering helpers ──────────────────────────────────────────────────────

function renderHeader(doc: PDFKit.PDFDocument): void {
  doc.fontSize(20).font('Helvetica-Bold').text('Bao cao tuan BLD', { align: 'center' })
  doc.moveDown(0.3)
  const ts = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
  doc.fontSize(9).font('Helvetica').fillColor('#666666')
    .text(`Tao luc: ${ts}`, { align: 'center' })
  doc.fillColor('#000000').moveDown(1)
}

function renderKpis(doc: PDFKit.PDFDocument, kpis: Awaited<ReturnType<typeof computeFleetKpis>>): void {
  doc.fontSize(14).font('Helvetica-Bold').text('Chi so tong quan')
  doc.moveDown(0.3)
  doc.fontSize(10).font('Helvetica')
  doc.text(`Muc su dung doi seat: ${kpis.utilPct.toFixed(1)}%`)
  doc.text(`Lang phi: $${kpis.wasteUsd.toFixed(2)}/thang`)
  const sign = kpis.wwDelta >= 0 ? '+' : ''
  doc.text(`Chenh lech tuan: ${sign}${kpis.wwDelta.toFixed(1)}%`)
  doc.text(
    `Seat tinh phi: ${kpis.billableCount} x $${kpis.monthlyCostUsd.toFixed(2)} = $${kpis.totalCostUsd.toFixed(2)}/thang`,
  )
  doc.moveDown(1)
}

function renderTopWaste(
  doc: PDFKit.PDFDocument,
  seats: Array<{ label: string; wastePct: number; wasteUsd: number }>,
): void {
  doc.fontSize(14).font('Helvetica-Bold').text('Top 3 seat lang phi nhat')
  doc.moveDown(0.3)
  if (seats.length === 0) {
    doc.fontSize(10).font('Helvetica').text('Khong co du lieu.')
    doc.moveDown(1)
    return
  }
  seats.forEach((s, i) => {
    doc.fontSize(10).font('Helvetica')
      .text(`${i + 1}. ${s.label} — Lang phi: ${s.wastePct.toFixed(1)}% ($${s.wasteUsd.toFixed(2)}/thang)`)
  })
  doc.moveDown(1)
}

function renderWwTrend(
  doc: PDFKit.PDFDocument,
  history: Awaited<ReturnType<typeof computeWwHistory>>,
): void {
  doc.fontSize(14).font('Helvetica-Bold').text('Xu huong su dung 8 tuan gan nhat')
  doc.moveDown(0.3)
  if (history.length === 0) {
    doc.fontSize(10).font('Helvetica').text('Khong co du lieu lich su.')
    doc.moveDown(1)
    return
  }

  // Table header
  const colWeek = 50
  const colUtil = 200
  const colWaste = 310
  const startX = doc.page.margins.left
  const y = doc.y

  doc.fontSize(9).font('Helvetica-Bold')
  doc.text('Tuan', startX + colWeek - 50, y, { width: 150 })
  doc.text('Su dung %', startX + colUtil - 50, y, { width: 80 })
  doc.text('Lang phi $', startX + colWaste - 50, y, { width: 100 })
  doc.moveDown(0.4)

  history.forEach(row => {
    const rowY = doc.y
    const weekLabel = new Date(row.week_start).toLocaleDateString('vi-VN')
    doc.fontSize(9).font('Helvetica')
    doc.text(weekLabel, startX + colWeek - 50, rowY, { width: 150 })
    doc.text(`${row.utilPct.toFixed(1)}%`, startX + colUtil - 50, rowY, { width: 80 })
    doc.text(`$${row.wasteUsd.toFixed(2)}`, startX + colWaste - 50, rowY, { width: 100 })
    doc.moveDown(0.4)
  })
  doc.moveDown(0.6)
}

function renderSuggestions(
  doc: PDFKit.PDFDocument,
  suggestions: Awaited<ReturnType<typeof computeRebalanceSuggestions>>,
  monthlyCostUsd: number,
): void {
  doc.fontSize(14).font('Helvetica-Bold').text('De xuat toi uu')
  doc.moveDown(0.3)
  if (suggestions.length === 0) {
    doc.fontSize(10).font('Helvetica').text('Khong co de xuat.')
    doc.moveDown(1)
    return
  }
  suggestions.forEach(s => {
    doc.fontSize(10).font('Helvetica')
    if (s.type === 'move_member') {
      doc.text(
        `- Di chuyen member: ${s.fromSeatLabel} -> ${s.toSeatLabel}: ${s.reason}`,
      )
    } else if (s.type === 'rebalance_seat') {
      doc.text(
        `- Rebalance: ${s.overloadedSeatLabel} <-> ${s.underusedSeatLabel}: ${s.reason}`,
      )
    } else if (s.type === 'add_seat') {
      doc.text(`- De xuat THEM seat: ${s.reason} (+$${monthlyCostUsd.toFixed(2)}/thang)`)
    }
  })
  doc.moveDown(1)
}

// ── Main generation ───────────────────────────────────────────────────────────

export async function generateWeeklyDigest(): Promise<string> {
  const adminScope = { type: 'admin' as const }
  const [kpis, history, suggestions, overviewSeats] = await Promise.all([
    computeFleetKpis(adminScope),
    computeWwHistory(adminScope, 8),
    computeRebalanceSuggestions(adminScope),
    getSeatsInScope(adminScope),
  ])

  // Compute top 3 waste seats
  const seatIds = overviewSeats.map(s => String(s._id))
  const snaps = await latestSnapshotsForSeats(seatIds)
  const snapMap = new Map(snaps.map(s => [s.seat_id, s.seven_day_pct]))

  const wasteSeats = overviewSeats
    .map(s => {
      const util = snapMap.get(String(s._id)) ?? 0
      const wastePct = 100 - util
      const wasteUsd = (wastePct / 100) * kpis.monthlyCostUsd
      return { label: s.label, wastePct, wasteUsd }
    })
    .sort((a, b) => b.wasteUsd - a.wasteUsd)
    .slice(0, 3)

  const digestDir = getDigestDir()
  fs.mkdirSync(digestDir, { recursive: true })

  const date = new Date().toISOString().split('T')[0]
  const filePath = path.join(digestDir, `${date}.pdf`)

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    const stream = fs.createWriteStream(filePath)
    doc.pipe(stream)

    renderHeader(doc)
    renderKpis(doc, kpis)
    renderTopWaste(doc, wasteSeats)
    renderWwTrend(doc, history)
    renderSuggestions(doc, suggestions, kpis.monthlyCostUsd)

    doc.end()
    stream.on('finish', resolve)
    stream.on('error', reject)
  })

  return filePath
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export function purgeExpiredDigests(): void {
  const digestDir = getDigestDir()
  if (!fs.existsSync(digestDir)) return

  const cutoff = Date.now() - DIGEST_RETENTION_DAYS * 24 * 3600_000
  const files = fs.readdirSync(digestDir)
  for (const file of files) {
    const filePath = path.join(digestDir, file)
    try {
      const stat = fs.statSync(filePath)
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(filePath)
        console.log(`[BLD Digest] Purged expired file: ${file}`)
      }
    } catch (err) {
      console.error(`[BLD Digest] Failed to purge ${file}:`, err)
    }
  }
}
