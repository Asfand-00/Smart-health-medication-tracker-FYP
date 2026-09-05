/**
 * CARE TEAM PAGE — CareTeamPage.jsx
 * =====================================
 * Allows patients to view available caregivers, send requests, and manage their care team.
 */

import { useState, useEffect } from 'react';
import { FiHome, FiHeart, FiPlusCircle, FiActivity, FiUsers, FiCalendar, FiBell, FiTrendingUp, FiTrash2, FiUserPlus, FiClock } from 'react-icons/fi';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Button from '../../components/ui/Button';
import { caregiverService } from '../../api/caregiver.service';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  { to: '/dashboard/patient',                  icon: FiHome,       label: 'Dashboard' },
  { to: '/dashboard/patient/medical-profile',  icon: FiHeart,      label: 'Medical Profile' },
  { to: '/medications',                        icon: FiPlusCircle, label: 'Medications' },
  { to: '/vitals',                             icon: FiActivity,   label: 'Health Vitals' },
  { to: '/dashboard/patient/care-team',        icon: FiUsers,      label: 'Care Team' },
  { to: '/schedule',                           icon: FiCalendar,   label: 'Schedule' },
  { to: '/reminders',                          icon: FiBell,       label: 'Reminders' },
  { to: '/progress',                           icon: FiTrendingUp, label: 'Progress' },
];

const CareTeamPage = () => {
  const [team, setTeam] = useState([]);
  const [availableCaregivers, setAvailableCaregivers] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isRequesting, setIsRequesting] = useState(null);

  const fetchData = async () => {
    setIsFetching(true);
    try {
      const [teamRes, availableRes, requestsRes] = await Promise.all([
        caregiverService.getMyTeam(),
        caregiverService.getAvailableCaregivers(),
        caregiverService.getPatientRequests()
      ]);
      setTeam(teamRes.data || []);
      setAvailableCaregivers(availableRes.data || []);
      setSentRequests(requestsRes.data || []);
    } catch (error) {
      toast.error('Failed to load care team data');
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRequest = async (caregiverId) => {
    setIsRequesting(caregiverId);
    try {
      await caregiverService.requestCaregiver(caregiverId);
      toast.success('Request sent successfully!');
      fetchData(); // Refresh the list
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send request');
    } finally {
      setIsRequesting(null);
    }
  };

  const getRequestStatus = (caregiverId) => {
    const request = sentRequests.find(req => req.caregiverId?._id === caregiverId);
    if (!request) return null;
    return request.status;
  };

  return (
    <DashboardLayout navItems={NAV_ITEMS} title="My Care Team">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Your Caregivers</h2>
            <p className="text-white/50 text-sm">Manage the people who can view and manage your health records.</p>
          </div>
          <Button onClick={() => setIsAdding(!isAdding)} className="flex items-center gap-2" variant={isAdding ? "secondary" : "primary"}>
            <FiUserPlus className="w-5 h-5" /> {isAdding ? 'View My Team' : 'Find Caregiver'}
          </Button>
        </div>

        {isFetching ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400"></div>
          </div>
        ) : isAdding ? (
          /* Available Caregivers List */
          <div className="glass-card p-6 bg-gradient-to-r from-purple-900/30 to-blue-900/20">
            <h3 className="text-lg font-semibold text-white mb-4">Available Caregivers</h3>
            {availableCaregivers.length === 0 ? (
              <p className="text-white/50 text-sm">No caregivers available at the moment.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableCaregivers.map((caregiver) => {
                  const status = getRequestStatus(caregiver._id);
                  const isAssigned = team.some(t => t._id === caregiver._id);

                  return (
                    <div key={caregiver._id} className="glass-card p-5 relative hover:bg-white/[0.03] transition-colors group flex flex-col gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 text-purple-300 flex items-center justify-center font-bold text-lg flex-shrink-0">
                          {caregiver.firstName?.[0]}{caregiver.lastName?.[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-lg font-semibold text-white leading-tight truncate">
                            {caregiver.firstName} {caregiver.lastName}
                          </h4>
                          <p className="text-white/50 text-sm truncate">{caregiver.email}</p>
                        </div>
                      </div>
                      
                      {isAssigned ? (
                        <div className="text-green-400 text-sm flex items-center gap-2 justify-center py-2 bg-green-500/10 rounded-lg">
                          <FiUsers /> Already in Team
                        </div>
                      ) : status === 'pending' ? (
                        <div className="text-yellow-400 text-sm flex items-center gap-2 justify-center py-2 bg-yellow-500/10 rounded-lg">
                          <FiClock /> Request Pending
                        </div>
                      ) : status === 'declined' ? (
                        <div className="text-red-400 text-sm flex items-center gap-2 justify-center py-2 bg-red-500/10 rounded-lg">
                          Request Declined
                        </div>
                      ) : (
                        <Button 
                          onClick={() => handleRequest(caregiver._id)}
                          isLoading={isRequesting === caregiver._id}
                          className="w-full"
                        >
                          Send Request
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* My Team List */
          <>
            {team.length === 0 ? (
              <div className="glass-card p-12 text-center border-dashed border-white/20">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FiUsers className="w-8 h-8 text-white/30" />
                </div>
                <h3 className="text-lg font-medium text-white mb-1">No Caregivers Assigned</h3>
                <p className="text-white/40 text-sm max-w-md mx-auto">
                  You haven't assigned anyone to your care team yet. Finding a caregiver allows them to monitor your medications and vitals.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {team.map((caregiver) => (
                  <div key={caregiver._id} className="glass-card p-5 relative hover:bg-white/[0.03] transition-colors group flex items-center gap-4 border-green-500/20">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-teal-500/20 text-green-300 flex items-center justify-center font-bold text-lg flex-shrink-0">
                      {caregiver.firstName?.[0]}{caregiver.lastName?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-lg font-semibold text-white leading-tight truncate">
                        {caregiver.firstName} {caregiver.lastName}
                      </h4>
                      <p className="text-white/50 text-sm truncate">{caregiver.email}</p>
                      {caregiver.phone && (
                        <p className="text-white/40 text-xs mt-1">{caregiver.phone}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

      </div>
    </DashboardLayout>
  );
};

export default CareTeamPage;
