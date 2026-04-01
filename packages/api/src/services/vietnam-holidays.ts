/**
 * Vietnam public holidays checker.
 * Fixed holidays + lunar-based holidays (Tet, Hung Kings).
 * Lunar dates are pre-computed for 2024-2030 range.
 */

/** Fixed holidays (month-day) — include observed days off */
const FIXED_HOLIDAYS = [
  '01-01', // Tết Dương lịch
  '04-30', // Giải phóng miền Nam
  '05-01', // Quốc tế Lao động
  '09-02', // Quốc khánh
  '09-03', // Nghỉ bù Quốc khánh
]

/**
 * Lunar-based holidays: Tết Nguyên đán (~5 days) + Giỗ Tổ Hùng Vương (10/3 âm lịch).
 * Pre-computed Gregorian dates for 2024-2030.
 * Update this map when needed for years beyond 2030.
 */
const LUNAR_HOLIDAYS: Record<number, string[]> = {
  2024: [
    // Tết Giáp Thìn: 8-14 Feb
    '02-08', '02-09', '02-10', '02-11', '02-12', '02-13', '02-14',
    // Giỗ Tổ Hùng Vương: 18 Apr
    '04-18',
  ],
  2025: [
    // Tết Ất Tỵ: 25 Jan - 2 Feb (29 Tết → mùng 5)
    '01-25', '01-26', '01-27', '01-28', '01-29', '01-30', '01-31', '02-01', '02-02',
    // Giỗ Tổ Hùng Vương: 7 Apr
    '04-07',
  ],
  2026: [
    // Tết Bính Ngọ: 14-20 Feb
    '02-14', '02-15', '02-16', '02-17', '02-18', '02-19', '02-20',
    // Giỗ Tổ Hùng Vương: 27 Mar
    '03-27',
  ],
  2027: [
    // Tết Đinh Mùi: 4-10 Feb
    '02-04', '02-05', '02-06', '02-07', '02-08', '02-09', '02-10',
    // Giỗ Tổ Hùng Vương: 16 Apr
    '04-16',
  ],
  2028: [
    // Tết Mậu Thân: 25-31 Jan
    '01-25', '01-26', '01-27', '01-28', '01-29', '01-30', '01-31',
    // Giỗ Tổ Hùng Vương: 4 Apr
    '04-04',
  ],
  2029: [
    // Tết Kỷ Dậu: 12-18 Feb
    '02-12', '02-13', '02-14', '02-15', '02-16', '02-17', '02-18',
    // Giỗ Tổ Hùng Vương: 24 Apr
    '04-24',
  ],
  2030: [
    // Tết Canh Tuất: 2-8 Feb
    '02-02', '02-03', '02-04', '02-05', '02-06', '02-07', '02-08',
    // Giỗ Tổ Hùng Vương: 13 Apr
    '04-13',
  ],
}

/** Check if a given date is a Vietnam public holiday */
export function isVietnamHoliday(date: Date = new Date()): boolean {
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const key = `${mm}-${dd}`

  // Check fixed holidays
  if (FIXED_HOLIDAYS.includes(key)) return true

  // Check lunar holidays
  const year = date.getFullYear()
  const lunarDates = LUNAR_HOLIDAYS[year]
  if (lunarDates && lunarDates.includes(key)) return true

  return false
}
