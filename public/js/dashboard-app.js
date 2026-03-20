/**
 * dashboard-app.js
 * Main Alpine.js application store for the AI Manager SPA.
 * Handles auth, view routing, and data loading for all views.
 * Pure utility helpers live in dashboard-helpers.js (spread in via ...dashboardHelpers).
 */

function dashboardApp() {
  return {
    ...dashboardHelpers,
    ...dashboardAdminActions,
    // --- State ---
    currentView: 'dashboard',
    loading: false,
    error: null,
    user: null,

    NAV_ITEMS: [
      { key: 'dashboard', label: 'Dashboard',   icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
      { key: 'seats',     label: 'Seats',        icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H4a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2h-1' },
      { key: 'schedule',  label: 'Lịch phân ca', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
      { key: 'alerts',    label: 'Cảnh báo',     icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
      { key: 'admin',     label: 'Quản trị',     icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' }
    ],

    // View data
    summary: null,
    usageBySeat: [],
    seats: [],
    schedules: [],
    schedulesToday: [],
    alerts: [],
    resolvedAlerts: [],
    adminUsers: [],

    // UI state
    editScheduleCell: null,      // { seatId, dayOfWeek, slot }
    editUserModal: null,          // user object or {} for new
    assignUserModal: null,        // { seatId }
    syncLoading: false,
    scheduleAssignMap: {},        // seatId -> { MON: userName, ... }

    // --- Lifecycle ---
    async init() {
      try {
        this.user = await api.get('/api/auth/me');
      } catch {
        window.location.href = '/login.html';
        return;
      }
      await this.loadDashboard();
    },

    // --- Navigation ---
    async navigate(view) {
      this.currentView = view;
      this.error = null;
      const loaders = {
        dashboard: () => this.loadDashboard(),
        seats:     () => this.loadSeats(),
        schedule:  () => this.loadSchedules(),
        alerts:    () => this.loadAlerts(),
        admin:     () => this.loadAdmin()
      };
      if (loaders[view]) await loaders[view]();
    },

    async logout() {
      await api.post('/api/auth/logout');
      window.location.href = '/login.html';
    },

    // --- Dashboard ---
    async loadDashboard() {
      this.loading = true;
      try {
        const [sum, usage] = await Promise.all([
          api.get('/api/dashboard/summary'),
          api.get('/api/dashboard/usage/by-seat')
        ]);
        this.summary = sum;
        this.usageBySeat = usage;
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loading = false;
      }
    },

    // --- Seats ---
    async loadSeats() {
      this.loading = true;
      try {
        this.seats = await api.get('/api/seats');
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loading = false;
      }
    },

    // --- Schedules ---
    DAYS: ['T2', 'T3', 'T4', 'T5', 'T6'],
    DAY_KEYS: ['MON', 'TUE', 'WED', 'THU', 'FRI'],

    async loadSchedules() {
      this.loading = true;
      try {
        const [seats, today] = await Promise.all([
          api.get('/api/seats'),
          api.get('/api/schedules/today')
        ]);
        // Only seats with max_users == 3 shown in schedule view
        this.seats = seats;
        this.schedulesToday = today;
        // Build assignment map: seatId -> { MON: {userId, userName}, ... }
        this.scheduleAssignMap = {};
        for (const seat of seats) {
          const seatSchedules = await api.get('/api/schedules?seatId=' + seat.id);
          const map = {};
          for (const s of seatSchedules) {
            if (!map[s.day_of_week]) map[s.day_of_week] = [];
            map[s.day_of_week].push(s);
          }
          this.scheduleAssignMap[seat.id] = map;
        }
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loading = false;
      }
    },

    getScheduleEntry(seatId, dayKey) {
      const map = this.scheduleAssignMap[seatId];
      if (!map || !map[dayKey]) return null;
      return map[dayKey][0] || null;
    },

    // --- Alerts ---
    async loadAlerts() {
      this.loading = true;
      try {
        const [unresolved, resolved] = await Promise.all([
          api.get('/api/alerts?resolved=0'),
          api.get('/api/alerts?resolved=1')
        ]);
        this.alerts = unresolved;
        this.resolvedAlerts = resolved;
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loading = false;
      }
    },

    async resolveAlert(id) {
      try {
        await api.put('/api/alerts/' + id + '/resolve');
        await this.loadAlerts();
      } catch (e) {
        this.error = e.message;
      }
    },

  };
}
