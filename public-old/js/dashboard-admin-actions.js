/**
 * dashboard-admin-actions.js
 * Admin-specific Alpine.js methods: user CRUD, data sync.
 * Spread into dashboardApp() via ...dashboardAdminActions.
 */

const dashboardAdminActions = {
  async loadAdmin() {
    this.loading = true;
    try {
      const [usersData, seatsData] = await Promise.all([
        api.get('/api/admin/users'),
        api.get('/api/seats')
      ]);
      this.adminUsers = usersData.users || [];
      this.seats = seatsData.seats || [];
    } catch (e) {
      this.error = e.message;
    } finally {
      this.loading = false;
    }
  },

  openNewUserModal() {
    this.editUserModal = { name: '', email: '', role: 'user', team: 'dev', seatId: '', active: true };
  },

  openEditUserModal(u) {
    this.editUserModal = { ...u, active: !!u.active };
  },

  async saveUser() {
    try {
      if (this.editUserModal.id) {
        await api.put('/api/admin/users/' + this.editUserModal.id, this.editUserModal);
      } else {
        await api.post('/api/admin/users', this.editUserModal);
      }
      this.editUserModal = null;
      await this.loadAdmin();
    } catch (e) {
      alert('Lỗi: ' + e.message);
    }
  },

  async deleteUser(id) {
    if (!confirm('Xoá người dùng này?')) return;
    try {
      await api.delete('/api/admin/users/' + id);
      await this.loadAdmin();
    } catch (e) {
      this.error = e.message;
    }
  },

  async toggleUserActive(userId, currentActive) {
    try {
      await api.put('/api/admin/users/' + userId, { active: !currentActive });
      await this.loadAdmin();
    } catch (e) {
      alert('Lỗi: ' + e.message);
    }
  },

  async bulkSetActive(active) {
    const label = active ? 'kích hoạt' : 'tắt';
    if (!confirm('Bạn có chắc muốn ' + label + ' tất cả tài khoản?')) return;
    try {
      await api.patch('/api/admin/users/bulk-active', { active });
      await this.loadAdmin();
    } catch (e) {
      alert('Lỗi: ' + e.message);
    }
  },

  async sendTelegramReport() {
    try {
      this.syncLoading = true;
      await api.post('/api/admin/send-report');
      alert('Đã gửi báo cáo qua Telegram!');
    } catch (e) {
      alert('Lỗi: ' + e.message);
    } finally {
      this.syncLoading = false;
    }
  },

  async checkAlerts() {
    this.syncLoading = true;
    try {
      const result = await api.post('/api/admin/check-alerts');
      alert('Kiểm tra hoàn tất: ' + (result.alertsCreated || 0) + ' cảnh báo mới');
    } catch (e) {
      alert('Lỗi: ' + e.message);
    } finally {
      this.syncLoading = false;
    }
  },
};
