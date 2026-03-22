/**
 * dashboard-helpers.js
 * Pure utility/formatting helpers shared across the dashboard Alpine app.
 */

/** Get Monday of current week as YYYY-MM-DD */
function getCurrentWeekStart() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.getFullYear(), now.getMonth(), diff);
  return monday.toISOString().split('T')[0];
}

/** Format yyyy-MM-dd to dd/MM/yyyy */
function fmtDateVN(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return d + '/' + m + '/' + y;
}

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
    if (t === 'mkt') return 'bg-green-50 text-green-600 border-green-200';
    if (t === 'dev') return 'bg-blue-50 text-blue-600 border-blue-200';
    return 'bg-purple-50 text-purple-600 border-purple-200';
  },

  alertBorderClass(type) {
    if (type === 'high_usage') return 'border-red-400';
    return 'border-gray-300';
  },

  alertIconBgClass(type) {
    if (type === 'high_usage') return 'bg-red-50 text-red-500';
    return 'bg-gray-50 text-gray-500';
  },

  /** Return CSS color class based on usage percentage */
  usagePctClass(pct) {
    if (pct >= 80) return 'text-red-500';
    if (pct >= 50) return 'text-yellow-600';
    return 'text-green-600';
  },

  seatStatus(row) {
    if (row.weekly_all_pct >= 80) return 'critical';
    if (row.weekly_all_pct >= 50) return 'warning';
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
