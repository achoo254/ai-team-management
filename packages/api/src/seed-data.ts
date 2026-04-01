import { Seat } from './models/seat.js'
import { User } from './models/user.js'
import { Schedule } from './models/schedule.js'
import { Team } from './models/team.js'

export async function seedData() {
  const count = await Seat.countDocuments()
  if (count > 0) return // already seeded

  // Seats
  const seats = await Seat.insertMany([
    { email: 'quocdat254@gmail.com', label: 'TK Đạt', team: 'dev', max_users: 2 },
    { email: 'hoangnh@inet.vn', label: 'TK Hoàng', team: 'dev', max_users: 2 },
    { email: 'anhtct@inet.vn', label: 'TK Tuấn Anh', team: 'dev', max_users: 3 },
    { email: 'trihd@inet.vn', label: 'TK Trí', team: 'mkt', max_users: 3 },
    { email: 'quanlm@inet.vn', label: 'TK Quân', team: 'mkt', max_users: 3 },
  ])

  // Users
  const users = await User.insertMany([
    // Dev team
    { name: 'Đạt', email: 'quocdat254@gmail.com', role: 'admin', team: 'dev', seat_id: seats[0]._id },
    { name: 'Hổ', email: 'hobv@inet.vn', role: 'user', team: 'dev', seat_id: seats[0]._id },
    { name: 'Hoàng', email: 'hoangnh@inet.vn', role: 'user', team: 'dev', seat_id: seats[1]._id },
    { name: 'Chương', email: 'chuongdt@inet.vn', role: 'user', team: 'dev', seat_id: seats[1]._id },
    { name: 'ViệtNT', email: 'vietnt@inet.vn', role: 'user', team: 'dev', seat_id: seats[2]._id },
    { name: 'Đức', email: 'ducnd@inet.vn', role: 'user', team: 'dev', seat_id: seats[2]._id },
    { name: 'Tuấn Anh', email: 'anhtct@inet.vn', role: 'user', team: 'dev', seat_id: seats[2]._id },
    // MKT team
    { name: 'Trí', email: 'trihd@inet.vn', role: 'user', team: 'mkt', seat_id: seats[3]._id },
    { name: 'Hậu', email: 'hault@inet.vn', role: 'user', team: 'mkt', seat_id: seats[3]._id },
    { name: 'Trà', email: 'traht@inet.vn', role: 'user', team: 'mkt', seat_id: seats[3]._id },
    { name: 'Quân', email: 'quanlm@inet.vn', role: 'user', team: 'mkt', seat_id: seats[4]._id },
    { name: 'Ngọc', email: 'ngocptn@inet.vn', role: 'user', team: 'mkt', seat_id: seats[4]._id },
    { name: 'Phương', email: 'phuongttt@inet.vn', role: 'user', team: 'mkt', seat_id: seats[4]._id },
  ])

  // Schedules for 3-person seats
  const scheduleEntries = []
  // Seat 3 (anhtct): users[4]=VietNT, users[5]=Duc, users[6]=Tuan Anh
  for (let day = 0; day < 5; day++) {
    scheduleEntries.push({ seat_id: seats[2]._id, user_id: users[4 + (day % 3)]._id, day_of_week: day, slot: 'morning' as const })
    scheduleEntries.push({ seat_id: seats[2]._id, user_id: users[4 + ((day + 1) % 3)]._id, day_of_week: day, slot: 'afternoon' as const })
  }
  // Seat 4 (trihd): users[7]=Tri, users[8]=Hau, users[9]=Tra
  for (let day = 0; day < 5; day++) {
    scheduleEntries.push({ seat_id: seats[3]._id, user_id: users[7 + (day % 3)]._id, day_of_week: day, slot: 'morning' as const })
    scheduleEntries.push({ seat_id: seats[3]._id, user_id: users[7 + ((day + 1) % 3)]._id, day_of_week: day, slot: 'afternoon' as const })
  }
  // Seat 5 (quanlm): users[10]=Quan, users[11]=Ngoc, users[12]=Phuong
  for (let day = 0; day < 5; day++) {
    scheduleEntries.push({ seat_id: seats[4]._id, user_id: users[10 + (day % 3)]._id, day_of_week: day, slot: 'morning' as const })
    scheduleEntries.push({ seat_id: seats[4]._id, user_id: users[10 + ((day + 1) % 3)]._id, day_of_week: day, slot: 'afternoon' as const })
  }
  await Schedule.insertMany(scheduleEntries)

  // Teams
  await Team.insertMany([
    { name: 'dev', label: 'Dev', color: '#3b82f6' },
    { name: 'mkt', label: 'MKT', color: '#22c55e' },
  ])

  console.log('[Seed] Data seeded: 5 seats, 13 users, schedules, 2 teams')
}

export async function initializeDb() {
  await seedData()
}
