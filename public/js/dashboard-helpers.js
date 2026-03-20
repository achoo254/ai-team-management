/**
 * dashboard-helpers.js
 * Pure utility/formatting helpers shared across the dashboard Alpine app.
 */

const dashboardHelpers = {
  isAdmin() {
    return this.user && this.user.role === 'admin';
  },

  fmtNum(val) {
    return (val || 0).toLocaleString('vi-VN');
  },

  userInitial(name) {
    return name ? name.charAt(0).toUpperCase() : '?';
  },

  teamBadgeClass(team) {
    const t = (team || '').toLowerCase();
    return t === 'mkt'
      ? 'bg-green-50 text-green-600 border-green-200'
      : 'bg-blue-50 text-blue-600 border-blue-200';
  },

  alertBorderClass(type) {
    if (type === 'session_spike' || type === 'limit_warning') return 'border-orange-400';
    if (type === 'high_usage') return 'border-red-400';
    return 'border-gray-300';
  },

  alertIconBgClass(type) {
    if (type === 'session_spike' || type === 'limit_warning') return 'bg-orange-50 text-orange-500';
    if (type === 'high_usage') return 'bg-red-50 text-red-500';
    return 'bg-gray-50 text-gray-500';
  },

  seatStatus(row) {
    if (row.total_sessions > 20) return 'critical';
    if (row.total_sessions > 10) return 'warning';
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
