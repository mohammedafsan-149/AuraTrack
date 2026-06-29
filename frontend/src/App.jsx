import React, { useState, useEffect } from 'react';
import { 
  Users, UserCheck, ShieldAlert, Settings, BarChart3, LogOut, 
  MapPin, LogIn, Camera, History, CheckSquare, Plus, Edit, Trash2, X,
  User, Search, FileText
} from 'lucide-react';
import { Chart as ChartJS, registerables } from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import * as faceapiImport from 'face-api.js';
const faceapi = faceapiImport.nets ? faceapiImport : (faceapiImport.default || faceapiImport);

ChartJS.register(...registerables);

// --- Component imports or inline implementations for quick compilation ---
export default function App() {
  const [token, setToken] = useState(sessionStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(sessionStorage.getItem('user')) || null);
  const [activeTab, setActiveTab] = useState('');
  
  // Auth state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginRole, setLoginRole] = useState('student');
  const [loginError, setLoginError] = useState('');

  // Forgot Password State
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotRole, setForgotRole] = useState('student');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState('login'); // 'login', 'request', 'reset'
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');

  // Theme control state
  const [theme, setTheme] = useState(localStorage.getItem('systemTheme') || 'purple');

  // Org Name Settings State
  const [publicSettings, setPublicSettings] = useState({ org_name: '', enable_org_name: false });

  // Global settings state
  const [gpsRadius, setGpsRadius] = useState(100);

  const fetchPublicSettings = () => {
    fetch('/api/settings/public')
      .then(res => res.json())
      .then(setPublicSettings)
      .catch(console.error);
  };

  useEffect(() => {
    fetchPublicSettings();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'green') {
      root.style.setProperty('--accent-purple', '#10b981');
      root.style.setProperty('--accent-blue', '#059669');
    } else if (theme === 'amber') {
      root.style.setProperty('--accent-purple', '#f59e0b');
      root.style.setProperty('--accent-blue', '#d97706');
    } else if (theme === 'crimson') {
      root.style.setProperty('--accent-purple', '#ef4444');
      root.style.setProperty('--accent-blue', '#dc2626');
    } else if (theme === 'cyan') {
      root.style.setProperty('--accent-purple', '#06b6d4');
      root.style.setProperty('--accent-blue', '#0891b2');
    } else {
      root.style.setProperty('--accent-purple', '#6366f1');
      root.style.setProperty('--accent-blue', '#3b82f6');
    }
    localStorage.setItem('systemTheme', theme);
  }, [theme]);

  // Sync state
  useEffect(() => {
    if (token && user) {
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('user', JSON.stringify(user));
      // Set default tab based on role if no tab is selected yet
      if (!activeTab) {
        if (user.role === 'admin') setActiveTab('admin-dashboard');
        else if (user.role === 'teacher') setActiveTab('teacher-dashboard');
        else if (user.role === 'student') setActiveTab('student-attendance-dashboard');
      }
    } else {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
    }
  }, [token, user]);

  // Sync user profile from server to catch re-enrollment permissions and face image updates
  useEffect(() => {
    if (token) {
      fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => {
          if (res.status === 401 || res.status === 403) {
            return null;
          }
          return res.json();
        })
        .then(data => {
          if (data && data.id) {
            setUser(data);
            sessionStorage.setItem('user', JSON.stringify(data));
          }
        })
        .catch(console.error);
    }
  }, [activeTab, token]);

  const handleLogout = () => {
    setToken('');
    setUser(null);
    setActiveTab('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginEmail, password: loginPassword, role: loginRole })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }
      setToken(data.token);
      setUser(data.user);
    } catch (err) {
      setLoginError(err.message);
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotMessage('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, role: forgotRole })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to request OTP');
      }
      setForgotMessage(data.message);
      if (data.mock && data.otp) {
        setForgotOtp(data.otp); // prefill for easy testing locally
      }
      setForgotStep('reset');
    } catch (err) {
      setForgotError(err.message);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotMessage('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: forgotEmail, 
          role: forgotRole, 
          otp: forgotOtp, 
          new_password: forgotNewPassword 
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Password reset failed');
      }
      setForgotMessage(data.message);
      setTimeout(() => {
        setForgotStep('login');
        setForgotEmail('');
        setForgotOtp('');
        setForgotNewPassword('');
        setForgotMessage('');
      }, 2500);
    } catch (err) {
      setForgotError(err.message);
    }
  };

  if (!token) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', height: '100vh' }}>
        {forgotStep === 'login' && (
          <form onSubmit={handleLogin} className="glass-panel-glow animated-fade" style={{ width: '100%', maxWidth: '420px', padding: '32px' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.8rem', fontWeight: '700', background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: '1.3' }}>
                {publicSettings.enable_org_name && publicSettings.org_name ? publicSettings.org_name : 'Smart AI Face Attendance System'}
              </h2>
              {publicSettings.enable_org_name && publicSettings.org_name && (
                <p style={{ color: 'var(--text-secondary)', fontWeight: '600', marginTop: '6px', fontSize: '0.85rem' }}>AI Facial Attendance System</p>
              )}
              {!publicSettings.enable_org_name && (
                <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.9rem' }}>Secure Face Recognition & GPS Verification</p>
              )}
            </div>

            {loginError && (
              <div style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--accent-red)', border: '1px solid rgba(239,68,68,0.3)', padding: '12px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '0.85rem' }}>
                {loginError}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Username</label>
              <input type="text" required className="form-control" placeholder="Email or Registration No" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" required className="form-control" placeholder="••••••••" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">System Role</label>
              <select className="form-control" value={loginRole} onChange={e => setLoginRole(e.target.value)}>
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="admin">System Admin</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px', marginTop: '10px' }}>
              <LogIn size={18} /> Sign In
            </button>

            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setForgotStep('request')}>
                Forgot Password?
              </button>
            </div>

            <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <p>Demo Logins:</p>
              <p>Admin: admin@system.com / admin123</p>
              <p>Teacher: teacher@system.com / teacher123</p>
              <p>Student: student@system.com / student123</p>
            </div>
          </form>
        )}

        {forgotStep === 'request' && (
          <form onSubmit={handleSendOtp} className="glass-panel-glow animated-fade" style={{ width: '100%', maxWidth: '420px', padding: '32px' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.6rem', fontWeight: '700' }}>Password Recovery</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.9rem' }}>Enter your email to receive a recovery code</p>
            </div>

            {forgotError && (
              <div style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--accent-red)', border: '1px solid rgba(239,68,68,0.3)', padding: '12px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '0.85rem' }}>
                {forgotError}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input type="email" required className="form-control" placeholder="john@system.com" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">System Role</label>
              <select className="form-control" value={forgotRole} onChange={e => setForgotRole(e.target.value)}>
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="admin">System Admin</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px', marginTop: '10px' }}>
              Send Verification OTP
            </button>

            <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: '12px' }} onClick={() => setForgotStep('login')}>
              Back to Sign In
            </button>
          </form>
        )}

        {forgotStep === 'reset' && (
          <form onSubmit={handleResetPassword} className="glass-panel-glow animated-fade" style={{ width: '100%', maxWidth: '420px', padding: '32px' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.6rem', fontWeight: '700' }}>Reset Password</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.9rem' }}>Validate OTP and choose a new password</p>
            </div>

            {forgotMessage && (
              <div style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--accent-green)', border: '1px solid rgba(16,185,129,0.3)', padding: '12px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '0.85rem' }}>
                {forgotMessage}
              </div>
            )}

            {forgotError && (
              <div style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--accent-red)', border: '1px solid rgba(239,68,68,0.3)', padding: '12px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '0.85rem' }}>
                {forgotError}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">6-Digit Verification OTP Code</label>
              <input type="text" required maxLength="6" className="form-control" placeholder="123456" value={forgotOtp} onChange={e => setForgotOtp(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">New Password</label>
              <input type="password" required className="form-control" placeholder="••••••••" value={forgotNewPassword} onChange={e => setForgotNewPassword(e.target.value)} />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px', marginTop: '10px' }}>
              Confirm Password Reset
            </button>
        </form>
        )}
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <div className="sidebar">
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px', lineHeight: '1.3' }}>
            {publicSettings.enable_org_name && publicSettings.org_name ? publicSettings.org_name : 'AI Face System'}
          </h2>
          <span className="badge badge-present" style={{ fontSize: '0.7rem' }}>{user.role} mode</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
          {user.role === 'admin' && (
            <>
              <SidebarLink active={activeTab === 'admin-dashboard'} onClick={() => setActiveTab('admin-dashboard')} icon={<BarChart3 size={18} />} text="Dashboard" />
              <SidebarLink active={activeTab === 'admin-students'} onClick={() => setActiveTab('admin-students')} icon={<Users size={18} />} text="Manage Students" />
              <SidebarLink active={activeTab === 'admin-teachers'} onClick={() => setActiveTab('admin-teachers')} icon={<Users size={18} />} text="Manage Teachers" />
              <SidebarLink active={activeTab === 'admin-student-details'} onClick={() => setActiveTab('admin-student-details')} icon={<Users size={18} />} text="Student Details" />
              <SidebarLink active={activeTab === 'admin-settings'} onClick={() => setActiveTab('admin-settings')} icon={<Settings size={18} />} text="System Settings" />
              <SidebarLink active={activeTab === 'admin-reports'} onClick={() => setActiveTab('admin-reports')} icon={<FileText size={18} />} text="Reports Generator" />
            </>
          )}

          {user.role === 'teacher' && (
            <>
              <SidebarLink active={activeTab === 'teacher-dashboard'} onClick={() => setActiveTab('teacher-dashboard')} icon={<BarChart3 size={18} />} text="Dashboard" />
              <SidebarLink active={activeTab === 'teacher-session'} onClick={() => setActiveTab('teacher-session')} icon={<MapPin size={18} />} text="Start Attendance" />
              <SidebarLink active={activeTab === 'teacher-student-details'} onClick={() => setActiveTab('teacher-student-details')} icon={<Users size={18} />} text="Student Details" />
              <SidebarLink active={activeTab === 'teacher-search'} onClick={() => setActiveTab('teacher-search')} icon={<Search size={18} />} text="Student Search" />
              <SidebarLink active={activeTab === 'teacher-override'} onClick={() => setActiveTab('teacher-override')} icon={<CheckSquare size={18} />} text="Override Records" />
              <SidebarLink active={activeTab === 'teacher-leaves'} onClick={() => setActiveTab('teacher-leaves')} icon={<FileText size={18} />} text="Leave Requests" />
              <SidebarLink active={activeTab === 'teacher-od'} onClick={() => setActiveTab('teacher-od')} icon={<FileText size={18} />} text="OD Requests" />
              <SidebarLink active={activeTab === 'teacher-reports'} onClick={() => setActiveTab('teacher-reports')} icon={<FileText size={18} />} text="Reports Generator" />
            </>
          )}

          {user.role === 'student' && (
            <>
              <SidebarLink active={activeTab === 'student-attendance-dashboard'} onClick={() => setActiveTab('student-attendance-dashboard')} icon={<BarChart3 size={18} />} text="My Attendance" />
              <SidebarLink active={activeTab === 'student-profile'} onClick={() => setActiveTab('student-profile')} icon={<User size={18} />} text="My Profile" />
              <SidebarLink 
                active={activeTab === 'student-register'} 
                onClick={() => {
                  if (user.hasFace && !user.re_enroll_allowed) {
                    alert('Face biometric profile is already registered. To re-enroll, please contact your class teacher or system admin for access grant.');
                    return;
                  }
                  setActiveTab('student-register');
                }} 
                icon={<Camera size={18} />} 
                text={user.hasFace && !user.re_enroll_allowed ? "Face Enrolled (Locked)" : "Face Registration"} 
                style={{
                  opacity: user.hasFace && !user.re_enroll_allowed ? 0.6 : 1,
                }}
              />
              <SidebarLink active={activeTab === 'student-mark'} onClick={() => setActiveTab('student-mark')} icon={<UserCheck size={18} />} text="Mark Attendance" />
              <SidebarLink active={activeTab === 'student-leaves'} onClick={() => setActiveTab('student-leaves')} icon={<FileText size={18} />} text="Request Leave" />
              <SidebarLink active={activeTab === 'student-od'} onClick={() => setActiveTab('student-od')} icon={<FileText size={18} />} text="Request OD" />
              <SidebarLink active={activeTab === 'student-history'} onClick={() => setActiveTab('student-history')} icon={<History size={18} />} text="History Logs" />
            </>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', overflow: 'hidden', flexShrink: 0 }}>
              {user.face_image ? (
                <img src={user.face_image} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                user.name ? user.name[0].toUpperCase() : 'U'
              )}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <p style={{ fontSize: '0.8rem', fontWeight: '600', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{user.name}</p>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{user.email}</p>
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>System Theme Color</label>
            <select className="form-control" style={{ padding: '6px 8px', fontSize: '0.75rem', height: '32px' }} value={theme} onChange={e => setTheme(e.target.value)}>
              <option value="purple">Default (Purple Rain)</option>
              <option value="green">Forest Green</option>
              <option value="amber">Sunset Amber</option>
              <option value="crimson">Classic Crimson</option>
              <option value="cyan">Ocean Cyan</option>
            </select>
          </div>

          <button onClick={handleLogout} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.85rem' }}>
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="main-content">
        {activeTab === 'admin-dashboard' && <AdminDashboard token={token} />}
        {activeTab === 'admin-students' && <AdminStudents token={token} />}
        {activeTab === 'admin-teachers' && <AdminTeachers token={token} />}
        {activeTab === 'admin-student-details' && <StudentDetails token={token} role="admin" />}
        {activeTab === 'admin-settings' && <AdminSettings token={token} gpsRadius={gpsRadius} setGpsRadius={setGpsRadius} onSettingsUpdate={fetchPublicSettings} />}
        {activeTab === 'admin-reports' && <ReportsGenerator token={token} user={user} />}
        
        {activeTab === 'teacher-dashboard' && <AdminDashboard token={token} />}
        {activeTab === 'teacher-session' && <TeacherSession token={token} />}
        {activeTab === 'teacher-student-details' && <StudentDetails token={token} role="teacher" />}
        {activeTab === 'teacher-search' && <TeacherSearchRegistry token={token} />}
        {activeTab === 'teacher-override' && <TeacherOverride token={token} />}
        {activeTab === 'teacher-leaves' && <TeacherLeaveRequests token={token} />}
        {activeTab === 'teacher-od' && <TeacherODRequests token={token} />}
        {activeTab === 'teacher-reports' && <ReportsGenerator token={token} user={user} />}

        {activeTab === 'student-attendance-dashboard' && <StudentAttendanceDashboard token={token} user={user} />}
        {activeTab === 'student-profile' && <StudentProfile token={token} user={user} />}
        {activeTab === 'student-register' && <StudentFaceRegister token={token} user={user} />}
        {activeTab === 'student-mark' && <StudentMarkAttendance token={token} user={user} />}
        {activeTab === 'student-leaves' && <StudentLeaveRequests token={token} user={user} />}
        {activeTab === 'student-od' && <StudentODRequests token={token} user={user} />}
        {activeTab === 'student-history' && <StudentHistory token={token} user={user} />}
      </div>
    </div>
  );
}

function SidebarLink({ active, onClick, icon, text, style }) {
  return (
    <button 
      onClick={onClick} 
      className="btn" 
      style={{ 
        width: '100%', 
        justifyContent: 'flex-start',
        background: active ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
        color: active ? 'var(--accent-purple)' : 'var(--text-secondary)',
        border: active ? '1px solid rgba(99, 102, 241, 0.3)' : 'none',
        borderRadius: 'var(--radius-md)'
      }}
    >
      {icon}
      <span>{text}</span>
    </button>
  );
}

// --- Admin Settings Component ---
function AdminSettings({ token, gpsRadius, setGpsRadius, onSettingsUpdate }) {
  const [success, setSuccess] = useState('');
  const [duration, setDuration] = useState(5);
  const [sensitivity, setSensitivity] = useState('medium');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [gpsBypass, setGpsBypass] = useState(false);
  const [emailThreshold, setEmailThreshold] = useState(75);
  const [mailLogs, setMailLogs] = useState([]);
  const [orgName, setOrgName] = useState('');
  const [enableOrgName, setEnableOrgName] = useState(false);
  const [orgAddress, setOrgAddress] = useState('');
  const [orgWebsite, setOrgWebsite] = useState('');

  const fetchSettings = () => {
    fetch('/api/settings', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setGpsRadius(data.gps_radius || 100);
        setDuration(data.session_duration || 5);
        setSensitivity(data.liveness_sensitivity || 'medium');
        setEmailAlerts(data.email_notifications !== false);
        setGpsBypass(!!data.gps_bypass);
        setEmailThreshold(data.email_threshold !== undefined ? data.email_threshold : 75);
        setOrgName(data.org_name || '');
        setEnableOrgName(!!data.enable_org_name);
        setOrgAddress(data.org_address || '');
        setOrgWebsite(data.org_website || '');
      })
      .catch(console.error);
  };

  const fetchMailLogs = () => {
    fetch('/api/settings/mail-logs', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setMailLogs(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  useEffect(() => {
    fetchSettings();
    fetchMailLogs();
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSuccess('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          gps_radius: gpsRadius, 
          session_duration: duration, 
          liveness_sensitivity: sensitivity,
          email_notifications: emailAlerts,
          gps_bypass: gpsBypass,
          email_threshold: emailThreshold,
          org_name: orgName,
          enable_org_name: enableOrgName,
          org_address: orgAddress,
          org_website: orgWebsite
        })
      });
      if (res.ok) {
        setSuccess('System configuration parameters updated successfully!');
        fetchMailLogs();
        if (onSettingsUpdate) onSettingsUpdate();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="animated-fade" style={{ maxWidth: '750px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '20px' }}>System Settings Config</h2>
        <div className="glass-panel" style={{ padding: '24px' }}>
          {success && <div style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--accent-green)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>{success}</div>}
          <form onSubmit={handleUpdate}>
            <div className="form-group">
              <label className="form-label">GPS Radius (meters)</label>
              <select className="form-control" value={gpsRadius} onChange={e => setGpsRadius(Number(e.target.value))}>
                <option value="50">50 meters</option>
                <option value="100">100 meters</option>
                <option value="150">150 meters</option>
                <option value="200">200 meters</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Attendance Registration Window Duration (Minutes)</label>
              <input type="number" min="1" max="120" required className="form-control" value={duration} onChange={e => setDuration(Number(e.target.value))} />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Configures the active check-in session window duration.</span>
            </div>

            <div className="form-group">
              <label className="form-label">Blink Detection Liveness Sensitivity</label>
              <select className="form-control" value={sensitivity} onChange={e => setSensitivity(e.target.value)}>
                <option value="low">Low (Fewer false rejections, easier check-in)</option>
                <option value="medium">Medium (Standard balanced liveness check)</option>
                <option value="high">High (Strict facial depth checks, secure)</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Minimum Attendance Email Warning Threshold</span>
                <strong style={{ color: 'var(--accent-purple)' }}>{emailThreshold}%</strong>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input 
                  type="range" 
                  min="50" 
                  max="95" 
                  className="form-control" 
                  value={emailThreshold} 
                  onChange={e => setEmailThreshold(Number(e.target.value))} 
                  style={{ flex: 1, padding: 0, height: '6px', cursor: 'pointer' }}
                />
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Parents will automatically receive an email alert when overall student attendance falls below this threshold at session confirmation.</span>
            </div>

            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '12px', margin: '12px 0' }}>
              <input type="checkbox" id="emailAlerts" checked={emailAlerts} onChange={e => setEmailAlerts(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
              <label htmlFor="emailAlerts" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>Trigger Parent Email Alerts for Absentees on Session Close</label>
            </div>

            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '12px', margin: '12px 0' }}>
              <input type="checkbox" id="gpsBypass" checked={gpsBypass} onChange={e => setGpsBypass(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
              <label htmlFor="gpsBypass" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>Bypass GPS radius restrictions (for local testing environment)</label>
            </div>

            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', margin: '24px 0 16px 0', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>College / Office Details</h3>
            
            <div className="form-group">
              <label className="form-label">College/Office Name</label>
              <input type="text" placeholder="e.g. AI Engineering College" className="form-control" value={orgName} onChange={e => setOrgName(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Office Address</label>
              <input type="text" placeholder="e.g. Chennai, Tamil Nadu" className="form-control" value={orgAddress} onChange={e => setOrgAddress(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Official Website</label>
              <input type="text" placeholder="e.g. www.aicollege.edu" className="form-control" value={orgWebsite} onChange={e => setOrgWebsite(e.target.value)} />
            </div>

            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '12px', margin: '12px 0 20px 0' }}>
              <input type="checkbox" id="enableOrgName" checked={enableOrgName} onChange={e => setEnableOrgName(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
              <label htmlFor="enableOrgName" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>Enable college / office name display on top of the webpage & login page</label>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Save Configuration</button>
          </form>
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: '1.4rem', fontWeight: '700', marginBottom: '14px' }}>Parent Email Logs (Low Attendance Warning Alerts)</h3>
        <div className="glass-panel" style={{ padding: '0px', overflow: 'hidden' }}>
          <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Parent Email</th>
                  <th>Alert Details</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {mailLogs.map(l => (
                  <tr key={l.id}>
                    <td><strong>{l.student_name}</strong><br/><span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{l.register_no}</span></td>
                    <td style={{ fontSize: '0.85rem' }}>{l.recipient}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--accent-purple)' }}>{l.subject}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{l.sent_at}</td>
                  </tr>
                ))}
                {mailLogs.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>No parent warning emails sent yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Admin Student Management Component ---
function AdminStudents({ token }) {
  const [students, setStudents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  
  // Fields
  const [name, setName] = useState('');
  const [registerNo, setRegisterNo] = useState('');
  const [email, setEmail] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [password, setPassword] = useState('');

  const fetchStudents = () => {
    fetch('/api/students', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setStudents(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { name, register_no: registerNo, email, parent_email: parentEmail, department, password };
    
    const url = currentId ? `/api/students/${currentId}` : '/api/students';
    const method = currentId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      setShowModal(false);
      resetForm();
      fetchStudents();
    }
  };

  const resetForm = () => {
    setCurrentId(null);
    setName('');
    setRegisterNo('');
    setEmail('');
    setParentEmail('');
    setDepartment('');
    setPassword('');
  };

  const handleEdit = (s) => {
    setCurrentId(s.student_id);
    setName(s.name);
    setRegisterNo(s.register_no);
    setEmail(s.email);
    setParentEmail(s.parent_email);
    setDepartment(s.department);
    setPassword(''); // keep blank unless change requested
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this student?')) {
      const res = await fetch(`/api/students/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchStudents();
    }
  };

  return (
    <div className="animated-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}>Manage Students</h2>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          <Plus size={16} /> Add Student
        </button>
      </div>

      <div className="glass-panel" style={{ overflowX: 'auto' }}>
        <table className="custom-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Register No</th>
              <th>Email</th>
              <th>Parent Email</th>
              <th>Department</th>
              <th>Face Bio</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map(s => (
              <tr key={s.student_id}>
                <td>{s.name}</td>
                <td>{s.register_no}</td>
                <td>{s.email}</td>
                <td>{s.parent_email}</td>
                <td>{s.department}</td>
                <td>
                  <span className={`badge ${s.hasFace ? 'badge-present' : 'badge-absent'}`}>
                    {s.hasFace ? 'Registered' : 'Pending'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => handleEdit(s)}>
                      <Edit size={14} />
                    </button>
                    <button className="btn btn-danger" style={{ padding: '6px 10px' }} onClick={() => handleDelete(s.student_id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <form onSubmit={handleSubmit} className="modal-content">
            <button type="button" onClick={() => setShowModal(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h3 style={{ marginBottom: '20px', fontSize: '1.4rem' }}>{currentId ? 'Edit Student' : 'Add New Student'}</h3>
            
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input type="text" required className="form-control" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Register Number</label>
              <input type="text" required className="form-control" value={registerNo} onChange={e => setRegisterNo(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" required className="form-control" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Parent Email</label>
              <input type="email" required className="form-control" value={parentEmail} onChange={e => setParentEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Department</label>
              <input type="text" required className="form-control" value={department} onChange={e => setDepartment(e.target.value)} />
            </div>
            {!currentId && (
              <div className="form-group">
                <label className="form-label">Password</label>
                <input type="password" required className="form-control" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Details</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// --- Admin Teacher Management Component ---
function AdminTeachers({ token }) {
  const [teachers, setTeachers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  
  // Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [password, setPassword] = useState('');

  const fetchTeachers = () => {
    fetch('/api/teachers', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setTeachers(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { name, email, department, password };
    
    const url = currentId ? `/api/teachers/${currentId}` : '/api/teachers';
    const method = currentId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      setShowModal(false);
      resetForm();
      fetchTeachers();
    }
  };

  const resetForm = () => {
    setCurrentId(null);
    setName('');
    setEmail('');
    setDepartment('');
    setPassword('');
  };

  const handleEdit = (t) => {
    setCurrentId(t.teacher_id);
    setName(t.name);
    setEmail(t.email);
    setDepartment(t.department);
    setPassword('');
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this teacher?')) {
      const res = await fetch(`/api/teachers/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchTeachers();
    }
  };

  return (
    <div className="animated-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}>Manage Teachers</h2>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          <Plus size={16} /> Add Teacher
        </button>
      </div>

      <div className="glass-panel" style={{ overflowX: 'auto' }}>
        <table className="custom-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Department</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map(t => (
              <tr key={t.teacher_id}>
                <td>{t.name}</td>
                <td>{t.email}</td>
                <td>{t.department}</td>
                <td>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => handleEdit(t)}>
                      <Edit size={14} />
                    </button>
                    <button className="btn btn-danger" style={{ padding: '6px 10px' }} onClick={() => handleDelete(t.teacher_id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <form onSubmit={handleSubmit} className="modal-content">
            <button type="button" onClick={() => setShowModal(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h3 style={{ marginBottom: '20px', fontSize: '1.4rem' }}>{currentId ? 'Edit Teacher' : 'Add New Teacher'}</h3>
            
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input type="text" required className="form-control" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" required className="form-control" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Department</label>
              <input type="text" required className="form-control" value={department} onChange={e => setDepartment(e.target.value)} />
            </div>
            {!currentId && (
              <div className="form-group">
                <label className="form-label">Password</label>
                <input type="password" required className="form-control" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Details</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// --- Dashboard Component (Admin / Teacher analytics) ---
function AdminDashboard({ token }) {
  const [stats, setStats] = useState({ totalStudents: 0, totalTeachers: 0, activeSessions: 0, presentCount: 0, absentCount: 0, rate: 0 });
  const [dailyData, setDailyData] = useState([]);
  const [subjectData, setSubjectData] = useState([]);
  const [reportsData, setReportsData] = useState([]);
  const [drilldownFilter, setDrilldownFilter] = useState(null); // { type: 'date'|'subject', value: string }
  const [lowAttendanceStudents, setLowAttendanceStudents] = useState([]);

  const fetchDashboardData = () => {
    fetch('/api/analytics/dashboard', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (res.status === 401 || res.status === 403) {
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('user');
          window.location.reload();
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data && data.stats) {
          setStats(data.stats);
          setDailyData(data.daily || []);
          setSubjectData(data.subjects || []);
        }
      })
      .catch(console.error);

    fetch('/api/analytics/reports', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (res.status === 401 || res.status === 403) {
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('user');
          window.location.reload();
          return [];
        }
        return res.json();
      })
      .then(data => {
        const reportsList = Array.isArray(data) ? data : [];
        setReportsData(reportsList);
        
        // Calculate low attendance students (< 75%)
        const studentStats = {};
        reportsList.forEach(rec => {
          if (rec && rec.register_no) {
            if (!studentStats[rec.register_no]) {
              studentStats[rec.register_no] = { name: rec.student_name, regNo: rec.register_no, present: 0, total: 0 };
            }
            studentStats[rec.register_no].total++;
            if (rec.status === 'PRESENT') {
              studentStats[rec.register_no].present++;
            }
          }
        });

        const lowAtt = Object.values(studentStats)
          .map(s => ({
            ...s,
            percentage: s.total > 0 ? Math.round((s.present / s.total) * 100) : 0
          }))
          .filter(s => s.percentage < 75);
        setLowAttendanceStudents(lowAtt);
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleDailyClick = (event, elements) => {
    if (elements && elements.length > 0) {
      const index = elements[0].index;
      const selectedDate = dailyData[index].attendance_date;
      setDrilldownFilter({ type: 'date', label: 'Date', value: selectedDate });
    }
  };

  const handleSubjectClick = (event, elements) => {
    if (elements && elements.length > 0) {
      const index = elements[0].index;
      const selectedSub = subjectData[index].subject_name;
      setDrilldownFilter({ type: 'subject', label: 'Subject', value: selectedSub });
    }
  };

  const filteredDrilldown = reportsData.filter(rec => {
    if (!drilldownFilter) return false;
    if (drilldownFilter.type === 'date') {
      return rec.attendance_date === drilldownFilter.value;
    } else if (drilldownFilter.type === 'subject') {
      return rec.subject_name.toLowerCase() === drilldownFilter.value.toLowerCase();
    }
    return false;
  });

  const dailyChart = {
    labels: (dailyData || []).map(d => d.attendance_date),
    datasets: [
      { label: 'Present', data: (dailyData || []).map(d => d.present), backgroundColor: '#10b981' },
      { label: 'Absent', data: (dailyData || []).map(d => d.absent), backgroundColor: '#ef4444' }
    ]
  };

  const subjectChart = {
    labels: (subjectData || []).map(s => s.subject_name),
    datasets: [
      { label: 'Present Rate %', data: (subjectData || []).map(s => Math.round((s.present / (s.present + s.absent || 1)) * 100)), backgroundColor: '#6366f1' }
    ]
  };

  return (
    <div className="animated-fade">
      <h2 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '24px' }}>Analytics Dashboard</h2>
      
      {/* Low Attendance Alert */}
      {lowAttendanceStudents.length > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', padding: '16px', borderRadius: 'var(--radius-lg)', marginBottom: '24px' }}>
          <h4 style={{ color: 'var(--accent-amber)', fontWeight: '700', fontSize: '0.95rem', marginBottom: '6px' }}>
            ⚠️ Low Attendance Warnings (Below 75%)
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {lowAttendanceStudents.map(s => (
              <span key={s.regNo} className="badge badge-absent" style={{ background: 'rgba(239,68,68,0.06)', color: 'var(--accent-red)', border: '1px solid rgba(239,68,68,0.15)' }}>
                {s.name} ({s.regNo}): {s.percentage}%
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Total Registered Students</p>
          <h3 style={{ fontSize: '2.5rem', fontWeight: '800', marginTop: '10px' }}>{stats?.totalStudents || 0}</h3>
        </div>
        <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Total Teachers</p>
          <h3 style={{ fontSize: '2.5rem', fontWeight: '800', marginTop: '10px', color: 'var(--accent-purple)' }}>{stats?.totalTeachers || 0}</h3>
        </div>
        <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Total Present Checkins</p>
          <h3 style={{ fontSize: '2.5rem', fontWeight: '800', marginTop: '10px', color: 'var(--accent-green)' }}>{stats?.presentCount || 0}</h3>
        </div>
        <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Attendance Success Rate</p>
          <h3 style={{ fontSize: '2.5rem', fontWeight: '800', marginTop: '10px', color: 'var(--accent-blue)' }}>{stats?.rate || 0}%</h3>
        </div>
      </div>

      {/* Chart Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ marginBottom: '8px', fontSize: '1.1rem' }}>Daily Attendance Logs (Last 7 Days)</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>💡 Click on any bar to load detailed records below</p>
          <div style={{ height: '280px' }}>
            {dailyData.length > 0 ? (
              <Bar 
                data={dailyChart} 
                options={{ 
                  responsive: true, 
                  maintainAspectRatio: false,
                  onClick: handleDailyClick
                }} 
              />
            ) : <p style={{ color: 'var(--text-secondary)' }}>No data logged yet.</p>}
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ marginBottom: '8px', fontSize: '1.1rem' }}>Subject-wise Check-in Success Rate (%)</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>💡 Click on any bar to load detailed records below</p>
          <div style={{ height: '280px' }}>
            {subjectData.length > 0 ? (
              <Bar 
                data={subjectChart} 
                options={{ 
                  responsive: true, 
                  maintainAspectRatio: false,
                  onClick: handleSubjectClick
                }} 
              />
            ) : <p style={{ color: 'var(--text-secondary)' }}>No logs calculated.</p>}
          </div>
        </div>
      </div>

      {/* Drilldown Table Section */}
      {drilldownFilter && (
        <div className="glass-panel animated-fade" style={{ padding: '24px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700' }}>
              Detailed Logs for {drilldownFilter.label}: <strong style={{ color: 'var(--accent-purple)' }}>{drilldownFilter.value}</strong>
            </h3>
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => setDrilldownFilter(null)}>
              Clear Filter
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Reg No</th>
                  <th>Department</th>
                  <th>Subject</th>
                  <th>Class</th>
                  <th>Time</th>
                  <th>GPS Dist</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrilldown.map((r, i) => (
                  <tr key={i}>
                    <td>{r.student_name}</td>
                    <td>{r.register_no}</td>
                    <td>{r.department}</td>
                    <td>{r.subject_name}</td>
                    <td>{r.class_name}</td>
                    <td>{r.attendance_time}</td>
                    <td>{r.distance ? `${Math.round(r.distance)}m` : 'N/A'}</td>
                    <td>
                      <span className={`badge ${r.status === 'PRESENT' ? 'badge-present' : 'badge-absent'}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredDrilldown.length === 0 && (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No records matches this filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Teacher Start Session Component ---
function TeacherSession({ token }) {
  const [activeSession, setActiveSession] = useState(null);
  const [subject, setSubject] = useState('');
  const [className, setClassName] = useState('');
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [msg, setMsg] = useState('');
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [livePresentCount, setLivePresentCount] = useState(0);
  const [timeRange, setTimeRange] = useState('09:00 AM - 09:45 AM');
  const [gpsRadius, setGpsRadius] = useState(100);

  const fetchActive = () => {
    fetch('/api/sessions/active', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(setActiveSession)
      .catch(console.error);
  };

  useEffect(() => {
    fetchActive();
    // Fetch browser location
    setLoadingGeo(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLoadingGeo(false);
      },
      (err) => {
        console.error(err);
        // Fallback default coordinates
        setLat(10.007);
        setLng(78.325);
        setLoadingGeo(false);
      }
    );
  }, []);

  useEffect(() => {
    if (!activeSession) return;
    const fetchCount = () => {
      fetch(`/api/sessions/${activeSession.session_id}/attendance`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(records => {
          const present = records.filter(r => r.status === 'PRESENT').length;
          setLivePresentCount(present);
        })
        .catch(console.error);
    };

    fetchCount();
    const interval = setInterval(fetchCount, 2500); // Poll list every 2.5 seconds for real-time responsiveness
    return () => clearInterval(interval);
  }, [activeSession]);

  const handleStart = async (e) => {
    e.preventDefault();
    setMsg('');
    const res = await fetch('/api/sessions/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ subject_name: subject, class_name: className, latitude: lat, longitude: lng, time_range: timeRange, gps_radius: gpsRadius })
    });
    const data = await res.json();
    if (res.ok) {
      setMsg(data.message);
      fetchActive();
    }
  };

  const handleClose = async () => {
    if (!activeSession) return;
    const res = await fetch(`/api/sessions/close/${activeSession.session_id}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      fetchActive();
      setMsg('Attendance session closed successfully.');
    }
  };

  return (
    <div className="animated-fade" style={{ maxWidth: '700px' }}>
      <h2 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '24px' }}>Create Attendance Window</h2>
      
      {activeSession ? (
        <div className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid var(--accent-purple)' }}>
          <h3 style={{ fontSize: '1.3rem', color: '#1e293b', marginBottom: '8px' }}>Active Session Running</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Subject: <strong>{activeSession.subject_name}</strong></p>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Class: <strong>{activeSession.class_name}</strong></p>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Period range: <strong>{activeSession.time_range || 'N/A'}</strong></p>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Allowed radius limit: <strong>{activeSession.gps_radius || 100} meters</strong></p>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Teacher Coordinates: {activeSession.teacher_latitude}, {activeSession.teacher_longitude}</p>
          <p style={{ color: 'var(--accent-purple)', fontWeight: 'bold', margin: '12px 0' }}>Window Closes: {new Date(activeSession.end_time).toLocaleTimeString()}</p>
          
          <div style={{ background: 'rgba(99,102,241,0.06)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: '600' }}>Live Student Present Count</span>
            <span className="badge badge-present" style={{ fontSize: '1.1rem', padding: '6px 14px' }}>{livePresentCount}</span>
          </div>

          <button className="btn btn-danger" onClick={handleClose}>
            End Session & Confirm Attendance
          </button>
        </div>
      ) : (
        <form onSubmit={handleStart} className="glass-panel" style={{ padding: '24px' }}>
          {msg && <div style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--accent-green)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>{msg}</div>}
          
          <div className="form-group">
            <label className="form-label">Subject Name</label>
            <input type="text" required placeholder="Machine Learning CSE-A" className="form-control" value={subject} onChange={e => setSubject(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Class Year/Sec</label>
            <input type="text" required placeholder="Final Year - CS A" className="form-control" value={className} onChange={e => setClassName(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Class Period Time Range</label>
            <select className="form-control" value={timeRange} onChange={e => setTimeRange(e.target.value)}>
              <option value="09:00 AM - 09:45 AM">09:00 AM - 09:45 AM (Period 1)</option>
              <option value="09:45 AM - 10:30 AM">09:45 AM - 10:30 AM (Period 2)</option>
              <option value="10:45 AM - 11:30 AM">10:45 AM - 11:30 AM (Period 3)</option>
              <option value="11:30 AM - 12:15 PM">11:30 AM - 12:15 PM (Period 4)</option>
              <option value="01:15 PM - 02:00 PM">01:15 PM - 02:00 PM (Period 5)</option>
              <option value="02:00 PM - 02:45 PM">02:00 PM - 02:45 PM (Period 6)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Class GPS Validation Radius (Classroom Area Size)</label>
            <select className="form-control" value={gpsRadius} onChange={e => setGpsRadius(Number(e.target.value))}>
              <option value="10">10 meters (Small Lab / Desk Proximity)</option>
              <option value="25">25 meters (Medium Classroom)</option>
              <option value="50">50 meters (Large Lecture Hall)</option>
              <option value="100">100 meters (Standard Building Floor)</option>
              <option value="200">200 meters (Entire Campus Block)</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label">GPS Center Location</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <MapPin size={18} className="animated-fade" style={{ color: 'var(--accent-purple)' }} />
              {loadingGeo ? (
                <span>Locking GPS Satellite location...</span>
              ) : (
                <span>Latitude: {lat} | Longitude: {lng}</span>
              )}
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loadingGeo}>
            Start Window
          </button>
        </form>
      )}
    </div>
  );
}

// --- Teacher Override Component ---
function TeacherOverride({ token }) {
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [records, setRecords] = useState([]);
  const [showOverride, setShowOverride] = useState(false);

  // Form
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [overrideStatus, setOverrideStatus] = useState('PRESENT');
  const [overrideReason, setOverrideReason] = useState('');

  useEffect(() => {
    // Fetch all students to match manual listing
    fetch('/api/students', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(setStudents)
      .catch(console.error);

    // Fetch active/past sessions
    fetch('/api/analytics/dashboard', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        // Mock query sessions list from stats API structure
        fetch('/api/sessions/active', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(active => {
            const list = [];
            if (active) list.push(active);
            setSessions(list);
            if (list.length > 0) setSelectedSessionId(list[0].session_id);
          });
      })
      .catch(console.error);
  }, []);

  const fetchRecords = () => {
    if (!selectedSessionId) return;
    fetch(`/api/sessions/${selectedSessionId}/attendance`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(setRecords)
      .catch(console.error);
  };

  useEffect(() => {
    fetchRecords();
  }, [selectedSessionId]);

  const handleOpenOverride = (rec, student) => {
    if (rec) {
      setSelectedRecord({ ...rec });
      setOverrideStatus(rec.status);
      setOverrideReason(rec.override_reason || '');
    } else {
      // fresh record override
      setSelectedRecord({
        student_id: student.student_id,
        student_name: student.name,
        register_no: student.register_no
      });
      setOverrideStatus('PRESENT');
      setOverrideReason('');
    }
    setShowOverride(true);
  };

  const handleSaveOverride = async (e) => {
    e.preventDefault();
    const payload = {
      attendance_id: selectedRecord.attendance_id || null,
      session_id: selectedSessionId,
      student_id: selectedRecord.student_id,
      status: overrideStatus,
      reason: overrideReason
    };

    const res = await fetch('/api/attendance/override', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      setShowOverride(false);
      fetchRecords();
    }
  };

  return (
    <div className="animated-fade">
      <h2 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '24px' }}>Attendance Override Portal</h2>

      <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Select Session Instance</label>
          <select className="form-control" value={selectedSessionId} onChange={e => setSelectedSessionId(e.target.value)}>
            <option value="">-- Choose Session --</option>
            {sessions.map(s => (
              <option key={s.session_id} value={s.session_id}>{s.subject_name} ({s.class_name})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="glass-panel" style={{ overflowX: 'auto' }}>
        <table className="custom-table">
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Reg No</th>
              <th>GPS Dist</th>
              <th>Logged Status</th>
              <th>Override By</th>
              <th>Reason Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map(stud => {
              const rec = records.find(r => r.student_id === stud.student_id);
              return (
                <tr key={stud.student_id}>
                  <td>{stud.name}</td>
                  <td>{stud.register_no}</td>
                  <td>{rec && rec.distance ? `${Math.round(rec.distance)}m` : 'N/A'}</td>
                  <td>
                    <span className={`badge ${rec && rec.status === 'PRESENT' ? 'badge-present' : 'badge-absent'}`}>
                      {rec ? rec.status : 'ABSENT'}
                    </span>
                  </td>
                  <td>{rec && rec.overridden_by ? rec.overridden_by : '-'}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {rec && rec.override_reason ? rec.override_reason : 'No changes'}
                  </td>
                  <td>
                    <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => handleOpenOverride(rec, stud)}>
                      Override Status
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showOverride && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleSaveOverride} className="glass-panel-glow" style={{ width: '100%', maxWidth: '460px', padding: '24px', position: 'relative' }}>
            <button type="button" onClick={() => setShowOverride(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h3 style={{ marginBottom: '20px', fontSize: '1.3rem' }}>Override Attendance</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.9rem' }}>
              Student: <strong>{selectedRecord?.student_name}</strong> ({selectedRecord?.register_no})
            </p>

            <div className="form-group">
              <label className="form-label">Desired Attendance Status</label>
              <select className="form-control" value={overrideStatus} onChange={e => setOverrideStatus(e.target.value)}>
                <option value="PRESENT">PRESENT</option>
                <option value="ABSENT">ABSENT</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Audit Trail Reason (Mandatory)</label>
              <textarea required placeholder="Explain why override was triggered (e.g. GPS failed inside room)" className="form-control" style={{ minHeight: '80px', resize: 'vertical' }} value={overrideReason} onChange={e => setOverrideReason(e.target.value)} />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowOverride(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Changes</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// --- Student Face Register Component ---
function StudentFaceRegister({ token, user }) {
  const [status, setStatus] = useState('Standby');
  const [success, setSuccess] = useState('');
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [videoActive, setVideoActive] = useState(false);
  const [wearingGlasses, setWearingGlasses] = useState(false);
  const [blinkCount, setBlinkCount] = useState(0);

  useEffect(() => {
    // Load face-api models from static models route
    setStatus('Loading AI facial models...');
    Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
      faceapi.nets.faceRecognitionNet.loadFromUri('/models')
    ]).then(() => {
      setModelsLoaded(true);
      setStatus('AI Models ready for registration.');
    }).catch(err => {
      console.error(err);
      setStatus('Error loading AI models. Make sure weights are correctly hosted.');
    });
  }, []);

  const handleStartCamera = () => {
    setVideoActive(true);
    setBlinkCount(0);
    setStatus('Initializing camera stream...');
    setTimeout(() => {
      const video = document.getElementById('webcam-video');
      if (video) {
        navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
          .then((stream) => {
            video.srcObject = stream;
            video.play();
            startEnrollmentScan(video);
          })
          .catch((err) => {
            console.error(err);
            setStatus('Failed to access camera.');
          });
      }
    }, 200);
  };

  const startEnrollmentScan = async (video) => {
    setStatus('Looking for face... Align your face inside the camera screen.');
    let eyeClosedPrev = false;
    let localBlinkCount = 0;

    const interval = setInterval(async () => {
      if (!video || video.paused || video.ended) {
        clearInterval(interval);
        return;
      }

      // inputSize 224 for accurate eye coordinate math
      const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setStatus('Scanning... Align your face clearly in front of the lens.');
        return;
      }

      // Check turned face
      const landmarks = detection.landmarks;
      const nose = landmarks.getNose();
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();
      
      const noseTip = nose[6]; 
      const leftEyeCorner = leftEye[3]; 
      const rightEyeCorner = rightEye[0]; 

      const distToLeft = Math.abs(noseTip.x - leftEyeCorner.x);
      const distToRight = Math.abs(noseTip.x - rightEyeCorner.x);
      const ratio = Math.max(distToLeft, distToRight) / (Math.min(distToLeft, distToRight) || 1);

      if (ratio > 1.95) {
        setStatus('You have turned your face. Please look straight directly facing the camera.');
        return;
      }

      setStatus('Face detected! Aligning profile...');
      clearInterval(interval);

      const authorized = window.confirm(
        "Do you authorize this system to register your biometric face profile for attendance tracking?"
      );

      if (!authorized) {
        setStatus('Registration canceled. Please click "Initialize Enrollment Camera" to try again.');
        if (video.srcObject) {
          video.srcObject.getTracks().forEach(track => track.stop());
        }
        setVideoActive(false);
        return;
      }

      setStatus('Permission granted! Capturing biometric templates...');

      // Draw cropped face region to extract base64 snapshot (ignores background!)
      let base64Image = null;
      try {
        const box = detection.detection.box;
        const canvas = document.createElement('canvas');
        
        // Add a 15% margin padding to frame the face nicely
        const padX = box.width * 0.15;
        const padY = box.height * 0.15;
        
        const cropX = Math.max(0, box.x - padX);
        const cropY = Math.max(0, box.y - padY);
        const cropW = Math.min(video.videoWidth - cropX, box.width + padX * 2);
        const cropH = Math.min(video.videoHeight - cropY, box.height + padY * 2);

        canvas.width = cropW;
        canvas.height = cropH;
        const ctx = canvas.getContext('2d');

        // Draw only the cropped face box region from the video element
        ctx.drawImage(
          video, 
          cropX, cropY, cropW, cropH, // Source dimensions
          0, 0, cropW, cropH          // Destination dimensions
        );
        
        // Flip canvas horizontally to preserve mirroring
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = cropW;
        finalCanvas.height = cropH;
        const fCtx = finalCanvas.getContext('2d');
        fCtx.translate(cropW, 0);
        fCtx.scale(-1, 1);
        fCtx.drawImage(canvas, 0, 0);

        base64Image = finalCanvas.toDataURL('image/jpeg', 0.85);
      } catch (e) {
        console.error('Snapshot capture failed', e);
      }

      setStatus('Biometrics captured! Registering profile...');
      const descriptorArray = Array.from(detection.descriptor);

      const res = await fetch('/api/students/register-face', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ descriptor: descriptorArray, face_image: base64Image })
      });

      if (res.ok) {
        setSuccess('Biometric Face Profile successfully enrolled!');
        setStatus('Complete');
        
        // Save to session storage immediately
        try {
          const localUser = JSON.parse(sessionStorage.getItem('user')) || {};
          const updatedUser = {
            ...localUser,
            hasFace: true,
            face_image: base64Image,
            re_enroll_allowed: 0
          };
          sessionStorage.setItem('user', JSON.stringify(updatedUser));
        } catch (e) {
          console.error(e);
        }

        // Stop stream
        if (video.srcObject) {
          video.srcObject.getTracks().forEach(track => track.stop());
        }
        setVideoActive(false);
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        const errorData = await res.json();
        setStatus(errorData.message || 'Failed to upload biometric template.');
      }
    }, 100);
  };

  return (
    <div className="animated-fade" style={{ maxWidth: '600px' }}>
      <h2 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '20px' }}>AI Face Biometrics Profile</h2>
      <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
        {success && <div style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--accent-green)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>{success}</div>}
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>Status: <strong>{status}</strong></p>

        {videoActive ? (
          <div>
            <video id="webcam-video" style={{ width: '100%', maxWidth: '480px', borderRadius: '12px', background: '#000', transform: 'scaleX(-1)' }}></video>
            <p style={{ marginTop: '10px', fontSize: '0.85rem', color: 'var(--accent-purple)' }}>Automatic hands-free enrollment active. Look straight into the camera.</p>
          </div>
        ) : (
          <button className="btn btn-primary" disabled={!modelsLoaded} onClick={handleStartCamera}>
            <Camera size={18} /> Initialize Enrollment Camera
          </button>
        )}
      </div>
    </div>
  );
}

// --- Student Mark Attendance (Blink detection & GPS verification) ---
function StudentMarkAttendance({ token, user }) {
  const [activeSession, setActiveSession] = useState(null);
  const [status, setStatus] = useState('Checking active classrooms...');
  const [success, setSuccess] = useState('');
  const [videoActive, setVideoActive] = useState(false);
  const [blinkCount, setBlinkCount] = useState(0);
  const [distance, setDistance] = useState(null);
  const [livenessThreshold, setLivenessThreshold] = useState(0.23);
  const [dbDescriptor, setDbDescriptor] = useState(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [wearingGlasses, setWearingGlasses] = useState(false);
  const [attendanceRecord, setAttendanceRecord] = useState(null);
  const [scanMode, setScanMode] = useState('checkin');

  // Coordinates
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);

  const fetchActive = () => {
    fetch('/api/sessions/active', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setActiveSession(data);
        if (data) {
          fetch(`/api/students/${user.id}/history`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
            .then(r => r.json())
            .then(history => {
              const record = Array.isArray(history) ? history.find(h => h.session_id === data.session_id) : null;
              setAttendanceRecord(record);
              if (record) {
                if (record.checkout_time) {
                  setSuccess(`You have successfully checked out of this session at ${record.checkout_time}.`);
                  setStatus('Session completed.');
                } else {
                  setScanMode('checkout');
                  setStatus('Check-in registered successfully. Proximity checkout is now active.');
                }
              } else {
                setScanMode('checkin');
                setStatus('Active session found. Ready to initialize authentication...');
              }
            })
            .catch(console.error);
        } else {
          setStatus('No active attendance window is currently running.');
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchActive();

    // Load face-api models from static models route
    setStatus('Loading AI facial models...');
    Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
      faceapi.nets.faceRecognitionNet.loadFromUri('/models')
    ]).then(() => {
      setModelsLoaded(true);
      setStatus('AI Models ready for check-in.');
    }).catch(err => {
      console.error(err);
      setStatus('Error loading AI models. Make sure weights are correctly hosted.');
    });

    // Load dynamic sensitivity settings
    fetch('/api/settings', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        const sens = data.liveness_sensitivity || 'medium';
        if (sens === 'low') setLivenessThreshold(0.26); // Easiest to trigger blink
        else if (sens === 'high') setLivenessThreshold(0.20); // Hardest to trigger blink
        else setLivenessThreshold(0.23); // Medium balanced
      })
      .catch(console.error);

    // Fetch registered descriptor
    fetch('/api/face/descriptor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ register_no: user.register_no })
    })
      .then(res => res.json())
      .then(data => {
        if (data.descriptor) {
          setDbDescriptor(new Float32Array(data.descriptor));
        }
      })
      .catch(err => {
        console.error('Failed to load registered biometrics template', err);
      });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
      },
      () => {
        setLat(10.007);
        setLng(78.325);
      }
    );
  }, []);

  const handleStartMarking = () => {
    if (!dbDescriptor) {
      setStatus('Please enroll your face bio in the "Face Registration" tab first.');
      return;
    }
    setVideoActive(true);
    setBlinkCount(0);
    setTimeout(() => {
      const video = document.getElementById('marking-video');
      if (video) {
        navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
          .then((stream) => {
            video.srcObject = stream;
            video.play();
            startFaceDetection(video);
          })
          .catch((err) => {
            console.error(err);
            setStatus('Failed to initialize webcam.');
          });
      }
    }, 200);
  };

  const startFaceDetection = async (video) => {
    setStatus('Looking for face... Stand in a well-lit area.');
    
    let eyeClosedPrev = false;
    let localBlinkCount = 0;
    let prevDescriptor = null;
    let staticFrameCount = 0;

    const interval = setInterval(async () => {
      try {
        if (!video || video.paused || video.ended) {
          clearInterval(interval);
          return;
        }

        // inputSize 224 for higher accuracy/precision in eye tracking & distance math
        const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 }))
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection) {
          setStatus('No face detected. Please ensure your face is fully visible under good lighting.');
          return;
        }

        // Anti-spoofing check for static printed photo:
        // A live human face always exhibits micro-movements, so the 128D descriptor shifts.
        // A printed static photo held in front of the camera is completely static (shift difference is virtually zero).
        const currentDesc = detection.descriptor;
        if (prevDescriptor) {
          const descDiff = faceapi.euclideanDistance(currentDesc, prevDescriptor);
          if (descDiff < 0.008) {
            staticFrameCount++;
            if (staticFrameCount > 8) { // ~1.2 seconds of completely frozen face
              setStatus('Anti-spoofing alert: Static photo detected. Please present a live face.');
              return;
            }
          } else {
            staticFrameCount = 0;
          }
        }
        prevDescriptor = currentDesc;

        // Check turned face using relative distances of nose to eye corners
        const landmarks = detection.landmarks;
        const nose = landmarks.getNose();
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();
        
        const noseTip = nose[6]; 
        const leftEyeCorner = leftEye[3]; 
        const rightEyeCorner = rightEye[0]; 

        const distToLeft = Math.abs(noseTip.x - leftEyeCorner.x);
        const distToRight = Math.abs(noseTip.x - rightEyeCorner.x);
        const ratio = Math.max(distToLeft, distToRight) / (Math.min(distToLeft, distToRight) || 1);

        if (ratio > 1.95) {
          setStatus('You have turned your face. Please keep your face straight directly facing the camera.');
          return;
        }

        // Verify Face matches the registered descriptor
        if (dbDescriptor) {
          const faceDist = faceapi.euclideanDistance(detection.descriptor, dbDescriptor);
          if (faceDist > 0.8) {
            setStatus('Face does not match registered student profile. Please adjust your stance.');
            return;
          }
        }

        // If face straight, matched, immediately submit attendance
        setStatus(scanMode === 'checkout' ? 'Face verified! Registering checkout...' : 'Face verified! Registering attendance...');
        clearInterval(interval);
        triggerMarkAttendance(Array.from(detection.descriptor));
      } catch (err) {
        console.error('Check-in loop error:', err);
        setStatus('Check-in error: ' + err.message);
      }
    }, 100);
  };

  const triggerMarkAttendance = async (descriptorArray) => {
    setStatus('Face verified! Validating GPS radius matching...');
    const endpoint = scanMode === 'checkout' ? '/api/attendance/checkout' : '/api/attendance/mark';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          session_id: activeSession.session_id,
          latitude: lat,
          longitude: lng,
          descriptor: descriptorArray
        })
      });
      const data = await res.json();
      if (res.ok) {
        if (scanMode === 'checkout') {
          setSuccess(`You have successfully checked out of this session at ${data.checkout_time}.`);
          setStatus('Session completed.');
        } else {
          setSuccess('Attendance registered! PRESENT status finalized.');
          setStatus('Success');
        }
        setDistance(data.distance);
        fetchActive();
      } else {
        setStatus(data.message || 'GPS proximity validation failed.');
      }
    } catch (err) {
      console.error(err);
      setStatus('Failed to upload validation logs.');
    }

    // Shut down video
    const video = document.getElementById('marking-video');
    if (video && video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
    }
    setVideoActive(false);
  };

  return (
    <div className="animated-fade" style={{ maxWidth: '600px' }}>
      <h2 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '20px' }}>Face Check-in & Check-out</h2>
      <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
        {success && (
          <div style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--accent-green)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
            <p>{success}</p>
            {distance !== null && <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>Class Proximity Distance: {distance} meters</p>}
          </div>
        )}
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>Status: <strong>{status}</strong></p>

        {activeSession && (!attendanceRecord || !attendanceRecord.checkout_time) && (
          <div>
            <div style={{ borderLeft: '4px solid var(--accent-blue)', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', marginBottom: '20px', textAlign: 'left' }}>
              <p style={{ fontSize: '0.95rem' }}>Subject: <strong>{activeSession.subject_name}</strong></p>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>Class: {activeSession.class_name}</p>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>Period Time Range: <strong>{activeSession.time_range || 'N/A'}</strong></p>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>GPS Target Area Radius: <strong>{activeSession.gps_radius || 100}m</strong></p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Session Coordinator: {activeSession.teacher_name}</p>
            </div>

            {videoActive ? (
              <div>
                <video id="marking-video" style={{ width: '100%', maxWidth: '480px', borderRadius: '12px', background: '#000', transform: 'scaleX(-1)' }}></video>
              </div>
            ) : (
              <button className="btn btn-primary" disabled={!modelsLoaded} onClick={handleStartMarking}>
                <Camera size={18} /> {modelsLoaded ? (scanMode === 'checkout' ? 'Run Check-out Verification Scan' : 'Run Check-in Verification Scan') : 'Loading facial models...'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Student History Logs Component ---
function StudentHistory({ token, user }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetch(`/api/students/${user.id}/history`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(setHistory)
      .catch(console.error);
  }, []);

  return (
    <div className="animated-fade">
      <h2 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '20px' }}>Your Attendance History Log</h2>
      <div className="glass-panel" style={{ overflowX: 'auto' }}>
        <table className="custom-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Subject</th>
              <th>Class</th>
              <th>Coordinator</th>
              <th>GPS Distance</th>
              <th>Final Status</th>
            </tr>
          </thead>
          <tbody>
            {history.map(h => (
              <tr key={h.attendance_id}>
                <td>{h.attendance_date}</td>
                <td>{h.attendance_time}</td>
                <td>{h.subject_name}</td>
                <td>{h.class_name}</td>
                <td>{h.teacher_name}</td>
                <td>{h.distance ? `${Math.round(h.distance)} meters` : 'Manual/NA'}</td>
                <td>
                  <span className={`badge ${h.status === 'PRESENT' ? 'badge-present' : 'badge-absent'}`}>
                    {h.status}
                  </span>
                </td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No records logged yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Student Profile Card & Summary Overview ---
function StudentProfile({ token, user }) {
  return (
    <div className="animated-fade" style={{ maxWidth: '650px' }}>
      <h2 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '24px' }}>My Profile Details</h2>

      <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '24px' }}>
          <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '2.5rem', fontWeight: '800', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            {user.face_image ? (
              <img src={user.face_image} alt="Profile Snapshot" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              user.name ? user.name[0].toUpperCase() : 'S'
            )}
          </div>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <h3 style={{ fontSize: '1.6rem', fontWeight: '700', marginBottom: '6px' }}>{user.name}</h3>
            <span className="badge badge-present" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>Student Profile Verified</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Registration Number</p>
            <p style={{ fontSize: '1.05rem', fontWeight: '600' }}>{user.register_no}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Department</p>
            <p style={{ fontSize: '1.05rem', fontWeight: '600' }}>{user.department}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Registered Email</p>
            <p style={{ fontSize: '1.05rem', fontWeight: '600' }}>{user.email}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Parent Alert Email</p>
            <p style={{ fontSize: '1.05rem', fontWeight: '600' }}>{user.parent_email || 'Not Configured'}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>Biometric Enrollment Status</p>
            <span className={`badge ${user.hasFace ? 'badge-present' : 'badge-absent'}`} style={{ marginTop: '4px' }}>
              {user.hasFace ? 'Face template registered' : 'No biometric profile found'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Teacher Search Student Registry & Attendance Logs Component ---
function TeacherSearchRegistry({ token }) {
  const [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetch('/api/students', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(setStudents)
      .catch(console.error);
  }, []);

  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
    fetch(`/api/students/${student.student_id}/history`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(setHistory)
      .catch(console.error);
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.register_no.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="animated-fade">
      <h2 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '24px' }}>Student Registry & Search Logs</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', flexWrap: 'wrap' }}>
        {/* Student Lookup list */}
        <div className="glass-panel" style={{ padding: '20px', height: 'fit-content' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Registered Students</h3>
          <input 
            type="text" 
            placeholder="Search by name / reg number..." 
            className="form-control" 
            style={{ marginBottom: '16px' }}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
            {filteredStudents.map(s => (
              <button 
                key={s.student_id} 
                className="btn btn-secondary" 
                style={{ 
                  justifyContent: 'flex-start', 
                  width: '100%',
                  background: selectedStudent?.student_id === s.student_id ? 'rgba(99,102,241,0.06)' : 'transparent',
                  border: selectedStudent?.student_id === s.student_id ? '1px solid var(--accent-purple)' : '1px solid var(--border-color)'
                }}
                onClick={() => handleSelectStudent(s)}
              >
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontWeight: '600', fontSize: '0.9rem' }}>{s.name}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Reg: {s.register_no} | {s.department}</p>
                </div>
              </button>
            ))}
            {filteredStudents.length === 0 && <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.85rem' }}>No student records found.</p>}
          </div>
        </div>

        {/* Attendance log view */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          {selectedStudent ? (
            <div>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: '700' }}>Attendance Logs: {selectedStudent.name}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Reg No: {selectedStudent.register_no} | Dept: {selectedStudent.department} | Email: {selectedStudent.email}</p>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Subject</th>
                      <th>Class</th>
                      <th>GPS Dist</th>
                      <th>Status</th>
                      <th>Mail Notification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(h => (
                      <tr key={h.attendance_id}>
                        <td>{h.attendance_date}</td>
                        <td>{h.attendance_time}</td>
                        <td>{h.subject_name}</td>
                        <td>{h.class_name}</td>
                        <td>{h.distance ? `${Math.round(h.distance)}m` : 'N/A'}</td>
                        <td>
                          <span className={`badge ${h.status === 'PRESENT' ? 'badge-present' : 'badge-absent'}`}>
                            {h.status}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${h.absent_email_status === 'SENT' ? 'badge-present' : h.absent_email_status === 'FAILED' ? 'badge-absent' : 'badge-secondary'}`} style={{ fontSize: '0.65rem' }}>
                            {h.absent_email_status || 'N/A'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {history.length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No records logged yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
              <Users size={48} style={{ marginBottom: '16px', opacity: 0.4, display: 'inline-block' }} />
              <p>Select a student from the sidebar lookup to load history registry data.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Advanced Analytical Reports Generator Component ---
function ReportsGenerator({ token, user }) {
  const [records, setRecords] = useState([]);
  const [reportType, setReportType] = useState('all'); // 'all', 'daily', 'weekly', 'monthly', 'subject'
  const [selectedSubject, setSelectedSubject] = useState('');
  const [subjects, setSubjects] = useState([]);

  useEffect(() => {
    fetch('/api/analytics/reports', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setRecords(data || []);
        // Extract unique subjects list
        const subs = Array.from(new Set((data || []).map(r => r.subject_name)));
        setSubjects(subs);
      })
      .catch(console.error);
  }, []);

  // Filter records based on report type & subject selection
  const filteredRecords = records.filter(rec => {
    // Subject filter
    if (selectedSubject && rec.subject_name.toLowerCase() !== selectedSubject.toLowerCase()) {
      return false;
    }

    const today = new Date().toISOString().split('T')[0];
    const recDate = new Date(rec.attendance_date);

    if (reportType === 'daily') {
      return rec.attendance_date === today;
    } else if (reportType === 'weekly') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      return recDate >= oneWeekAgo;
    } else if (reportType === 'monthly') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      return recDate >= oneMonthAgo;
    }
    return true;
  });

  const handleExportCSV = () => {
    if (filteredRecords.length === 0) return;
    const csvRows = [];
    const headers = ['Attendance Date', 'Attendance Time', 'Student Name', 'Register No', 'Department', 'Subject', 'Class', 'Distance (m)', 'Status', 'Mail Status'];
    csvRows.push(headers.join(','));

    filteredRecords.forEach(rec => {
      const values = [
        rec.attendance_date,
        rec.attendance_time,
        rec.student_name,
        rec.register_no,
        rec.department,
        rec.subject_name,
        rec.class_name,
        rec.distance ? Math.round(rec.distance) : 'N/A',
        rec.status,
        rec.absent_email_status || 'N/A'
      ];
      csvRows.push(values.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Attendance_Report_${reportType}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="animated-fade">
      <h2 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '24px' }}>Advanced Reports Module</h2>

      {/* Reports Config Bar */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '30px', display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '180px' }}>
          <label className="form-label">Breakdown Duration Period</label>
          <select className="form-control" value={reportType} onChange={e => setReportType(e.target.value)}>
            <option value="all">All Logs Historical</option>
            <option value="daily">Daily Attendance logs (Today)</option>
            <option value="weekly">Weekly Attendance breakdown</option>
            <option value="monthly">Monthly Attendance breakdown</option>
          </select>
        </div>

        <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '180px' }}>
          <label className="form-label">Subject Category Filter</label>
          <select className="form-control" value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
            <option value="">-- All Subjects --</option>
            {subjects.map((sub, i) => (
              <option key={i} value={sub}>{sub}</option>
            ))}
          </select>
        </div>

        <button className="btn btn-primary" onClick={handleExportCSV} disabled={filteredRecords.length === 0} style={{ height: '46px' }}>
          Export Report sheets (CSV)
        </button>
      </div>

      {/* Reports Data list */}
      <div className="glass-panel" style={{ overflowX: 'auto' }}>
        <table className="custom-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Student Name</th>
              <th>Register No</th>
              <th>Subject</th>
              <th>Class</th>
              <th>Time</th>
              <th>GPS Dist</th>
              <th>Status</th>
              <th>Mail Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((r, i) => (
              <tr key={i}>
                <td>{r.attendance_date}</td>
                <td>{r.student_name}</td>
                <td>{r.register_no}</td>
                <td>{r.subject_name}</td>
                <td>{r.class_name}</td>
                <td>{r.attendance_time}</td>
                <td>{r.distance ? `${Math.round(r.distance)}m` : 'N/A'}</td>
                <td>
                  <span className={`badge ${r.status === 'PRESENT' ? 'badge-present' : 'badge-absent'}`}>
                    {r.status}
                  </span>
                </td>
                <td>
                  <span className={`badge ${r.absent_email_status === 'SENT' ? 'badge-present' : r.absent_email_status === 'FAILED' ? 'badge-absent' : 'badge-secondary'}`} style={{ fontSize: '0.65rem' }}>
                    {r.absent_email_status || 'N/A'}
                  </span>
                </td>
              </tr>
            ))}
            {filteredRecords.length === 0 && (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>No records logged matching these breakdown parameters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Student Details Directory Component (For Admin / Teacher View) ---
function StudentDetails({ token, role }) {
  const [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchStudentsList = () => {
    fetch('/api/students', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setStudents(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  useEffect(() => {
    fetchStudentsList();
  }, []);

  const handleAllowReEnroll = async (studentId) => {
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/students/${studentId}/allow-reenroll`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message);
        fetchStudentsList();
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        alert(data.message || 'Failed to grant re-enroll permission.');
      }
    } catch (e) {
      console.error(e);
      alert('Network error while granting re-enrollment permission.');
    }
  };

  const handleDeleteStudent = async (id) => {
    if (confirm('Are you sure you want to delete this student profile and all their attendance records? This action is permanent.')) {
      try {
        const res = await fetch(`/api/students/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          setSuccessMsg(data.message || 'Student and attendance records deleted.');
          fetchStudentsList();
          setTimeout(() => setSuccessMsg(''), 4000);
        } else {
          alert(data.message || 'Failed to delete student.');
        }
      } catch (e) {
        console.error(e);
        alert('Network error while deleting student.');
      }
    }
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.register_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="animated-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: '700' }}>Student details directory</h2>
        <input 
          type="text" 
          placeholder="Search by name, reg no, or department..." 
          className="form-control" 
          style={{ maxWidth: '320px', width: '100%' }}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {successMsg && (
        <div style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--accent-green)', padding: '12px 18px', borderRadius: 'var(--radius-md)', marginBottom: '20px', border: '1px solid rgba(16,185,129,0.25)', fontSize: '0.9rem' }}>
          {successMsg}
        </div>
      )}

      {/* Profile Photo Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
        {filteredStudents.map(student => (
          <div key={student.student_id} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative' }}>
            
            {/* Registered Face Photo or initials */}
            <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '2.5rem', fontWeight: '800', marginBottom: '16px', overflow: 'hidden', border: '3px solid rgba(255,255,255,0.8)', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
              {student.face_image ? (
                <img src={student.face_image} alt={`${student.name}'s Face Snapshot`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                student.name ? student.name[0].toUpperCase() : 'S'
              )}
            </div>

            {/* Profile Info */}
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '4px' }}>{student.name}</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {student.department}
            </span>

            <div style={{ width: '100%', borderTop: '1px solid var(--border-color)', paddingTop: '12px', margin: '8px 0', fontSize: '0.85rem', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <p style={{ color: 'var(--text-secondary)' }}>Reg No: <strong style={{ color: 'var(--text-primary)' }}>{student.register_no}</strong></p>
              <p style={{ color: 'var(--text-secondary)' }}>Email: <strong style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>{student.email}</strong></p>
              <p style={{ color: 'var(--text-secondary)' }}>Parent: <strong style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>{student.parent_email}</strong></p>
            </div>

            {/* Enrolled Badge & Action */}
            <div style={{ marginTop: 'auto', paddingTop: '16px', width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span className={`badge ${student.hasFace ? 'badge-present' : 'badge-absent'}`} style={{ alignSelf: 'center', padding: '6px 12px' }}>
                {student.hasFace ? 'Face Enrolled' : 'Face Pending'}
              </span>

              {student.hasFace && role === 'teacher' && (
                <button 
                  className={`btn ${student.re_enroll_allowed ? 'btn-secondary' : 'btn-primary'}`} 
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.8rem' }}
                  disabled={!!student.re_enroll_allowed}
                  onClick={() => handleAllowReEnroll(student.student_id)}
                >
                  {student.re_enroll_allowed ? '🔓 Re-enroll Granted' : '🔒 Allow Re-enrollment'}
                </button>
              )}

              {role === 'admin' && (
                <button 
                  className="btn btn-secondary" 
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-red)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                  onClick={() => handleDeleteStudent(student.student_id)}
                >
                  Delete Student Profile
                </button>
              )}
            </div>

          </div>
        ))}
      </div>
      
      {filteredStudents.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
          <p>No student details matching this search filter.</p>
        </div>
      )}
    </div>
  );
}

// --- Student Leave Requests Component ---
function StudentLeaveRequests({ token, user }) {
  const [leaves, setLeaves] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [teacherId, setTeacherId] = useState('');
  const [leaveDate, setLeaveDate] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');

  const fetchLeaves = () => {
    fetch('/api/leaves/student', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setLeaves(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  const fetchTeachers = () => {
    fetch('/api/teachers', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        setTeachers(Array.isArray(data) ? data : []);
        if (data.length > 0) setTeacherId(data[0].teacher_id);
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchLeaves();
    fetchTeachers();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    try {
      const res = await fetch('/api/leaves/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ teacher_id: Number(teacherId), leave_date: leaveDate, reason })
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(data.message);
        setLeaveDate('');
        setReason('');
        fetchLeaves();
      } else {
        alert(data.message || 'Failed to submit leave.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="animated-fade" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
      <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.4rem', fontWeight: '700', marginBottom: '16px' }}>Submit Leave Request</h3>
        {msg && <div style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--accent-green)', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>{msg}</div>}
        
        <div className="form-group">
          <label className="form-label">Select Teacher</label>
          <select className="form-control" value={teacherId} onChange={e => setTeacherId(e.target.value)}>
            {teachers.map(t => <option key={t.teacher_id} value={t.teacher_id}>{t.name} ({t.department})</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Leave Date</label>
          <input type="date" required className="form-control" value={leaveDate} onChange={e => setLeaveDate(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Reason / Explanation</label>
          <textarea required placeholder="Write leave reasons details..." className="form-control" style={{ minHeight: '80px' }} value={reason} onChange={e => setReason(e.target.value)} />
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>Submit Leave</button>
      </form>

      <div>
        <h3 style={{ fontSize: '1.4rem', fontWeight: '700', marginBottom: '16px' }}>My Leave Filings</h3>
        <div className="glass-panel" style={{ padding: '0px', overflow: 'hidden' }}>
          <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Teacher</th>
                  <th>Reason</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontSize: '0.85rem' }}>{l.leave_date}</td>
                    <td style={{ fontSize: '0.85rem' }}>{l.teacher_name}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{l.reason}</td>
                    <td>
                      <span className={`badge ${l.status === 'APPROVED' ? 'badge-present' : (l.status === 'REJECTED' ? 'badge-absent' : 'badge-override')}`}>
                        {l.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {leaves.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>No leaves requested yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Student OD (On Duty) Requests Component ---
function StudentODRequests({ token, user }) {
  const [ods, setOds] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [teacherId, setTeacherId] = useState('');
  const [eventName, setEventName] = useState('');
  const [category, setCategory] = useState('Hackathon');
  const [eventDate, setEventDate] = useState('');
  const [description, setDescription] = useState('');
  const [msg, setMsg] = useState('');

  const fetchOds = () => {
    fetch('/api/od/student', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setOds(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  const fetchTeachers = () => {
    fetch('/api/teachers', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        setTeachers(Array.isArray(data) ? data : []);
        if (data.length > 0) setTeacherId(data[0].teacher_id);
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchOds();
    fetchTeachers();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    try {
      const res = await fetch('/api/od/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 
          teacher_id: Number(teacherId), 
          event_name: eventName, 
          category, 
          event_date: eventDate, 
          description 
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(data.message);
        setEventName('');
        setEventDate('');
        setDescription('');
        fetchOds();
      } else {
        alert(data.message || 'Failed to submit OD.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="animated-fade" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
      <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.4rem', fontWeight: '700', marginBottom: '16px' }}>Submit OD Request</h3>
        {msg && <div style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--accent-green)', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>{msg}</div>}
        
        <div className="form-group">
          <label className="form-label">Select Approving Teacher</label>
          <select className="form-control" value={teacherId} onChange={e => setTeacherId(e.target.value)}>
            {teachers.map(t => <option key={t.teacher_id} value={t.teacher_id}>{t.name} ({t.department})</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Event Name</label>
          <input type="text" required placeholder="Smart India Hackathon 2026" className="form-control" value={eventName} onChange={e => setEventName(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">OD Category</label>
          <select className="form-control" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="Hackathon">Hackathon</option>
            <option value="Event">Department Event</option>
            <option value="Club">College Club Activity</option>
            <option value="Other">Other Official Assignment</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Event Date</label>
          <input type="date" required className="form-control" value={eventDate} onChange={e => setEventDate(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Event Details / Description</label>
          <textarea required placeholder="Provide details like team name, college venue..." className="form-control" style={{ minHeight: '80px' }} value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>Submit OD Request</button>
      </form>

      <div>
        <h3 style={{ fontSize: '1.4rem', fontWeight: '700', marginBottom: '16px' }}>My OD Filings</h3>
        <div className="glass-panel" style={{ padding: '0px', overflow: 'hidden' }}>
          <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Event details</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {ods.map(o => (
                  <tr key={o.id}>
                    <td>
                      <strong style={{ fontSize: '0.85rem' }}>{o.event_name}</strong>
                      <br/>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Filer Teacher: {o.teacher_name}</span>
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>{o.category}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{o.event_date}</td>
                    <td>
                      <span className={`badge ${o.status === 'APPROVED' ? 'badge-present' : (o.status === 'REJECTED' ? 'badge-absent' : 'badge-override')}`}>
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {ods.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>No ODs requested yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Teacher Leave Requests Approval Dashboard ---
function TeacherLeaveRequests({ token }) {
  const [leaves, setLeaves] = useState([]);

  const fetchLeaves = () => {
    fetch('/api/leaves/teacher', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setLeaves(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleApprove = async (id) => {
    const res = await fetch(`/api/leaves/${id}/approve`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) fetchLeaves();
  };

  const handleReject = async (id) => {
    const res = await fetch(`/api/leaves/${id}/reject`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) fetchLeaves();
  };

  return (
    <div className="animated-fade">
      <h2 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '24px' }}>Leave Approval Registry</h2>
      <div className="glass-panel" style={{ padding: '0px', overflow: 'hidden' }}>
        <table className="table" style={{ margin: 0 }}>
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Reg No / Dept</th>
              <th>Leave Date</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Action approvals</th>
            </tr>
          </thead>
          <tbody>
            {leaves.map(l => (
              <tr key={l.id}>
                <td><strong>{l.student_name}</strong></td>
                <td style={{ fontSize: '0.85rem' }}>{l.register_no} / {l.department}</td>
                <td style={{ fontSize: '0.85rem' }}>{l.leave_date}</td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{l.reason}</td>
                <td>
                  <span className={`badge ${l.status === 'APPROVED' ? 'badge-present' : (l.status === 'REJECTED' ? 'badge-absent' : 'badge-override')}`}>
                    {l.status}
                  </span>
                </td>
                <td>
                  {l.status === 'PENDING' && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => handleApprove(l.id)}>Approve</button>
                      <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '0.75rem', background: '#ef4444' }} onClick={() => handleReject(l.id)}>Reject</button>
                    </div>
                  )}
                  {l.status !== 'PENDING' && <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Reviewed</span>}
                </td>
              </tr>
            ))}
            {leaves.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '32px' }}>No student leave requests pending review.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Teacher OD Requests Approval Dashboard ---
function TeacherODRequests({ token }) {
  const [ods, setOds] = useState([]);

  const fetchOds = () => {
    fetch('/api/od/teacher', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setOds(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  useEffect(() => {
    fetchOds();
  }, []);

  const handleApprove = async (id) => {
    const res = await fetch(`/api/od/${id}/approve`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) fetchOds();
  };

  const handleReject = async (id) => {
    const res = await fetch(`/api/od/${id}/reject`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) fetchOds();
  };

  return (
    <div className="animated-fade">
      <h2 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '24px' }}>On-Duty (OD) Approval Registry</h2>
      <div className="glass-panel" style={{ padding: '0px', overflow: 'hidden' }}>
        <table className="table" style={{ margin: 0 }}>
          <thead>
            <tr>
              <th>Student details</th>
              <th>Event name</th>
              <th>Category</th>
              <th>Date</th>
              <th>Description</th>
              <th>Status</th>
              <th>Action approvals</th>
            </tr>
          </thead>
          <tbody>
            {ods.map(o => (
              <tr key={o.id}>
                <td>
                  <strong>{o.student_name}</strong>
                  <br/>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{o.register_no} ({o.department})</span>
                </td>
                <td style={{ fontSize: '0.85rem' }}>{o.event_name}</td>
                <td style={{ fontSize: '0.85rem' }}>{o.category}</td>
                <td style={{ fontSize: '0.85rem' }}>{o.event_date}</td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{o.description}</td>
                <td>
                  <span className={`badge ${o.status === 'APPROVED' ? 'badge-present' : (o.status === 'REJECTED' ? 'badge-absent' : 'badge-override')}`}>
                    {o.status}
                  </span>
                </td>
                <td>
                  {o.status === 'PENDING' && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => handleApprove(o.id)}>Approve</button>
                      <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '0.75rem', background: '#ef4444' }} onClick={() => handleReject(o.id)}>Reject</button>
                    </div>
                  )}
                  {o.status !== 'PENDING' && <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Reviewed</span>}
                </td>
              </tr>
            ))}
            {ods.length === 0 && (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '32px' }}>No student OD requests pending review.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Student Attendance Dashboard Component ---
function StudentAttendanceDashboard({ token, user }) {
  const [history, setHistory] = useState([]);
  const [chartType, setChartType] = useState(localStorage.getItem('studentChartType') || 'bar');

  useEffect(() => {
    fetch(`/api/students/${user.id}/history`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(setHistory)
      .catch(console.error);
  }, []);

  const totalSessions = history.length;
  const presentSessions = history.filter(h => h.status === 'PRESENT').length;
  const rate = totalSessions > 0 ? Math.round((presentSessions / totalSessions) * 100) : 100;

  // Group by Date for Chart
  const dailyGroups = {};
  history.forEach(h => {
    const key = h.attendance_date;
    if (!dailyGroups[key]) dailyGroups[key] = { present: 0, total: 0 };
    dailyGroups[key].total++;
    if (h.status === 'PRESENT') dailyGroups[key].present++;
  });

  const sortedDates = Object.keys(dailyGroups).sort((a, b) => a.localeCompare(b));
  const dailyPercentage = sortedDates.map(date => {
    const g = dailyGroups[date];
    return Math.round((g.present / g.total) * 100);
  });

  const chartData = {
    labels: sortedDates,
    datasets: [{
      label: 'Attendance Rate (%)',
      data: dailyPercentage,
      backgroundColor: 'rgba(99, 102, 241, 0.4)',
      borderColor: 'rgba(99, 102, 241, 1)',
      borderWidth: 2,
      fill: true,
      tension: 0.3
    }]
  };

  const handleChartTypeChange = (type) => {
    setChartType(type);
    localStorage.setItem('studentChartType', type);
  };

  return (
    <div className="animated-fade">
      <h2 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '24px' }}>My Attendance Dashboard</h2>

      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <div className="glass-panel" style={{ padding: '20px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Overall Attendance</p>
          <h3 style={{ fontSize: '2.2rem', fontWeight: '800', marginTop: '8px', color: rate >= 75 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{rate}%</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{rate >= 75 ? 'Good standing' : '⚠️ Critical alert (below 75%)'}</span>
        </div>
        <div className="glass-panel" style={{ padding: '20px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Classes Attended</p>
          <h3 style={{ fontSize: '2.2rem', fontWeight: '800', marginTop: '8px' }}>{presentSessions} / {totalSessions}</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total class sessions logged</span>
        </div>
      </div>

      {/* Chart Panel */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Daily Attendance Trend</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className={`btn ${chartType === 'bar' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => handleChartTypeChange('bar')}>Bar Chart</button>
            <button className={`btn ${chartType === 'line' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => handleChartTypeChange('line')}>Line Chart</button>
          </div>
        </div>

        <div style={{ height: '300px' }}>
          {sortedDates.length > 0 ? (
            chartType === 'bar' ? (
              <Bar 
                data={chartData} 
                options={{ 
                  responsive: true, 
                  maintainAspectRatio: false,
                  scales: { y: { min: 0, max: 100 } }
                }} 
              />
            ) : (
              <Line 
                data={chartData} 
                options={{ 
                  responsive: true, 
                  maintainAspectRatio: false,
                  scales: { y: { min: 0, max: 100 } }
                }} 
              />
            )
          ) : <p style={{ color: 'var(--text-secondary)', textAlign: 'center', paddingTop: '100px' }}>No session data found to plot trend.</p>}
        </div>
      </div>
    </div>
  );
}
