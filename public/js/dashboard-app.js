/**
 * dashboard-app.js
 * Main Alpine.js application store for the AI Manager SPA.
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
      { key: 'dashboard',  label: 'Dashboard',   icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
      { key: 'log-usage',  label: 'Log Usage',   icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
      { key: 'seats',      label: 'Seats',        icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H4a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2h-1' },
      { key: 'schedule',   label: 'Lịch phân ca', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
      { key: 'teams',      label: 'Teams',        icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', adminOnly: true },
      { key: 'alerts',     label: 'Cảnh báo',     icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
      { key: 'admin',      label: 'Quản trị',     adminOnly: true, icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' }
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
    editUserModal: null,
    syncLoading: false,
    scheduleAssignMap: {},
    scheduleDragFrom: null, // drag source cell info

    // Log usage state
    logWeekStart: getCurrentWeekStart(),
    logSeats: [],   // [{ seatEmail, seatLabel, team, weeklyAllPct, weeklySonnetPct }]
    logError: null,
    logSuccess: null,
    logSubmitting: false,

    // --- Lifecycle ---
    async init() {
      try {
        const data = await api.get('/api/auth/me');
        this.user = data.user || data;
      } catch {
        window.location.href = '/login.html';
        return;
      }
      // Hash-based routing: navigate to #view on load
      const hash = window.location.hash.replace('#', '');
      const validViews = Object.keys(this._loaders());
      const startView = validViews.includes(hash) ? hash : 'dashboard';
      // Pre-load teams for dropdowns
      try { const td = await api.get('/api/teams'); this.teamsList = td.teams || []; } catch {}
      await this.navigate(startView);

      // Listen for browser back/forward
      window.addEventListener('hashchange', () => {
        const view = window.location.hash.replace('#', '') || 'dashboard';
        if (validViews.includes(view) && view !== this.currentView) {
          this.navigate(view);
        }
      });
    },

    // --- Navigation ---
    _loaders() {
      return {
        'dashboard':  () => this.loadDashboard(),
        'log-usage':  () => this.loadLogWeek(),
        'seats':      () => this.loadSeats(),
        'schedule':   () => this.loadSchedules(),
        'alerts':     () => this.loadAlerts(),
        'teams':      () => this.loadTeams(),
        'admin':      () => this.loadAdmin()
      };
    },

    async navigate(view) {
      this.currentView = view;
      this.error = null;
      // Sync URL hash without triggering hashchange loop
      if (window.location.hash !== '#' + view) {
        history.pushState(null, '', '#' + view);
      }
      const loaders = this._loaders();
      if (loaders[view]) await loaders[view]();
    },

    async logout() {
      await api.post('/api/auth/logout');
      window.location.href = '/login.html';
    },

    // --- Dashboard ---
    dashData: null,
    _charts: {},

    async loadDashboard() {
      this.loading = true;
      try {
        const [sumData, usageData, enhanced] = await Promise.all([
          api.get('/api/dashboard/summary'),
          api.get('/api/dashboard/usage/by-seat'),
          api.get('/api/dashboard/enhanced')
        ]);
        this.summary = sumData;
        this.usageBySeat = usageData.seats || [];
        this.dashData = enhanced;
        this.$nextTick(() => this.renderCharts());
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loading = false;
      }
    },

    renderCharts() {
      if (!this.dashData || typeof Chart === 'undefined') return;
      // Destroy old charts
      Object.values(this._charts).forEach(c => { try { c.destroy(); } catch {} });
      this._charts = {};

      const d = this.dashData;
      if (!d.usagePerSeat || !d.usageTrend || !d.teamUsage) return;
      const chartDefaults = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      };

      // Helper: only create chart if canvas has valid 2d context
      const safeChart = (id, config) => {
        const el = document.getElementById(id);
        if (!el || !el.getContext || !el.getContext('2d')) return null;
        try { return new Chart(el, config); } catch (e) { console.warn('Chart init failed:', id, e); return null; }
      };

      // 1. Seat usage bar chart
      this._charts.bar = safeChart('chart-seat-usage', {
        type: 'bar',
        data: {
          labels: d.usagePerSeat.map(s => s.label),
          datasets: [
            { label: 'All Models %', data: d.usagePerSeat.map(s => s.all_pct), backgroundColor: '#0d9488', borderRadius: 4 },
            { label: 'Sonnet %', data: d.usagePerSeat.map(s => s.sonnet_pct), backgroundColor: '#5eead4', borderRadius: 4 }
          ]
        },
        options: { ...chartDefaults, plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } },
          scales: { y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } } } }
      });

      // 2. Usage trend line chart
      if (d.usageTrend.length > 0) {
        this._charts.line = safeChart('chart-usage-trend', {
          type: 'line',
          data: {
            labels: d.usageTrend.map(t => fmtDateVN(t.week_start)),
            datasets: [
              { label: 'All Models', data: d.usageTrend.map(t => t.avg_all), borderColor: '#0d9488', backgroundColor: '#0d948820', fill: true, tension: 0.3 },
              { label: 'Sonnet', data: d.usageTrend.map(t => t.avg_sonnet), borderColor: '#f59e0b', backgroundColor: '#f59e0b20', fill: true, tension: 0.3 }
            ]
          },
          options: { ...chartDefaults, plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 11 } } } },
            scales: { y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } } } }
        });
      }

      // 3. Team usage doughnut
      if (d.teamUsage.length > 0) {
        this._charts.doughnut = safeChart('chart-team-usage', {
          type: 'doughnut',
          data: {
            labels: d.teamUsage.map(t => t.team.toUpperCase()),
            datasets: [{ data: d.teamUsage.map(t => t.avg_pct), backgroundColor: ['#3b82f6', '#22c55e'], borderWidth: 0 }]
          },
          options: { ...chartDefaults, cutout: '70%', plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } } }
        });
      }
    },

    // --- Seats ---
    seatAssignModal: null, // { seatId, seatLabel }
    editSeatModal: null, // { id?, email, label, team, max_users }
    allUsers: [],

    async loadSeats() {
      this.loading = true;
      try {
        const data = await api.get('/api/seats');
        this.seats = data.seats || [];
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loading = false;
      }
    },

    async unassignUser(seatId, userId) {
      if (!confirm('Xoá người dùng khỏi seat? Lịch phân ca của họ trên seat này cũng sẽ bị xoá.')) return;
      try {
        await api.delete('/api/seats/' + seatId + '/unassign/' + userId);
        await this.loadSeats();
      } catch (e) {
        alert('Lỗi: ' + e.message);
      }
    },

    async openAssignModal(seatId, seatLabel) {
      try {
        const data = await api.get('/api/admin/users');
        this.allUsers = data.users || [];
      } catch (e) {
        alert('Lỗi: ' + e.message);
        return;
      }
      this.seatAssignModal = { seatId, seatLabel };
    },

    // Get users not yet assigned to this seat
    availableUsersForSeat(seatId) {
      const seat = this.seats.find(s => s.id === seatId);
      const assignedIds = (seat?.users || []).map(u => u.id);
      return this.allUsers.filter(u => u.active && !assignedIds.includes(u.id));
    },

    async assignUserToSeat(userId) {
      if (!this.seatAssignModal) return;
      try {
        await api.post('/api/seats/' + this.seatAssignModal.seatId + '/assign', { userId });
        this.seatAssignModal = null;
        await this.loadSeats();
      } catch (e) {
        alert('Lỗi: ' + e.message);
      }
    },

    // --- Seat CRUD ---
    openNewSeatModal() {
      this.editSeatModal = { email: '', label: '', team: 'dev', max_users: 3 };
    },

    openEditSeatModal(seat) {
      this.editSeatModal = { id: seat.id, email: seat.email, label: seat.label, team: seat.team, max_users: seat.max_users };
    },

    async saveSeat() {
      if (!this.editSeatModal) return;
      try {
        if (this.editSeatModal.id) {
          await api.put('/api/seats/' + this.editSeatModal.id, this.editSeatModal);
        } else {
          await api.post('/api/seats', this.editSeatModal);
        }
        this.editSeatModal = null;
        await this.loadSeats();
      } catch (e) {
        alert('Lỗi: ' + e.message);
      }
    },

    async deleteSeat(id) {
      if (!confirm('Xoá seat này? Tất cả user sẽ bị bỏ assign và lịch phân ca sẽ bị xoá.')) return;
      try {
        await api.delete('/api/seats/' + id);
        await this.loadSeats();
      } catch (e) {
        alert('Lỗi: ' + e.message);
      }
    },

    // --- Schedules ---
    DAYS: ['T2', 'T3', 'T4', 'T5', 'T6'],

    async loadSchedules() {
      this.loading = true;
      try {
        const seatData = await api.get('/api/seats');
        this.seats = seatData.seats || [];
        // Build assignment map per seat
        this.scheduleAssignMap = {};
        for (const seat of this.seats) {
          // Load schedules for all seats
          const schedData = await api.get('/api/schedules?seatId=' + seat.id);
          const entries = schedData.schedules || [];
          const map = {};
          for (const s of entries) {
            const key = s.day_of_week + '_' + s.slot;
            map[key] = s;
          }
          this.scheduleAssignMap[seat.id] = map;
        }
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loading = false;
      }
    },

    getScheduleEntry(seatId, dayIndex, slot) {
      const map = this.scheduleAssignMap[seatId];
      if (!map) return null;
      return map[dayIndex + '_' + slot] || null;
    },

    // --- Drag & Drop schedule ---
    onScheduleDragStart(event, seatId, dayIndex, slot) {
      if (!this.isAdmin()) return event.preventDefault();
      this.scheduleDragFrom = { seatId, dayOfWeek: dayIndex, slot };
      event.dataTransfer.effectAllowed = 'move';
      event.target.classList.add('opacity-50');
    },

    onScheduleDragEnd(event) {
      event.target.classList.remove('opacity-50');
      this.scheduleDragFrom = null;
    },

    onScheduleDragOver(event, seatId) {
      if (!this.scheduleDragFrom) return;
      if (this.scheduleDragFrom.seatId !== seatId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = this.scheduleDragFrom.fromMemberList ? 'copy' : 'move';
    },

    onScheduleDragEnter(event, seatId) {
      if (!this.scheduleDragFrom) return;
      if (this.scheduleDragFrom.seatId !== seatId) return;
      event.preventDefault();
      event.currentTarget.classList.add('bg-teal-50');
    },

    onScheduleDragLeave(event) {
      event.currentTarget.classList.remove('bg-teal-50');
    },

    // Clear all schedule entries
    async clearAllSchedules() {
      if (!confirm('Xoá toàn bộ lịch phân ca?')) return;
      try {
        await api.delete('/api/schedules/all');
        await this.loadSchedules();
      } catch (e) {
        alert('Lỗi: ' + e.message);
      }
    },

    // Clear a single schedule entry
    async clearScheduleEntry(seatId, dayIndex, slot) {
      try {
        await api.delete('/api/schedules/entry', { seatId, dayOfWeek: dayIndex, slot });
        await this.loadSchedules();
      } catch (e) {
        alert('Lỗi: ' + e.message);
      }
    },

    // Drag member from sidebar into schedule cell
    onMemberDragStart(event, seatId, userId, userName) {
      if (!this.isAdmin()) return event.preventDefault();
      this.scheduleDragFrom = { seatId, userId, userName, fromMemberList: true };
      event.dataTransfer.effectAllowed = 'copy';
      event.target.classList.add('opacity-50');
    },

    // Override drop to handle both cell-to-cell swap and member-to-cell assign
    async onScheduleDrop(event, seatId, dayIndex, slot) {
      event.currentTarget.classList.remove('bg-teal-50');
      const from = this.scheduleDragFrom;
      if (!from) return;

      // Member list → cell assign
      if (from.fromMemberList) {
        if (from.seatId !== seatId) return;
        try {
          await api.post('/api/schedules/assign', {
            seatId, userId: from.userId, dayOfWeek: dayIndex, slot
          });
          await this.loadSchedules();
        } catch (e) {
          alert('Lỗi: ' + e.message);
        }
        return;
      }

      // Cell-to-cell swap/move
      if (from.seatId === seatId && from.dayOfWeek === dayIndex && from.slot === slot) return;
      try {
        await api.patch('/api/schedules/swap', {
          from,
          to: { seatId, dayOfWeek: dayIndex, slot }
        });
        await this.loadSchedules();
      } catch (e) {
        alert('Lỗi: ' + e.message);
      }
    },

    // Get users assigned to a seat (for member sidebar)
    getSeatUsers(seatId) {
      const seat = this.seats.find(s => s.id === seatId);
      return seat?.users || [];
    },

    // --- Teams ---
    teamsList: [],
    editTeamModal: null,

    async loadTeams() {
      this.loading = true;
      try {
        const data = await api.get('/api/teams');
        this.teamsList = data.teams || [];
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loading = false;
      }
    },

    openNewTeamModal() {
      this.editTeamModal = { name: '', label: '', color: '#3b82f6' };
    },

    openEditTeamModal(t) {
      this.editTeamModal = { id: t.id, name: t.name, label: t.label, color: t.color };
    },

    async saveTeam() {
      if (!this.editTeamModal) return;
      try {
        if (this.editTeamModal.id) {
          await api.put('/api/teams/' + this.editTeamModal.id, this.editTeamModal);
        } else {
          await api.post('/api/teams', this.editTeamModal);
        }
        this.editTeamModal = null;
        await this.loadTeams();
      } catch (e) {
        alert('Lỗi: ' + e.message);
      }
    },

    async deleteTeam(id) {
      if (!confirm('Xoá team này?')) return;
      try {
        await api.delete('/api/teams/' + id);
        await this.loadTeams();
      } catch (e) {
        alert('Lỗi: ' + e.message);
      }
    },

    // --- Alerts ---
    async loadAlerts() {
      this.loading = true;
      try {
        const [unData, resData] = await Promise.all([
          api.get('/api/alerts?resolved=0'),
          api.get('/api/alerts?resolved=1')
        ]);
        this.alerts = unData.alerts || [];
        this.resolvedAlerts = resData.alerts || [];
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

    // --- Log Usage ---
    changeLogWeek(delta) {
      this.logWeekStart = shiftWeek(this.logWeekStart, delta);
      this.loadLogWeek();
    },

    async loadLogWeek() {
      this.loading = true;
      try {
        const data = await api.get('/api/usage-log/week?weekStart=' + this.logWeekStart);
        this.logSeats = (data.seats || []).map(s => ({
          seatEmail: s.seatEmail,
          seatLabel: s.seatLabel,
          team: s.team,
          weeklyAllPct: s.weeklyAllPct ?? 0,
          weeklySonnetPct: s.weeklySonnetPct ?? 0,
        }));
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loading = false;
      }
    },

    async submitLog() {
      this.logError = null;
      this.logSuccess = null;
      this.logSubmitting = true;
      try {
        const entries = this.logSeats.map(s => ({
          seatEmail: s.seatEmail,
          weeklyAllPct: s.weeklyAllPct,
          weeklySonnetPct: s.weeklySonnetPct,
        }));
        await api.post('/api/usage-log/bulk', { weekStart: this.logWeekStart, entries });
        this.logSuccess = 'Ghi nhận thành công!';
      } catch (e) {
        this.logError = e.message;
      } finally {
        this.logSubmitting = false;
      }
    },

  };
}
