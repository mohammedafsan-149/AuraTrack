const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const db = require('./database');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_face_attendance_key';

app.use(cors());
app.use(express.json());

// Serve static models for face-api.js
app.use('/models', express.static(path.join(__dirname, 'models')));

// --- Helper Functions ---

// Haversine Formula for distance calculation in meters
function getHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

function getEuclideanDistance(arr1, arr2) {
  if (!arr1 || !arr2 || arr1.length !== arr2.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < arr1.length; i++) {
    sum += (arr1[i] - arr2[i]) * (arr1[i] - arr2[i]);
  }
  return Math.sqrt(sum);
}

// Middleware for JWT Verification
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// Nodemailer Transporter Setup
// We use a mock or environment-based SMTP transporter.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: process.env.SMTP_PORT || 587,
  auth: {
    user: process.env.SMTP_USER || '', // Configure real values in .env
    pass: process.env.SMTP_PASS || '',
  },
});

// Helper to auto-close expired active sessions and process absentees
function checkAndCloseExpiredSessions() {
  const now = new Date().toISOString();
  const activeSessions = db.prepare('SELECT * FROM attendance_sessions WHERE session_status = ?').all('ACTIVE');

  for (const session of activeSessions) {
    if (now > session.end_time) {
      db.prepare('UPDATE attendance_sessions SET session_status = ? WHERE session_id = ?').run('COMPLETED', session.session_id);
      triggerAbsenteeProcessing(session.session_id);
    }
  }
}

// Send absent emails to parents
function triggerAbsenteeProcessing(sessionId) {
  try {
    const session = db.prepare('SELECT * FROM attendance_sessions WHERE session_id = ?').get(sessionId);
    if (!session) return;

    // Get all students
    const students = db.prepare('SELECT * FROM students').all();

    // Check who marked attendance
    const presentStudents = db.prepare('SELECT student_id FROM attendance WHERE session_id = ?').all(sessionId);
    const presentIds = new Set(presentStudents.map(p => p.student_id));

    const absentStudents = students.filter(s => !presentIds.has(s.student_id));

    for (const student of absentStudents) {
      let recordId;
      const exists = db.prepare('SELECT * FROM attendance WHERE session_id = ? AND student_id = ?').get(sessionId, student.student_id);
      if (!exists) {
        const res = db.prepare(`
          INSERT INTO attendance (session_id, student_id, attendance_date, attendance_time, status)
          VALUES (?, ?, ?, ?, ?)
        `).run(sessionId, student.student_id, new Date().toISOString().split('T')[0], 'N/A', 'ABSENT');
        recordId = res.lastInsertRowid;
      } else {
        recordId = exists.attendance_id;
      }

      // Send email alert
      const mailOptions = {
        from: '"Smart AI Attendance" <no-reply@system.com>',
        to: student.parent_email,
        subject: `Absence Alert: ${student.name}`,
        text: `Dear Parent,\n\nYour ward ${student.name} (Reg No: ${student.register_no}) was marked ABSENT for the subject "${session.subject_name}" in class "${session.class_name}" on ${new Date().toLocaleDateString()}.\n\nRegards,\nSchool Administration`,
      };

      transporter.sendMail(mailOptions, (err, info) => {
        let emailStatus = 'SENT';
        if (err) {
          emailStatus = 'FAILED';
          console.error(`Failed to send email to ${student.parent_email}:`, err.message);
        } else {
          console.log(`Notification sent to parent of ${student.name}: ${nodemailer.getTestMessageUrl(info) || 'OK'}`);
        }
        // Save the delivery status directly
        db.prepare('UPDATE attendance SET absent_email_status = ? WHERE attendance_id = ?').run(emailStatus, recordId);
      });
    }
  } catch (error) {
    console.error('Error processing absentees:', error);
  }
}

// --- Auth APIs ---

app.post('/api/auth/login', (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ message: 'Missing fields' });
  }

  let user = null;
  let userIdField = 'id';

  if (role === 'admin') {
    user = db.prepare('SELECT * FROM admins WHERE email = ?').get(username);
    userIdField = 'id';
  } else if (role === 'teacher') {
    user = db.prepare('SELECT * FROM teachers WHERE email = ?').get(username);
    userIdField = 'teacher_id';
  } else if (role === 'student') {
    user = db.prepare('SELECT * FROM students WHERE email = ? OR register_no = ?').get(username, username);
    userIdField = 'student_id';
  }

  if (!user) {
    return res.status(401).json({ message: 'User not found' });
  }

  const isMatch = bcrypt.compareSync(password, user.password);
  // Support plain text or hashed comparison for quick testing
  const finalMatch = isMatch || password === user.password;

  if (!finalMatch) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user[userIdField], email: user.email, role }, JWT_SECRET, { expiresIn: '8h' });

  res.json({
    token,
    user: {
      id: user[userIdField],
      name: user.name,
      email: user.email,
      role,
      department: user.department || null,
      register_no: user.register_no || null,
      hasFace: !!user.face_descriptor,
      face_image: user.face_image || null,
      re_enroll_allowed: user.re_enroll_allowed || 0,
    },
  });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  try {
    if (req.user.role === 'student') {
      const student = db.prepare('SELECT * FROM students WHERE student_id = ?').get(req.user.id);
      if (!student) return res.status(404).json({ message: 'Student profile not found.' });
      return res.json({
        id: student.student_id,
        name: student.name,
        email: student.email,
        role: 'student',
        department: student.department || null,
        register_no: student.register_no || null,
        hasFace: !!student.face_descriptor,
        face_image: student.face_image || null,
        re_enroll_allowed: student.re_enroll_allowed || 0,
      });
    } else if (req.user.role === 'teacher') {
      const teacher = db.prepare('SELECT * FROM teachers WHERE teacher_id = ?').get(req.user.id);
      if (!teacher) return res.status(404).json({ message: 'Teacher profile not found.' });
      return res.json({
        id: teacher.teacher_id,
        name: teacher.name,
        email: teacher.email,
        role: 'teacher',
        department: teacher.department || null,
      });
    } else if (req.user.role === 'admin') {
      const admin = db.prepare('SELECT * FROM admins WHERE admin_id = ?').get(req.user.id);
      if (!admin) return res.status(404).json({ message: 'Admin profile not found.' });
      return res.json({
        id: admin.admin_id,
        name: admin.name,
        email: admin.email,
        role: 'admin',
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- Settings APIs ---

app.get('/api/settings/public', (req, res) => {
  const settings = db.prepare('SELECT * FROM system_settings LIMIT 1').get() || { org_name: '', enable_org_name: 0 };
  res.json({
    org_name: settings.org_name || '',
    enable_org_name: settings.enable_org_name !== undefined ? !!settings.enable_org_name : false
  });
});

app.get('/api/settings', authenticateToken, (req, res) => {
  const settings = db.prepare('SELECT * FROM system_settings LIMIT 1').get();
  res.json(settings || { 
    gps_radius: 100, 
    session_duration: 5, 
    liveness_sensitivity: 'medium', 
    email_notifications: true, 
    gps_bypass: false, 
    email_threshold: 75,
    org_name: '',
    enable_org_name: 0,
    org_address: '',
    org_website: ''
  });
});

app.put('/api/settings', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admins only' });
  const { gps_radius, session_duration, liveness_sensitivity, email_notifications, gps_bypass, email_threshold, org_name, enable_org_name, org_address, org_website } = req.body;

  db.prepare('UPDATE system_settings SET gps_radius = ?, session_duration = ?, liveness_sensitivity = ?, email_notifications = ?, gps_bypass = ?, email_threshold = ?, org_name = ?, enable_org_name = ?, org_address = ?, org_website = ? WHERE setting_id = 1')
    .run(gps_radius, session_duration, liveness_sensitivity, email_notifications, gps_bypass, email_threshold, org_name || '', enable_org_name ? 1 : 0, org_address || '', org_website || '');
  
  res.json({ message: 'Settings updated successfully', gps_radius, session_duration, liveness_sensitivity, email_notifications, gps_bypass, email_threshold, org_name, enable_org_name, org_address, org_website });
});

app.get('/api/settings/mail-logs', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admins only' });
  const logs = db.prepare('SELECT * FROM mail_logs').all();
  res.json(logs);
});

// --- Students CRUD APIs ---

app.get('/api/students', authenticateToken, (req, res) => {
  const students = db.prepare('SELECT * FROM students').all();
  // Map descriptor presence
  const response = students.map(s => ({
    ...s,
    hasFace: !!s.face_descriptor,
    face_descriptor: undefined // Don't send heavy arrays down unless needed
  }));
  res.json(response);
});

app.post('/api/students', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admins only' });
  const { name, register_no, email, parent_email, department, password } = req.body;

  try {
    const hashedPassword = bcrypt.hashSync(password || 'student123', 10);
    db.prepare(`
      INSERT INTO students (name, register_no, email, parent_email, department, password)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, register_no, email, parent_email, department, hashedPassword);
    res.json({ message: 'Student created successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.put('/api/students/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admins only' });
  const { name, register_no, email, parent_email, department } = req.body;

  try {
    db.prepare(`
      UPDATE students SET name = ?, register_no = ?, email = ?, parent_email = ?, department = ?
      WHERE student_id = ?
    `).run(name, register_no, email, parent_email, department, req.params.id);
    res.json({ message: 'Student updated successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete('/api/students/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admins only' });
  db.prepare('DELETE FROM students WHERE student_id = ?').run(req.params.id);
  db.prepare('DELETE FROM attendance WHERE student_id = ?').run(req.params.id);
  res.json({ message: 'Student and attendance records deleted successfully' });
});

app.put('/api/students/:id/allow-reenroll', authenticateToken, (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ message: 'Authorized teachers only.' });
  }
  try {
    db.prepare('UPDATE students SET re_enroll_allowed = 1 WHERE student_id = ?').run(req.params.id);
    res.json({ message: 'Re-enrollment permissions successfully granted for this student.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- Teachers CRUD APIs ---

app.get('/api/teachers', authenticateToken, (req, res) => {
  const teachers = db.prepare('SELECT teacher_id, name, email, department FROM teachers').all();
  res.json(teachers);
});

app.post('/api/teachers', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admins only' });
  const { name, email, department, password } = req.body;

  try {
    const hashedPassword = bcrypt.hashSync(password || 'teacher123', 10);
    db.prepare(`
      INSERT INTO teachers (name, email, password, department)
      VALUES (?, ?, ?, ?)
    `).run(name, email, hashedPassword, department);
    res.json({ message: 'Teacher created successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.put('/api/teachers/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admins only' });
  const { name, email, department } = req.body;

  try {
    db.prepare(`
      UPDATE teachers SET name = ?, email = ?, department = ?
      WHERE teacher_id = ?
    `).run(name, email, department, req.params.id);
    res.json({ message: 'Teacher updated successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete('/api/teachers/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admins only' });
  db.prepare('DELETE FROM teachers WHERE teacher_id = ?').run(req.params.id);
  res.json({ message: 'Teacher deleted successfully' });
});

// --- Face Registration API ---

app.post('/api/students/register-face', authenticateToken, (req, res) => {
  const { descriptor, face_image } = req.body;
  const studentId = req.user.id;

  if (!descriptor) return res.status(400).json({ message: 'No face descriptor details provided' });

  try {
    // Check duplicate face descriptors in students database
    const students = db.prepare('SELECT * FROM students').all();
    for (const student of students) {
      if (student.face_descriptor && Number(student.student_id) !== Number(studentId)) {
        const otherDesc = JSON.parse(student.face_descriptor);
        const dist = getEuclideanDistance(descriptor, otherDesc);
        if (dist < 0.6) {
          return res.status(400).json({
            message: `Biometric mismatch: This face is already enrolled under a different student name (${student.name}).`
          });
        }
      }
    }

    db.prepare('UPDATE students SET face_descriptor = ?, face_image = ?, re_enroll_allowed = 0 where student_id = ?').run(
      JSON.stringify(descriptor),
      face_image || null,
      studentId
    );
    res.json({ message: 'Face successfully registered!' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- Attendance Sessions APIs ---

app.post('/api/sessions/start', authenticateToken, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ message: 'Teachers only' });
  const { subject_name, class_name, latitude, longitude, time_range, gps_radius } = req.body;

  // Auto close any currently active sessions for this teacher
  db.prepare(`
    UPDATE attendance_sessions SET session_status = 'COMPLETED'
    WHERE teacher_id = ? AND session_status = 'ACTIVE'
  `).run(req.user.id);

  const settings = db.prepare('SELECT * FROM system_settings LIMIT 1').get() || { session_duration: 5 };
  const durationMinutes = settings.session_duration || 5;

  const start = new Date();
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000); // dynamic settings duration window

  const result = db.prepare(`
    INSERT INTO attendance_sessions (teacher_id, subject_name, class_name, teacher_latitude, teacher_longitude, start_time, end_time, session_status, time_range, gps_radius)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
  `).run(req.user.id, subject_name, class_name, latitude, longitude, start.toISOString(), end.toISOString(), time_range || 'N/A', Number(gps_radius) || 100);

  res.json({
    message: 'Attendance session started successfully!',
    session_id: result.lastInsertRowid,
    end_time: end.toISOString(),
  });
});

app.get('/api/sessions/active', authenticateToken, (req, res) => {
  checkAndCloseExpiredSessions();

  const active = db.prepare(`
    SELECT s.*, t.name as teacher_name 
    FROM attendance_sessions s
    JOIN teachers t ON s.teacher_id = t.teacher_id
    WHERE s.session_status = 'ACTIVE'
    ORDER BY s.session_id DESC LIMIT 1
  `).get();

  res.json(active || null);
});

app.post('/api/sessions/close/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized' });
  }
  
  db.prepare("UPDATE attendance_sessions SET session_status = 'COMPLETED' WHERE session_id = ?").run(req.params.id);
  triggerAbsenteeProcessing(req.params.id);

  // Trigger parent notifications threshold check
  try {
    const sysSettings = db.prepare('SELECT * FROM system_settings LIMIT 1').get() || { email_threshold: 75 };
    const threshold = sysSettings.email_threshold !== undefined ? sysSettings.email_threshold : 75;
    
    const students = db.prepare('SELECT * FROM students').all();
    const attendance = db.prepare('SELECT * FROM attendance').all();
    const sessions = db.prepare('SELECT * FROM attendance_sessions WHERE session_status = "COMPLETED"').all();

    students.forEach(student => {
      // Find all COMPLETED sessions for student's department/class
      const studentSessions = sessions.filter(s => s.class_name.toLowerCase() === student.department.toLowerCase());
      const total = studentSessions.length;
      if (total > 0) {
        // Calculate student present count
        const present = attendance.filter(a => Number(a.student_id) === Number(student.student_id) && a.status === 'PRESENT').length;
        const rate = Math.round((present / total) * 100);
        
        if (rate < threshold) {
          const subject = `Low Attendance Alert: ${student.name} (${rate}%)`;
          const body = `Dear Parent,\n\nThis is to notify you that the attendance rate of your child ${student.name} is currently ${rate}%, which is below the minimum required threshold of ${threshold}% set by the department.\n\nPlease ensure your child attends upcoming sessions to avoid academic penalties.\n\nRegards,\nSmart AI Attendance System`;
          
          db.prepare('INSERT INTO mail_logs (student_id, recipient, subject, body, sent_at) VALUES (?, ?, ?, ?, ?)').run(
            student.student_id,
            student.parent_email,
            subject,
            body,
            new Date().toLocaleString()
          );
        }
      }
    });
  } catch (err) {
    console.error('Failed to trigger low-attendance parent notification calculations:', err);
  }

  res.json({ message: 'Session closed and notifications triggered' });
});

app.get('/api/sessions/:id/attendance', authenticateToken, (req, res) => {
  const records = db.prepare(`
    SELECT a.*, s.name as student_name, s.register_no, s.department
    FROM attendance a
    JOIN students s ON a.student_id = s.student_id
    WHERE a.session_id = ?
  `).all(req.params.id);

  res.json(records);
});

// --- Mark Attendance API ---

app.post('/api/attendance/mark', authenticateToken, (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ message: 'Students only' });
  const { session_id, latitude, longitude, blink_verified, descriptor } = req.body;
  const studentId = req.user.id;

  checkAndCloseExpiredSessions();

  const session = db.prepare('SELECT * FROM attendance_sessions WHERE session_id = ?').get(session_id);
  if (!session || session.session_status !== 'ACTIVE') {
    return res.status(400).json({ message: 'Attendance window has closed or session is inactive.' });
  }

  // Check if already marked
  const existing = db.prepare('SELECT * FROM attendance WHERE session_id = ? AND student_id = ?').get(session_id, studentId);
  if (existing && existing.status === 'PRESENT') {
    return res.status(400).json({ message: 'Attendance already marked as PRESENT.' });
  }

  // Verify Blink Liveness bypassed as requested

  // Biometric matching
  if (!descriptor) {
    return res.status(400).json({ message: 'Biometric template missing. Please face the camera.' });
  }

  const currentStudent = db.prepare('SELECT name, face_descriptor FROM students WHERE student_id = ?').get(studentId);
  if (!currentStudent || !currentStudent.face_descriptor) {
    return res.status(400).json({ message: 'Face template not registered. Enroll your profile first.' });
  }

  const currentDist = getEuclideanDistance(descriptor, JSON.parse(currentStudent.face_descriptor));
  console.log(`[BIOMETRICS LOG] Student: ${currentStudent.name}, Euclidean Match Distance: ${currentDist.toFixed(4)}`);
  if (currentDist > 0.8) {
    // Audit check against other students to flag duplicate impersonation attempts
    const otherStudents = db.prepare('SELECT student_id, name, face_descriptor FROM students WHERE student_id != ?').all(studentId);
    for (const other of otherStudents) {
      if (other.face_descriptor) {
        const otherDist = getEuclideanDistance(descriptor, JSON.parse(other.face_descriptor));
        if (otherDist < 0.6) {
          return res.status(400).json({
            message: `Fake face check-in alert! Face belongs to student (${other.name}) instead of you.`
          });
        }
      }
    }
    return res.status(400).json({ message: 'Biometric verification failed. Face does not match your registered profile.' });
  }

  // Verify GPS distance
  const settings = db.prepare('SELECT * FROM system_settings LIMIT 1').get() || { gps_radius: 100, gps_bypass: false };
  const allowedRadius = session.gps_radius !== undefined ? Number(session.gps_radius) : (settings.gps_radius || 100);
  const distance = getHaversineDistance(
    session.teacher_latitude,
    session.teacher_longitude,
    latitude,
    longitude
  );

  if (!settings.gps_bypass && distance > allowedRadius) {
    return res.status(400).json({
      message: `GPS verification failed. You are ${Math.round(distance)}m away, but allowed limit is ${allowedRadius}m.`,
    });
  }

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0];

  if (existing) {
    // Student was marked absent, updating to present
    db.prepare(`
      UPDATE attendance 
      SET attendance_time = ?, student_latitude = ?, student_longitude = ?, distance = ?, status = 'PRESENT'
      WHERE attendance_id = ?
    `).run(timeStr, latitude, longitude, distance, existing.attendance_id);
  } else {
    db.prepare(`
      INSERT INTO attendance (session_id, student_id, attendance_date, attendance_time, student_latitude, student_longitude, distance, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PRESENT')
    `).run(session_id, studentId, dateStr, timeStr, latitude, longitude, distance);
  }

  res.json({ message: 'Attendance marked successfully!', distance: Math.round(distance) });
});

// --- Checkout Attendance API ---
app.post('/api/attendance/checkout', authenticateToken, (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ message: 'Students only' });
  const { session_id, latitude, longitude, descriptor } = req.body;
  const studentId = req.user.id;

  checkAndCloseExpiredSessions();

  const session = db.prepare('SELECT * FROM attendance_sessions WHERE session_id = ?').get(session_id);
  if (!session || session.session_status !== 'ACTIVE') {
    return res.status(400).json({ message: 'Attendance window has closed or session is inactive.' });
  }

  const existing = db.prepare('SELECT * FROM attendance WHERE session_id = ? AND student_id = ?').get(session_id, studentId);
  if (!existing) {
    return res.status(400).json({ message: 'No active check-in record found. Please check in first.' });
  }
  if (existing.checkout_time) {
    return res.status(400).json({ message: 'You have already checked out of this session.' });
  }

  // Verify Face matches
  if (!descriptor) {
    return res.status(400).json({ message: 'Biometric template missing. Please face the camera.' });
  }
  const currentStudent = db.prepare('SELECT name, face_descriptor FROM students WHERE student_id = ?').get(studentId);
  const currentDist = getEuclideanDistance(descriptor, JSON.parse(currentStudent.face_descriptor));
  if (currentDist > 0.8) {
    return res.status(400).json({ message: 'Biometric verification failed. Face does not match your registered profile.' });
  }

  // Verify GPS distance
  const settings = db.prepare('SELECT * FROM system_settings LIMIT 1').get() || { gps_radius: 100, gps_bypass: false };
  const allowedRadius = session.gps_radius !== undefined ? Number(session.gps_radius) : (settings.gps_radius || 100);
  const distance = getHaversineDistance(
    session.teacher_latitude,
    session.teacher_longitude,
    latitude,
    longitude
  );

  if (!settings.gps_bypass && distance > allowedRadius) {
    return res.status(400).json({
      message: `GPS verification failed. You are ${Math.round(distance)}m away, but allowed limit is ${allowedRadius}m.`,
    });
  }

  const timeStr = new Date().toTimeString().split(' ')[0];
  db.prepare('UPDATE attendance SET checkout_time = ? WHERE attendance_id = ?').run(timeStr, existing.attendance_id);

  res.json({ message: 'Checked out successfully!', distance: Math.round(distance), checkout_time: timeStr });
});

// Student History
app.get('/api/students/:id/history', authenticateToken, (req, res) => {
  const history = db.prepare(`
    SELECT a.*, s.subject_name, s.class_name, t.name as teacher_name
    FROM attendance a
    JOIN attendance_sessions s ON a.session_id = s.session_id
    JOIN teachers t ON s.teacher_id = t.teacher_id
    WHERE a.student_id = ?
    ORDER BY a.attendance_id DESC
  `).all(req.params.id);

  res.json(history);
});

// --- Teacher Attendance Override API ---

app.put('/api/attendance/override', authenticateToken, (req, res) => {
  if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized' });
  }

  const { attendance_id, session_id, student_id, status, reason } = req.body;

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0];

  if (attendance_id) {
    db.prepare(`
      UPDATE attendance 
      SET status = ?, override_reason = ?, overridden_by = 'TEACHER'
      WHERE attendance_id = ?
    `).run(status, reason, attendance_id);
  } else {
    // Insert fresh record
    db.prepare(`
      INSERT INTO attendance (session_id, student_id, attendance_date, attendance_time, status, override_reason, overridden_by)
      VALUES (?, ?, ?, ?, ?, ?, 'TEACHER')
    `).run(session_id, student_id, dateStr, timeStr, status, reason);
  }

  res.json({ message: 'Attendance updated successfully via override!' });
});

// --- Analytics Dashboard APIs ---

app.get('/api/analytics/dashboard', authenticateToken, (req, res) => {
  // Stats
  const totalStudents = db.prepare('SELECT COUNT(*) as count FROM students').get().count;
  const totalTeachers = db.prepare('SELECT COUNT(*) as count FROM teachers').get().count;
  const activeSessions = db.prepare("SELECT COUNT(*) as count FROM attendance_sessions WHERE session_status = 'ACTIVE'").get().count;

  // Let's get total attendance records overall
  const presentCount = db.prepare("SELECT COUNT(*) as count FROM attendance WHERE status = 'PRESENT'").get().count;
  const absentCount = db.prepare("SELECT COUNT(*) as count FROM attendance WHERE status = 'ABSENT'").get().count;

  const totalRecords = presentCount + absentCount;
  const rate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 100;

  // Daily stats (last 7 days)
  const dailyStats = db.prepare(`
    SELECT attendance_date, 
           SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) as present,
           SUM(CASE WHEN status = 'ABSENT' THEN 1 ELSE 0 END) as absent
    FROM attendance
    GROUP BY attendance_date
    ORDER BY attendance_date DESC LIMIT 7
  `).all();

  // Subject-wise stats
  const subjectStats = db.prepare(`
    SELECT s.subject_name,
           SUM(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END) as present,
           SUM(CASE WHEN a.status = 'ABSENT' THEN 1 ELSE 0 END) as absent
    FROM attendance a
    JOIN attendance_sessions s ON a.session_id = s.session_id
    GROUP BY s.subject_name
  `).all();

  res.json({
    stats: {
      totalStudents,
      totalTeachers,
      activeSessions,
      presentCount,
      absentCount,
      rate,
    },
    daily: dailyStats.reverse(),
    subjects: subjectStats,
  });
});

app.get('/api/analytics/reports', authenticateToken, (req, res) => {
  try {
    const records = db.prepare('SELECT all_reports FROM attendance').all();
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Fetch Student Descriptor (Securely for Face Recognition Verification)
app.post('/api/face/descriptor', authenticateToken, (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE student_id = ?').get(req.user.id);
  if (!student || !student.face_descriptor) {
    return res.status(404).json({ message: 'Student face descriptor not registered.' });
  }
  res.json({ descriptor: JSON.parse(student.face_descriptor) });
});

// --- Password OTP Recovery APIs ---

app.post('/api/auth/forgot-password', (req, res) => {
  const { email, role } = req.body;
  if (!email || !role) return res.status(400).json({ message: 'Missing email or role parameter.' });

  let user = null;
  if (role === 'student') user = db.prepare('SELECT * FROM students WHERE email = ?').get(email);
  else if (role === 'teacher') user = db.prepare('SELECT * FROM teachers WHERE email = ?').get(email);
  else if (role === 'admin') user = db.prepare('SELECT * FROM admins WHERE email = ?').get(email);

  if (!user) return res.status(404).json({ message: 'User with this email not registered in system.' });

  // Generate 6 digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  db.saveOtp(email, otp, expiresAt);

  const mailOptions = {
    from: '"Smart AI Attendance" <no-reply@system.com>',
    to: email,
    subject: 'Password Reset OTP Verification',
    text: `Hello,\n\nYou requested a password reset. Your 6-digit Verification OTP code is: ${otp}\nThis code is valid for 10 minutes. If you did not request this, please ignore this email.\n\nRegards,\nSystem Administration`,
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Failed to send OTP email:', err.message);
      // Fallback log to console so users can always see it locally
      console.log(`[MOCK MAIL SERVICE] OTP for reset is: ${otp}`);
      return res.json({ message: 'OTP generated (sent to server console logs due to SMTP offline)', mock: true, otp });
    }
    console.log(`OTP mail sent successfully: ${nodemailer.getTestMessageUrl(info) || 'OK'}`);
    res.json({ message: 'Verification OTP code successfully sent to your registered email!' });
  });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { email, role, otp, new_password } = req.body;
  if (!email || !role || !otp || !new_password) return res.status(400).json({ message: 'Missing parameters.' });

  const record = db.getOtp(email);
  if (!record || record.otp !== otp || Date.now() > record.expiresAt) {
    return res.status(400).json({ message: 'Invalid or expired OTP verification code.' });
  }

  const hashedPassword = bcrypt.hashSync(new_password, 10);

  if (role === 'student') {
    db.prepare('UPDATE students SET password = ? WHERE email = ?').run(hashedPassword, email);
  } else if (role === 'teacher') {
    db.prepare('UPDATE teachers SET password = ? WHERE email = ?').run(hashedPassword, email);
  } else if (role === 'admin') {
    db.prepare('UPDATE admins SET password = ? WHERE email = ?').run(hashedPassword, email);
  }

  db.deleteOtp(email);
  res.json({ message: 'Password reset completed successfully! You can now log in.' });
});

// --- Leave Requests APIs ---

app.post('/api/leaves/request', authenticateToken, (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ message: 'Students only' });
  const { teacher_id, leave_date, reason } = req.body;
  if (!teacher_id || !leave_date || !reason) {
    return res.status(400).json({ message: 'Missing required leave details parameters.' });
  }
  db.prepare('INSERT INTO leave_requests (student_id, teacher_id, leave_date, reason, status) VALUES (?, ?, ?, ?, "PENDING")')
    .run(req.user.id, teacher_id, leave_date, reason);
  res.json({ message: 'Leave request successfully submitted!' });
});

app.get('/api/leaves/student', authenticateToken, (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ message: 'Students only' });
  const records = db.prepare('SELECT * FROM leave_requests WHERE student_id = ?').all(req.user.id);
  res.json(records);
});

app.get('/api/leaves/teacher', authenticateToken, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ message: 'Teachers only' });
  const records = db.prepare('SELECT * FROM leave_requests WHERE teacher_id = ?').all(req.user.id);
  res.json(records);
});

app.put('/api/leaves/:id/approve', authenticateToken, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ message: 'Teachers only' });
  db.prepare('UPDATE leave_requests SET status = "APPROVED" WHERE id = ?').run(req.params.id);
  res.json({ message: 'Leave request approved successfully.' });
});

app.put('/api/leaves/:id/reject', authenticateToken, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ message: 'Teachers only' });
  db.prepare('UPDATE leave_requests SET status = "REJECTED" WHERE id = ?').run(req.params.id);
  res.json({ message: 'Leave request rejected successfully.' });
});

// --- On Duty (OD) Requests APIs ---

app.post('/api/od/request', authenticateToken, (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ message: 'Students only' });
  const { teacher_id, event_name, category, event_date, description } = req.body;
  if (!teacher_id || !event_name || !category || !event_date || !description) {
    return res.status(400).json({ message: 'Missing required OD filing parameters.' });
  }
  db.prepare('INSERT INTO od_requests (student_id, teacher_id, event_name, category, event_date, description, status) VALUES (?, ?, ?, ?, ?, ?, "PENDING")')
    .run(req.user.id, teacher_id, event_name, category, event_date, description);
  res.json({ message: 'OD request successfully submitted!' });
});

app.get('/api/od/student', authenticateToken, (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ message: 'Students only' });
  const records = db.prepare('SELECT * FROM od_requests WHERE student_id = ?').all(req.user.id);
  res.json(records);
});

app.get('/api/od/teacher', authenticateToken, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ message: 'Teachers only' });
  const records = db.prepare('SELECT * FROM od_requests WHERE teacher_id = ?').all(req.user.id);
  res.json(records);
});

app.put('/api/od/:id/approve', authenticateToken, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ message: 'Teachers only' });
  db.prepare('UPDATE od_requests SET status = "APPROVED" WHERE id = ?').run(req.params.id);
  res.json({ message: 'OD request approved successfully.' });
});

app.put('/api/od/:id/reject', authenticateToken, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ message: 'Teachers only' });
  db.prepare('UPDATE od_requests SET status = "REJECTED" WHERE id = ?').run(req.params.id);
  res.json({ message: 'OD request rejected successfully.' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Smart AI Attendance Backend running on http://localhost:${PORT}`);
});
