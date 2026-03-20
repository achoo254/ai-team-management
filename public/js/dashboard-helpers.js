/**
 * dashboard-helpers.js
 * Pure utility/formatting helpers shared across the dashboard Alpine app.
 * Loaded before dashboard-app.js.
 */

const dashboardHelpers = {
  isAdmin() {
    return this.user && this.user.role === 'admin';
  },

  fmtCost(val) {
    return '$' + (val || 0).toFixed(2);
  },

  fmtNum(val) {
    return (val || 0).toLocaleString('vi-VN');
  },

  userInitial(name) {
    return name ? name.charAt(0).toUpperCase() : '?';
  },

  teamBadgeClass(team) {
    return team === 'MKT'
      ? 'bg-green-50 text-green-600 border border-green-200'
      : 'bg-blue-50 text-blue-600 border border-blue-200';
  },

  alertBorderClass(type) {
    return type === 'critical' ? 'border-red-400' : 'border-orange-400';
  },

  alertIconClass(type) {
    return type === 'critical' ? 'text-red-500' : 'text-orange-500';
  },

  seatStatus(row) {
    if (row.total_cost > 200) return 'critical';
    if (row.total_cost > 100) return 'warning';
    return 'normal';
  },

  timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return mins + ' phút trước';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + ' giờ trước';
    return Math.floor(hrs / 24) + ' ngày trước';
  }
};
