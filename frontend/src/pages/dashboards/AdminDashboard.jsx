/**
 * ADMIN DASHBOARD — AdminDashboard.jsx
 * Only accessible to users with role = "admin".
 */

import { useState, useEffect } from 'react';
import { FiHome, FiUsers, FiShield, FiBarChart2, FiSettings, FiActivity, FiEdit2, FiTrash2, FiSearch, FiX } from 'react-icons/fi';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../api/admin.service';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  { to: '/dashboard/admin', icon: FiHome,      label: 'Dashboard' },
  { to: '/admin/users',     icon: FiUsers,     label: 'All Users' },
  { to: '/admin/roles',     icon: FiShield,    label: 'Roles & Permissions' },
  { to: '/admin/analytics', icon: FiBarChart2, label: 'Analytics' },
  { to: '/admin/system',    icon: FiSettings,  label: 'System Settings' },
];

const AdminDashboard = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [isFetching, setIsFetching] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Edit modal state
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', email: '', role: '', isActive: true });
  const [isSaving, setIsSaving] = useState(false);

  const fetchUsers = async () => {
    setIsFetching(true);
    try {
      const { data } = await adminService.getAllUsers();
      setUsers(data.users || []);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDelete = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;
    
    try {
      await adminService.deleteUser(userId);
      toast.success('User deleted successfully');
      setUsers(users.filter(u => u._id !== userId));
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  const openEditModal = (u) => {
    setEditingUser(u);
    setEditForm({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.role,
      isActive: u.isActive
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await adminService.updateUser(editingUser._id, editForm);
      toast.success('User updated successfully');
      setEditingUser(null);
      fetchUsers(); // Refresh the list
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update user');
    } finally {
      setIsSaving(false);
    }
  };

  // Filter users based on search
  const filteredUsers = users.filter(u => 
    u.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Compute stats
  const totalUsers = users.length;
  const activePatients = users.filter(u => u.role === 'patient').length;
  const totalCaregivers = users.filter(u => u.role === 'caregiver').length;
  const totalDoctors = users.filter(u => u.role === 'doctor').length;
  const totalAdmins = users.filter(u => u.role === 'admin').length;

  return (
    <DashboardLayout navItems={NAV_ITEMS} title="Admin Dashboard">

      <div className="glass-card p-6 mb-6 bg-gradient-to-r from-red-600/20 to-orange-600/10 border-red-500/20">
        <h2 className="text-2xl font-bold text-white">System Overview ⚙️</h2>
        <p className="text-white/50 mt-1">
          Logged in as <span className="text-red-400 font-semibold">Super Admin</span> · {user?.email}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center mb-4`}>
            <FiUsers className="w-5 h-5 text-white" />
          </div>
          <div className="text-2xl font-bold text-white">{totalUsers}</div>
          <div className="text-white/60 text-sm">Total Users</div>
        </div>
        <div className="stat-card">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-teal-400 flex items-center justify-center mb-4`}>
            <FiActivity className="w-5 h-5 text-white" />
          </div>
          <div className="text-2xl font-bold text-white">{activePatients}</div>
          <div className="text-white/60 text-sm">Patients</div>
        </div>
        <div className="stat-card">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-purple-400 flex items-center justify-center mb-4`}>
            <FiShield className="w-5 h-5 text-white" />
          </div>
          <div className="text-2xl font-bold text-white">{totalCaregivers}</div>
          <div className="text-white/60 text-sm">Caregivers</div>
        </div>
        <div className="stat-card">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-green-600 to-green-400 flex items-center justify-center mb-4`}>
            <FiShield className="w-5 h-5 text-white" />
          </div>
          <div className="text-2xl font-bold text-white">{totalDoctors}</div>
          <div className="text-white/60 text-sm">Doctors</div>
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <FiUsers className="w-5 h-5 text-red-400" /> User Management
          </h3>
          <div className="w-full sm:w-64">
            <Input 
              icon={FiSearch} 
              placeholder="Search users..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {isFetching ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-400"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-white/50 text-sm">
                  <th className="pb-3 px-4 font-medium">Name</th>
                  <th className="pb-3 px-4 font-medium">Email</th>
                  <th className="pb-3 px-4 font-medium">Role</th>
                  <th className="pb-3 px-4 font-medium">Status</th>
                  <th className="pb-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-white/50">No users found.</td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u._id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                      <td className="py-4 px-4 text-white font-medium flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs">
                          {u.firstName?.[0]}{u.lastName?.[0]}
                        </div>
                        {u.firstName} {u.lastName}
                      </td>
                      <td className="py-4 px-4 text-white/70 text-sm">{u.email}</td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium bg-white/10 ${
                          u.role === 'admin' ? 'text-red-400' :
                          u.role === 'doctor' ? 'text-green-400' :
                          u.role === 'caregiver' ? 'text-purple-400' : 'text-blue-400'
                        }`}>
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`flex items-center gap-1 text-sm ${u.isActive ? 'text-green-400' : 'text-red-400'}`}>
                          <div className={`w-2 h-2 rounded-full ${u.isActive ? 'bg-green-400' : 'bg-red-400'}`} />
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => openEditModal(u)}
                            className="p-2 bg-white/5 hover:bg-white/10 text-white rounded transition-colors"
                            title="Edit User"
                          >
                            <FiEdit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(u._id)}
                            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                            title="Delete User"
                            disabled={u._id === user._id} // Prevent deleting oneself
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="glass-card w-full max-w-md p-6 bg-gray-900 border-white/20">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Edit User</h3>
              <button onClick={() => setEditingUser(null)} className="text-white/50 hover:text-white">
                <FiX className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-white/50 ml-1">First Name</label>
                  <Input 
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({...editForm, firstName: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-white/50 ml-1">Last Name</label>
                  <Input 
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({...editForm, lastName: e.target.value})}
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="text-xs text-white/50 ml-1">Email</label>
                <Input 
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-white/50 ml-1">Role</label>
                <select 
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  value={editForm.role}
                  onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                >
                  <option value="patient" className="bg-gray-800">Patient</option>
                  <option value="caregiver" className="bg-gray-800">Caregiver</option>
                  <option value="doctor" className="bg-gray-800">Doctor</option>
                  <option value="admin" className="bg-gray-800">Admin</option>
                </select>
              </div>

              <div className="flex items-center gap-3 py-2">
                <input 
                  type="checkbox" 
                  id="isActive" 
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500/50"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({...editForm, isActive: e.target.checked})}
                />
                <label htmlFor="isActive" className="text-sm text-white/80 select-none cursor-pointer">
                  Account is Active
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="secondary" onClick={() => setEditingUser(null)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" isLoading={isSaving} className="flex-1">
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
};

export default AdminDashboard;
