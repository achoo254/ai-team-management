/**
 * dashboard-admin-actions.js
 * Admin-specific Alpine.js methods: user CRUD, seat assignment, data sync.
 * Spread into dashboardApp() via ...dashboardAdminActions.
 */

const dashboardAdminActions = {
  async loadAdmin() {
    this.loading = true;
    try {
      const [users, seats] = await Promise.all([
        api.get('/api/admin/users'),
        api.get('/api/seats')
      ]);
      this.adminUsers = users;
      this.seats = seats;
    } catch (e) {
      this.error = e.message;
    } finally {
      this.loading = false;
    }
  },

  openNewUserModal() {
    this.editUserModal = { name: '', email: '', password: '', role: 'user', team: 'DEV', seatId: '' };
  },

  openEditUserModal(u) {
    this.editUserModal = { ...u, password: '' };
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

  async syncData() {
    this.syncLoading = true;
    try {
      await api.post('/api/admin/sync');
      alert('Đồng bộ thành công!');
    } catch (e) {
      alert('Lỗi đồng bộ: ' + e.message);
    } finally {
      this.syncLoading = false;
    }
  }
};
