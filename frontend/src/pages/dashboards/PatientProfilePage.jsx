/**
 * PATIENT PROFILE PAGE — PatientProfilePage.jsx
 * ===============================================
 * Medical profile management for patients.
 */

import { useState, useEffect } from 'react';
import { FiHome, FiPlusCircle, FiCalendar, FiHeart, FiBell, FiTrendingUp, FiSave, FiEdit2, FiAlertCircle, FiUser, FiActivity, FiUsers } from 'react-icons/fi';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { patientService } from '../../api/patient.service';
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

const PatientProfilePage = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  // Form state
  const [formData, setFormData] = useState({
    dateOfBirth: '',
    gender: 'prefer_not_to_say',
    bloodGroup: 'Unknown',
    height: '',
    weight: '',
    chronicDiseases: '',
    allergies: '',
    pastSurgeries: '',
    emergencyContactName: '',
    emergencyContactRelation: '',
    emergencyContactPhone: '',
  });

  // Fetch existing profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await patientService.getProfile();
        if (data) {
          // Map DB response to form state
          setFormData({
            dateOfBirth: data.dateOfBirth ? data.dateOfBirth.split('T')[0] : '', // YYYY-MM-DD
            gender: data.gender || 'prefer_not_to_say',
            bloodGroup: data.bloodGroup || 'Unknown',
            height: data.height || '',
            weight: data.weight || '',
            chronicDiseases: data.medicalHistory?.chronicDiseases?.join(', ') || '',
            allergies: data.medicalHistory?.allergies?.join(', ') || '',
            pastSurgeries: data.medicalHistory?.pastSurgeries?.join(', ') || '',
            emergencyContactName: data.emergencyContact?.name || '',
            emergencyContactRelation: data.emergencyContact?.relation || '',
            emergencyContactPhone: data.emergencyContact?.phone || '',
          });
        }
      } catch (error) {
        if (error.response?.status === 404) {
          // Normal if they haven't created a profile yet
          setIsEditing(true); 
          toast("Please complete your medical profile setup.", { icon: '👋' });
        } else {
          toast.error("Failed to load medical profile");
        }
      } finally {
        setIsFetching(false);
      }
    };
    fetchProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!formData.dateOfBirth) {
      toast.error("Date of birth is required");
      return;
    }

    setIsLoading(true);
    try {
      // Map form state back to DB structure
      const payload = {
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        bloodGroup: formData.bloodGroup,
        height: formData.height ? Number(formData.height) : null,
        weight: formData.weight ? Number(formData.weight) : null,
        medicalHistory: {
          chronicDiseases: formData.chronicDiseases ? formData.chronicDiseases.split(',').map(s => s.trim()) : [],
          allergies: formData.allergies ? formData.allergies.split(',').map(s => s.trim()) : [],
          pastSurgeries: formData.pastSurgeries ? formData.pastSurgeries.split(',').map(s => s.trim()) : [],
        },
        emergencyContact: {
          name: formData.emergencyContactName,
          relation: formData.emergencyContactRelation,
          phone: formData.emergencyContactPhone,
        }
      };

      await patientService.upsertProfile(payload);
      toast.success('Medical Profile saved successfully!');
      setIsEditing(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save profile.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <DashboardLayout navItems={NAV_ITEMS} title="Medical Profile">
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout navItems={NAV_ITEMS} title="Medical Profile">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header Action */}
        <div className="flex justify-between items-center glass-card p-4">
          <div>
            <h2 className="text-xl font-bold text-white">Your Health Profile</h2>
            <p className="text-white/50 text-sm">Keep your medical data accurate for better care.</p>
          </div>
          {!isEditing && (
            <Button onClick={() => setIsEditing(true)} className="flex items-center gap-2">
              <FiEdit2 className="w-4 h-4" /> Edit Profile
            </Button>
          )}
        </div>

        {/* Form Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* SECTION 1: Personal Health Info */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-white font-semibold flex items-center gap-2 mb-4 border-b border-white/10 pb-2">
              <FiUser className="w-4 h-4 text-teal-400" /> Basic Details
            </h3>

            <Input
              id="dateOfBirth" name="dateOfBirth" type="date" label="Date of Birth *"
              value={formData.dateOfBirth} onChange={handleChange} disabled={!isEditing}
              className={!isEditing ? 'opacity-60' : ''}
            />

            <div>
              <label className="input-label">Gender *</label>
              <select
                name="gender" value={formData.gender} onChange={handleChange} disabled={!isEditing}
                className={`input-field ${!isEditing ? 'opacity-60' : ''}`}
              >
                <option value="male" className="bg-slate-800 text-white">Male</option>
                <option value="female" className="bg-slate-800 text-white">Female</option>
                <option value="other" className="bg-slate-800 text-white">Other</option>
                <option value="prefer_not_to_say" className="bg-slate-800 text-white">Prefer not to say</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Blood Group</label>
                <select
                  name="bloodGroup" value={formData.bloodGroup} onChange={handleChange} disabled={!isEditing}
                  className={`input-field ${!isEditing ? 'opacity-60' : ''}`}
                >
                  {["Unknown", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(bg => (
                    <option key={bg} value={bg} className="bg-slate-800 text-white">{bg}</option>
                  ))}
                </select>
              </div>
              <Input
                id="height" name="height" type="number" label="Height (cm)"
                value={formData.height} onChange={handleChange} disabled={!isEditing}
                className={!isEditing ? 'opacity-60' : ''} placeholder="e.g. 175"
              />
            </div>
            
            <Input
              id="weight" name="weight" type="number" label="Weight (kg)"
              value={formData.weight} onChange={handleChange} disabled={!isEditing}
              className={!isEditing ? 'opacity-60' : ''} placeholder="e.g. 70"
            />
          </div>

          {/* SECTION 2: Medical History */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="text-white font-semibold flex items-center gap-2 mb-4 border-b border-white/10 pb-2">
              <FiActivity className="w-4 h-4 text-rose-400" /> Medical History
            </h3>
            
            <p className="text-white/30 text-xs mb-2">Separate multiple items with commas (e.g. "Diabetes, Asthma")</p>

            <Input
              id="chronicDiseases" name="chronicDiseases" label="Chronic Diseases"
              value={formData.chronicDiseases} onChange={handleChange} disabled={!isEditing}
              className={!isEditing ? 'opacity-60' : ''} placeholder="None"
            />
            
            <Input
              id="allergies" name="allergies" label="Allergies"
              value={formData.allergies} onChange={handleChange} disabled={!isEditing}
              className={!isEditing ? 'opacity-60' : ''} placeholder="Penicillin, Peanuts..."
            />
            
            <Input
              id="pastSurgeries" name="pastSurgeries" label="Past Surgeries"
              value={formData.pastSurgeries} onChange={handleChange} disabled={!isEditing}
              className={!isEditing ? 'opacity-60' : ''} placeholder="Appendectomy (2018)"
            />
          </div>

          {/* SECTION 3: Emergency Contact */}
          <div className="glass-card p-6 space-y-4 md:col-span-2">
            <h3 className="text-white font-semibold flex items-center gap-2 mb-4 border-b border-white/10 pb-2">
              <FiAlertCircle className="w-4 h-4 text-orange-400" /> Emergency Contact
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                id="emergencyContactName" name="emergencyContactName" label="Contact Name"
                value={formData.emergencyContactName} onChange={handleChange} disabled={!isEditing}
                className={!isEditing ? 'opacity-60' : ''} placeholder="Jane Doe"
              />
              <Input
                id="emergencyContactRelation" name="emergencyContactRelation" label="Relationship"
                value={formData.emergencyContactRelation} onChange={handleChange} disabled={!isEditing}
                className={!isEditing ? 'opacity-60' : ''} placeholder="Spouse"
              />
              <Input
                id="emergencyContactPhone" name="emergencyContactPhone" label="Phone Number"
                value={formData.emergencyContactPhone} onChange={handleChange} disabled={!isEditing}
                className={!isEditing ? 'opacity-60' : ''} placeholder="+1 234 567 890"
              />
            </div>
          </div>

        </div>

        {/* Save/Cancel Footer */}
        {isEditing && (
          <div className="flex gap-4 justify-end glass-card p-4">
            <Button variant="secondary" onClick={() => setIsEditing(false)} className="w-32">
              Cancel
            </Button>
            <Button onClick={handleSave} isLoading={isLoading} className="w-48">
              <FiSave className="w-4 h-4 mr-2" />
              {isLoading ? 'Saving...' : 'Save Profile'}
            </Button>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};

export default PatientProfilePage;
