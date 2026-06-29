const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbDir = path.join(__dirname, 'db_data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir);
}

const filePaths = {
  admins: path.join(dbDir, 'admins.json'),
  teachers: path.join(dbDir, 'teachers.json'),
  students: path.join(dbDir, 'students.json'),
  settings: path.join(dbDir, 'settings.json'),
  sessions: path.join(dbDir, 'sessions.json'),
  attendance: path.join(dbDir, 'attendance.json'),
  otps: path.join(dbDir, 'otps.json'),
  leave_requests: path.join(dbDir, 'leave_requests.json'),
  od_requests: path.join(dbDir, 'od_requests.json'),
  mail_logs: path.join(dbDir, 'mail_logs.json')
};

// Ensure all JSON files exist
Object.entries(filePaths).forEach(([key, filePath]) => {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(key === 'settings' ? { 
      gps_radius: 100,
      session_duration: 5,
      liveness_sensitivity: 'medium',
      email_notifications: true,
      gps_bypass: false,
      email_threshold: 75
    } : []), 'utf8');
  }
});

// JSON Database manager helper
const db = {
  read(table) {
    const data = fs.readFileSync(filePaths[table], 'utf8');
    return JSON.parse(data);
  },
  write(table, data) {
    fs.writeFileSync(filePaths[table], JSON.stringify(data, null, 2), 'utf8');
  },

  // Simulating query preparation and execution methods to avoid rewriting server.js
  prepare(queryStr) {
    const query = queryStr.toLowerCase().trim();

    return {
      get(...args) {
        // --- Admin Queries ---
        if (query.includes('select count(*) as count from admins')) {
          const admins = db.read('admins');
          return { count: admins.length };
        }
        if (query.includes('select * from admins where email = ?')) {
          const admins = db.read('admins');
          return admins.find(a => a.email.toLowerCase() === args[0].toLowerCase()) || null;
        }

        // --- Teacher Queries ---
        if (query.includes('select count(*) as count from teachers')) {
          const teachers = db.read('teachers');
          return { count: teachers.length };
        }
        if (query.includes('select * from teachers where email = ?')) {
          const teachers = db.read('teachers');
          return teachers.find(t => t.email.toLowerCase() === args[0].toLowerCase()) || null;
        }

        // --- Student Queries ---
        if (query.includes('select count(*) as count from students')) {
          const students = db.read('students');
          return { count: students.length };
        }
        if (query.includes('select * from students where email = ?')) {
          const students = db.read('students');
          return students.find(s => s.email.toLowerCase() === args[0].toLowerCase()) || null;
        }
        if (query.includes('select * from students where email = ? or register_no = ?')) {
          const students = db.read('students');
          const term = args[0].toLowerCase();
          return students.find(s => s.email.toLowerCase() === term || s.register_no.toLowerCase() === term) || null;
        }
        if (query.includes('select * from students where student_id = ?')) {
          const students = db.read('students');
          return students.find(s => Number(s.student_id) === Number(args[0])) || null;
        }
        if (query.includes('select * from teachers where teacher_id = ?')) {
          const teachers = db.read('teachers');
          return teachers.find(t => Number(t.teacher_id) === Number(args[0])) || null;
        }
        if (query.includes('select * from admins where admin_id = ?')) {
          const admins = db.read('admins');
          return admins.find(a => Number(a.admin_id) === Number(args[0])) || null;
        }
        if (query.includes('select face_descriptor from students where register_no = ?')) {
          const students = db.read('students');
          const student = students.find(s => s.register_no.toLowerCase() === args[0].toLowerCase());
          return student ? { face_descriptor: student.face_descriptor } : null;
        }
        if (query.includes('select name, face_descriptor from students where student_id = ?')) {
          const students = db.read('students');
          const student = students.find(s => Number(s.student_id) === Number(args[0]));
          return student ? { name: student.name, face_descriptor: student.face_descriptor } : null;
        }

        // --- Settings Queries ---
        if (query.includes('select count(*) as count from system_settings')) {
          const settings = db.read('settings');
          return { count: Array.isArray(settings) ? settings.length : 1 };
        }
        if (query.includes('select * from system_settings') || query.includes('select gps_radius from system_settings')) {
          const settings = db.read('settings');
          return Array.isArray(settings) ? (settings[0] || { gps_radius: 100 }) : settings;
        }

        // --- Session Queries ---
        if (query.includes('select s.*, t.name as teacher_name')) {
          const sessions = db.read('sessions');
          const teachers = db.read('teachers');
          const active = sessions.filter(s => s.session_status === 'ACTIVE');
          if (active.length === 0) return null;
          const session = active[active.length - 1];
          const teacher = teachers.find(t => t.teacher_id === session.teacher_id);
          return {
            ...session,
            teacher_name: teacher ? teacher.name : 'Unknown Teacher'
          };
        }
        if (query.includes('select * from attendance_sessions where session_id = ?')) {
          const sessions = db.read('sessions');
          return sessions.find(s => Number(s.session_id) === Number(args[0])) || null;
        }

        // --- Attendance Queries ---
        if (query.includes('select * from attendance where session_id = ? and student_id = ?')) {
          const att = db.read('attendance');
          return att.find(a => Number(a.session_id) === Number(args[0]) && Number(a.student_id) === Number(args[1])) || null;
        }
        if (query.includes("select count(*) as count from attendance_sessions where session_status = 'active'")) {
          const sessions = db.read('sessions');
          return { count: sessions.filter(s => s.session_status === 'ACTIVE').length };
        }
        if (query.includes('select count(*) as count from attendance_sessions where session_status = ?')) {
          const sessions = db.read('sessions');
          return { count: sessions.filter(s => s.session_status === args[0]).length };
        }
        if (query.includes("select count(*) as count from attendance where status = 'present'")) {
          const att = db.read('attendance');
          return { count: att.filter(a => a.status === 'PRESENT').length };
        }
        if (query.includes("select count(*) as count from attendance where status = 'absent'")) {
          const att = db.read('attendance');
          return { count: att.filter(a => a.status === 'ABSENT').length };
        }
        if (query.includes('select count(*) as count from attendance where status = ?')) {
          const att = db.read('attendance');
          return { count: att.filter(a => a.status === args[0]).length };
        }

        return null;
      },

      all(...args) {
        // --- System Settings ---
        if (query.includes('select * from system_settings')) {
          const settings = db.read('settings');
          return Array.isArray(settings) ? settings : [settings];
        }

        // --- Students ---
        if (query.includes('select student_id, name, register_no, email, parent_email, department, face_descriptor from students')) {
          return db.read('students');
        }
        if (query.includes('select * from students')) {
          return db.read('students');
        }

        // --- Teachers ---
        if (query.includes('select teacher_id, name, email, department from teachers')) {
          return db.read('teachers');
        }

        // --- Active Sessions ---
        if (query.includes('select * from attendance_sessions where session_status = ?')) {
          const sessions = db.read('sessions');
          return sessions.filter(s => s.session_status === args[0]);
        }

        // --- Attendance Record for Session ---
        if (query.includes('select a.*, s.name as student_name, s.register_no, s.department')) {
          const att = db.read('attendance');
          const students = db.read('students');
          return att
            .filter(a => Number(a.session_id) === Number(args[0]))
            .map(a => {
              const student = students.find(s => Number(s.student_id) === Number(a.student_id));
              return {
                ...a,
                student_name: student ? student.name : 'Unknown Student',
                register_no: student ? student.register_no : 'N/A',
                department: student ? student.department : 'N/A'
              };
            });
        }
        if (query.includes('select student_id from attendance where session_id = ?')) {
          const att = db.read('attendance');
          return att.filter(a => Number(a.session_id) === Number(args[0])).map(a => ({ student_id: a.student_id }));
        }

        // --- Student Attendance History ---
        if (query.includes('select a.*, s.subject_name, s.class_name, t.name as teacher_name')) {
          const att = db.read('attendance');
          const sessions = db.read('sessions');
          const teachers = db.read('teachers');
          return att
            .filter(a => Number(a.student_id) === Number(args[0]))
            .map(a => {
              const session = sessions.find(s => Number(s.session_id) === Number(a.session_id));
              const teacher = session ? teachers.find(t => Number(t.teacher_id) === Number(session.teacher_id)) : null;
              return {
                ...a,
                subject_name: session ? session.subject_name : 'Unknown Subject',
                class_name: session ? session.class_name : 'Unknown Class',
                teacher_name: teacher ? teacher.name : 'Unknown Teacher'
              };
            })
            .sort((a, b) => b.attendance_id - a.attendance_id);
        }

        // --- Analytics Queries ---
        if (query.includes('select attendance_date,')) {
          // Daily Attendance Stats
          const att = db.read('attendance');
          const groups = {};
          att.forEach(a => {
            if (!groups[a.attendance_date]) {
              groups[a.attendance_date] = { attendance_date: a.attendance_date, present: 0, absent: 0 };
            }
            if (a.status === 'PRESENT') groups[a.attendance_date].present++;
            else if (a.status === 'ABSENT') groups[a.attendance_date].absent++;
          });
          return Object.values(groups).sort((a, b) => a.attendance_date.localeCompare(b.attendance_date));
        }

        if (query.includes('select s.subject_name,')) {
          // Subject-wise Stats
          const att = db.read('attendance');
          const sessions = db.read('sessions');
          const subjectGroups = {};
          att.forEach(a => {
            const session = sessions.find(s => s.session_id === a.session_id);
            if (!session) return;
            const sub = session.subject_name;
            if (!subjectGroups[sub]) {
              subjectGroups[sub] = { subject_name: sub, present: 0, absent: 0 };
            }
            if (a.status === 'PRESENT') subjectGroups[sub].present++;
            else if (a.status === 'ABSENT') subjectGroups[sub].absent++;
          });
          return Object.values(subjectGroups);
        }

        // --- Custom Reports Query ---
        if (query.includes('select a.*, s.subject_name') || query.includes('select all_reports')) {
          const att = db.read('attendance');
          const sessions = db.read('sessions');
          const teachers = db.read('teachers');
          const students = db.read('students');
          return att.map(a => {
            const session = sessions.find(s => Number(s.session_id) === Number(a.session_id));
            const teacher = session ? teachers.find(t => Number(t.teacher_id) === Number(session.teacher_id)) : null;
            const student = students.find(s => Number(s.student_id) === Number(a.student_id));
            return {
              ...a,
              subject_name: session ? session.subject_name : 'Unknown Subject',
              class_name: session ? session.class_name : 'Unknown Class',
              start_time: session ? session.start_time : 'N/A',
              teacher_name: teacher ? teacher.name : 'Unknown Teacher',
              student_name: student ? student.name : 'Unknown Student',
              register_no: student ? student.register_no : 'N/A',
              department: student ? student.department : 'N/A'
            };
          }).sort((a, b) => b.attendance_id - a.attendance_id);
        }

        if (query.includes('from leave_requests')) {
          const leaves = db.read('leave_requests');
          const students = db.read('students');
          const teachers = db.read('teachers');
          let res = leaves;
          if (args[0] !== undefined) {
            if (query.includes('student_id = ?')) {
              res = leaves.filter(l => Number(l.student_id) === Number(args[0]));
            } else if (query.includes('teacher_id = ?')) {
              res = leaves.filter(l => Number(l.teacher_id) === Number(args[0]));
            }
          }
          return res.map(l => {
            const student = students.find(s => Number(s.student_id) === Number(l.student_id));
            const teacher = teachers.find(t => Number(t.teacher_id) === Number(l.teacher_id));
            return {
              ...l,
              student_name: student ? student.name : 'Unknown Student',
              register_no: student ? student.register_no : 'N/A',
              department: student ? student.department : 'N/A',
              teacher_name: teacher ? teacher.name : 'Unknown Teacher'
            };
          }).sort((a, b) => b.id - a.id);
        }

        if (query.includes('from od_requests')) {
          const ods = db.read('od_requests');
          const students = db.read('students');
          const teachers = db.read('teachers');
          let res = ods;
          if (args[0] !== undefined) {
            if (query.includes('student_id = ?')) {
              res = ods.filter(o => Number(o.student_id) === Number(args[0]));
            } else if (query.includes('teacher_id = ?')) {
              res = ods.filter(o => Number(o.teacher_id) === Number(args[0]));
            }
          }
          return res.map(o => {
            const student = students.find(s => Number(s.student_id) === Number(o.student_id));
            const teacher = teachers.find(t => Number(t.teacher_id) === Number(o.teacher_id));
            return {
              ...o,
              student_name: student ? student.name : 'Unknown Student',
              register_no: student ? student.register_no : 'N/A',
              department: student ? student.department : 'N/A',
              teacher_name: teacher ? teacher.name : 'Unknown Teacher'
            };
          }).sort((a, b) => b.id - a.id);
        }

        if (query.includes('from mail_logs')) {
          const logs = db.read('mail_logs');
          const students = db.read('students');
          return logs.map(m => {
            const student = students.find(s => Number(s.student_id) === Number(m.student_id));
            return {
              ...m,
              student_name: student ? student.name : 'Unknown Student',
              register_no: student ? student.register_no : 'N/A'
            };
          }).sort((a, b) => b.id - a.id);
        }

        return [];
      },

      run(...args) {
        // --- Insert Admin ---
        if (query.includes('insert into admins')) {
          const admins = db.read('admins');
          const newId = admins.length > 0 ? Math.max(...admins.map(a => a.id)) + 1 : 1;
          admins.push({
            id: newId,
            name: args[0],
            email: args[1],
            password: args[2]
          });
          db.write('admins', admins);
          return { lastInsertRowid: newId };
        }

        // --- Insert Teacher ---
        if (query.includes('insert into teachers')) {
          const teachers = db.read('teachers');
          const newId = teachers.length > 0 ? Math.max(...teachers.map(t => t.teacher_id)) + 1 : 1;
          teachers.push({
            teacher_id: newId,
            name: args[0],
            email: args[1],
            password: args[2],
            department: args[3]
          });
          db.write('teachers', teachers);
          return { lastInsertRowid: newId };
        }

        // --- Update Teacher ---
        if (query.includes('update teachers set name = ?, email = ?, department = ?')) {
          const teachers = db.read('teachers');
          const index = teachers.findIndex(t => t.teacher_id === Number(args[3]));
          if (index !== -1) {
            teachers[index].name = args[0];
            teachers[index].email = args[1];
            teachers[index].department = args[2];
            db.write('teachers', teachers);
          }
          return { changes: 1 };
        }

        // --- Delete Teacher ---
        if (query.includes('delete from teachers where teacher_id = ?')) {
          const teachers = db.read('teachers');
          const filtered = teachers.filter(t => t.teacher_id !== Number(args[0]));
          db.write('teachers', filtered);
          return { changes: 1 };
        }

        // --- Insert Student ---
        if (query.includes('insert into students')) {
          const students = db.read('students');
          const newId = students.length > 0 ? Math.max(...students.map(s => s.student_id)) + 1 : 1;
          students.push({
            student_id: newId,
            name: args[0],
            register_no: args[1],
            email: args[2],
            parent_email: args[3],
            department: args[4],
            password: args[5],
            face_descriptor: null
          });
          db.write('students', students);
          return { lastInsertRowid: newId };
        }

        // --- Update Student ---
        if (query.includes('update students set name = ?, register_no = ?, email = ?, parent_email = ?, department = ?')) {
          const students = db.read('students');
          const index = students.findIndex(s => s.student_id === Number(args[5]));
          if (index !== -1) {
            students[index].name = args[0];
            students[index].register_no = args[1];
            students[index].email = args[2];
            students[index].parent_email = args[3];
            students[index].department = args[4];
            db.write('students', students);
          }
          return { changes: 1 };
        }

        // --- Delete Student ---
        if (query.includes('delete from students where student_id = ?')) {
          const students = db.read('students');
          const filtered = students.filter(s => s.student_id !== Number(args[0]));
          db.write('students', filtered);
          return { changes: 1 };
        }
        if (query.includes('delete from attendance where student_id = ?')) {
          const att = db.read('attendance');
          const filtered = att.filter(a => Number(a.student_id) !== Number(args[0]));
          db.write('attendance', filtered);
          return { changes: 1 };
        }

        // --- Register Face ---
        if (query.includes('update students set face_descriptor = ?, face_image = ?, re_enroll_allowed = 0 where student_id = ?')) {
          const students = db.read('students');
          const index = students.findIndex(s => s.student_id === Number(args[2]));
          if (index !== -1) {
            students[index].face_descriptor = args[0];
            students[index].face_image = args[1];
            students[index].re_enroll_allowed = 0;
            db.write('students', students);
          }
          return { changes: 1 };
        }
        if (query.includes('update students set face_descriptor = ? where student_id = ?')) {
          const students = db.read('students');
          const index = students.findIndex(s => s.student_id === Number(args[1]));
          if (index !== -1) {
            students[index].face_descriptor = args[0];
            db.write('students', students);
          }
          return { changes: 1 };
        }
        if (query.includes('update students set re_enroll_allowed =')) {
          const students = db.read('students');
          let val = 1;
          let sid = args[0];
          if (query.includes('re_enroll_allowed = ?')) {
            val = Number(args[0]);
            sid = args[1];
          } else if (query.includes('re_enroll_allowed = 0')) {
            val = 0;
          }
          const index = students.findIndex(s => s.student_id === Number(sid));
          if (index !== -1) {
            students[index].re_enroll_allowed = val;
            db.write('students', students);
          }
          return { changes: 1 };
        }

        // --- Insert Session Settings ---
        if (query.includes('insert into system_settings')) {
          db.write('settings', { gps_radius: args[0] });
          return { lastInsertRowid: 1 };
        }

        // --- Update Session Settings ---
        if (query.includes('update system_settings')) {
          db.write('settings', { 
            gps_radius: args[0],
            session_duration: args[1],
            liveness_sensitivity: args[2],
            email_notifications: args[3],
            gps_bypass: args[4],
            email_threshold: args[5],
            org_name: args[6],
            enable_org_name: args[7] !== undefined ? Number(args[7]) : 1,
            org_address: args[8],
            org_website: args[9]
          });
          return { changes: 1 };
        }

        // --- Create Attendance Session ---
        if (query.includes('insert into attendance_sessions')) {
          const sessions = db.read('sessions');
          const newId = sessions.length > 0 ? Math.max(...sessions.map(s => s.session_id)) + 1 : 1;
          sessions.push({
            session_id: newId,
            teacher_id: args[0],
            subject_name: args[1],
            class_name: args[2],
            teacher_latitude: args[3],
            teacher_longitude: args[4],
            start_time: args[5],
            end_time: args[6],
            session_status: 'ACTIVE',
            time_range: args[7] || 'N/A',
            gps_radius: args[8] !== undefined ? Number(args[8]) : 100
          });
          db.write('sessions', sessions);
          return { lastInsertRowid: newId };
        }

        // --- Leave Requests CRUD ---
        if (query.includes('insert into leave_requests')) {
          const leaves = db.read('leave_requests');
          const newId = leaves.length > 0 ? Math.max(...leaves.map(l => l.id)) + 1 : 1;
          leaves.push({
            id: newId,
            student_id: args[0],
            teacher_id: args[1],
            leave_date: args[2],
            reason: args[3],
            status: args[4] || 'PENDING'
          });
          db.write('leave_requests', leaves);
          return { lastInsertRowid: newId };
        }
        if (query.includes('update leave_requests set status = ? where id = ?')) {
          const leaves = db.read('leave_requests');
          leaves.forEach(l => {
            if (l.id === Number(args[1])) {
              l.status = args[0];
            }
          });
          db.write('leave_requests', leaves);
          return { changes: 1 };
        }

        // --- OD Requests CRUD ---
        if (query.includes('insert into od_requests')) {
          const ods = db.read('od_requests');
          const newId = ods.length > 0 ? Math.max(...ods.map(o => o.id)) + 1 : 1;
          ods.push({
            id: newId,
            student_id: args[0],
            teacher_id: args[1],
            event_name: args[2],
            category: args[3],
            event_date: args[4],
            description: args[5],
            status: args[6] || 'PENDING'
          });
          db.write('od_requests', ods);
          return { lastInsertRowid: newId };
        }
        if (query.includes('update od_requests set status = ? where id = ?')) {
          const ods = db.read('od_requests');
          ods.forEach(o => {
            if (o.id === Number(args[1])) {
              o.status = args[0];
            }
          });
          db.write('od_requests', ods);
          return { changes: 1 };
        }

        // --- Mail Logs CRUD ---
        if (query.includes('insert into mail_logs')) {
          const logs = db.read('mail_logs');
          const newId = logs.length > 0 ? Math.max(...logs.map(m => m.id)) + 1 : 1;
          logs.push({
            id: newId,
            student_id: args[0],
            recipient: args[1],
            subject: args[2],
            body: args[3],
            sent_at: args[4]
          });
          db.write('mail_logs', logs);
          return { lastInsertRowid: newId };
        }

        // --- Close Active Sessions ---
        if (query.includes("update attendance_sessions set session_status = 'completed'")) {
          const sessions = db.read('sessions');
          sessions.forEach(s => {
            if (s.session_id === Number(args[0])) {
              s.session_status = 'COMPLETED';
            }
          });
          db.write('sessions', sessions);
          return { changes: 1 };
        }
        if (query.includes("update attendance_sessions set session_status = ? where session_id = ?")) {
          const sessions = db.read('sessions');
          sessions.forEach(s => {
            if (s.session_id === Number(args[1])) {
              s.session_status = args[0];
            }
          });
          db.write('sessions', sessions);
          return { changes: 1 };
        }
        if (query.includes("update attendance_sessions set session_status = 'completed' where teacher_id = ? and session_status = 'active'")) {
          const sessions = db.read('sessions');
          sessions.forEach(s => {
            if (s.teacher_id === Number(args[0]) && s.session_status === 'ACTIVE') {
              s.session_status = 'COMPLETED';
            }
          });
          db.write('sessions', sessions);
          return { changes: 1 };
        }

        // --- Mark Attendance / Insert Record ---
        if (query.includes('insert into attendance (session_id, student_id, attendance_date, attendance_time, student_latitude, student_longitude, distance, status)')) {
          const att = db.read('attendance');
          const newId = att.length > 0 ? Math.max(...att.map(a => a.attendance_id)) + 1 : 1;
          
          let statusVal = 'PRESENT';
          if (query.includes("'absent'")) {
            statusVal = 'ABSENT';
          }

          att.push({
            attendance_id: newId,
            session_id: args[0],
            student_id: args[1],
            attendance_date: args[2],
            attendance_time: args[3],
            student_latitude: args[4],
            student_longitude: args[5],
            distance: args[6],
            status: statusVal,
            override_reason: null,
            overridden_by: null,
            absent_email_status: 'N/A'
          });
          db.write('attendance', att);
          return { lastInsertRowid: newId };
        }

        // --- Insert Absent Record ---
        if (query.includes('insert into attendance (session_id, student_id, attendance_date, attendance_time, status)')) {
          const att = db.read('attendance');
          const newId = att.length > 0 ? Math.max(...att.map(a => a.attendance_id)) + 1 : 1;
          att.push({
            attendance_id: newId,
            session_id: args[0],
            student_id: args[1],
            attendance_date: args[2],
            attendance_time: args[3],
            student_latitude: null,
            student_longitude: null,
            distance: null,
            status: args[4],
            override_reason: null,
            overridden_by: null,
            absent_email_status: 'PENDING'
          });
          db.write('attendance', att);
          return { lastInsertRowid: newId };
        }

        if (query.includes('update attendance set absent_email_status = ?')) {
          const att = db.read('attendance');
          const index = att.findIndex(a => Number(a.attendance_id) === Number(args[1]));
          if (index !== -1) {
            att[index].absent_email_status = args[0];
            db.write('attendance', att);
          }
          return { changes: 1 };
        }

        if (query.includes('update attendance set checkout_time = ?')) {
          const att = db.read('attendance');
          const index = att.findIndex(a => Number(a.attendance_id) === Number(args[1]));
          if (index !== -1) {
            att[index].checkout_time = args[0];
            db.write('attendance', att);
          }
          return { changes: 1 };
        }

        // --- Update Student Attendance Status (e.g. from Absent to Present) ---
        if (query.includes("update attendance set attendance_time = ?, student_latitude = ?, student_longitude = ?, distance = ?, status = 'present'")) {
          const att = db.read('attendance');
          const index = att.findIndex(a => a.attendance_id === Number(args[4]));
          if (index !== -1) {
            att[index].attendance_time = args[0];
            att[index].student_latitude = args[1];
            att[index].student_longitude = args[2];
            att[index].distance = args[3];
            att[index].status = 'PRESENT';
            db.write('attendance', att);
          }
          return { changes: 1 };
        }

        // --- Override Attendance ---
        if (query.includes("update attendance set status = ?, override_reason = ?, overridden_by = 'teacher'")) {
          const att = db.read('attendance');
          const index = att.findIndex(a => a.attendance_id === Number(args[2]));
          if (index !== -1) {
            att[index].status = args[0];
            att[index].override_reason = args[1];
            att[index].overridden_by = 'TEACHER';
            db.write('attendance', att);
          }
          return { changes: 1 };
        }
        if (query.includes("insert into attendance (session_id, student_id, attendance_date, attendance_time, status, override_reason, overridden_by)")) {
          const att = db.read('attendance');
          const newId = att.length > 0 ? Math.max(...att.map(a => a.attendance_id)) + 1 : 1;
          att.push({
            attendance_id: newId,
            session_id: args[0],
            student_id: args[1],
            attendance_date: args[2],
            attendance_time: args[3],
            status: args[4],
            override_reason: args[5],
            overridden_by: 'TEACHER',
            student_latitude: null,
            student_longitude: null,
            distance: null
          });
          db.write('attendance', att);
          return { lastInsertRowid: newId };
        }

        // --- Leave Requests Insert ---
        if (query.includes('insert into leave_requests')) {
          const leaves = db.read('leave_requests');
          const newId = leaves.length > 0 ? Math.max(...leaves.map(l => l.id)) + 1 : 1;
          leaves.push({
            id: newId,
            student_id: args[0],
            teacher_id: args[1],
            leave_date: args[2],
            reason: args[3],
            status: 'PENDING'
          });
          db.write('leave_requests', leaves);
          return { lastInsertRowid: newId };
        }

        // --- Leave Requests Update ---
        if (query.includes('update leave_requests set status =')) {
          const leaves = db.read('leave_requests');
          const index = leaves.findIndex(l => l.id === Number(args[0]));
          if (index !== -1) {
            leaves[index].status = query.includes('approved') ? 'APPROVED' : 'REJECTED';
            db.write('leave_requests', leaves);
          }
          return { changes: 1 };
        }

        // --- OD Requests Insert ---
        if (query.includes('insert into od_requests')) {
          const ods = db.read('od_requests');
          const newId = ods.length > 0 ? Math.max(...ods.map(o => o.id)) + 1 : 1;
          ods.push({
            id: newId,
            student_id: args[0],
            teacher_id: args[1],
            event_name: args[2],
            category: args[3],
            event_date: args[4],
            description: args[5],
            status: 'PENDING'
          });
          db.write('od_requests', ods);
          return { lastInsertRowid: newId };
        }

        // --- OD Requests Update ---
        if (query.includes('update od_requests set status =')) {
          const ods = db.read('od_requests');
          const index = ods.findIndex(o => o.id === Number(args[0]));
          if (index !== -1) {
            ods[index].status = query.includes('approved') ? 'APPROVED' : 'REJECTED';
            db.write('od_requests', ods);
          }
          return { changes: 1 };
        }

        return { changes: 0 };
      }
    };
  }
};

// Seed initial database info
const initDb = () => {
  const settings = db.read('settings');
  if (!settings || typeof settings.gps_radius === 'undefined') {
    db.write('settings', { 
      gps_radius: 100, 
      session_duration: 5, 
      liveness_sensitivity: 'medium', 
      email_notifications: true 
    });
  }

  const admins = db.read('admins');
  if (admins.length === 0) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    admins.push({
      id: 1,
      name: 'System Admin',
      email: 'admin@system.com',
      password: hashedPassword
    });
    db.write('admins', admins);
    console.log('Default Admin: admin@system.com / admin123');
  }

  const teachers = db.read('teachers');
  if (teachers.length === 0) {
    const hashedPassword = bcrypt.hashSync('teacher123', 10);
    teachers.push({
      teacher_id: 1,
      name: 'John Doe',
      email: 'teacher@system.com',
      password: hashedPassword,
      department: 'Computer Science'
    });
    teachers.push({
      teacher_id: 2,
      name: 'Adeline',
      email: 'adeline@system.com',
      password: hashedPassword,
      department: 'Electronics'
    });
    db.write('teachers', teachers);
    console.log('Seed Teachers loaded');
  }

  const students = db.read('students');
  if (students.length === 0) {
    const hashedPassword = bcrypt.hashSync('student123', 10);
    students.push({
      student_id: 1,
      name: 'Alice Smith',
      register_no: 'REG001',
      email: 'student@system.com',
      parent_email: 'parent@system.com',
      department: 'Computer Science',
      password: hashedPassword,
      face_descriptor: null,
      face_image: null,
      re_enroll_allowed: 0
    });
    students.push({
      student_id: 2,
      name: 'RAJESH',
      register_no: 'REG002',
      email: 'student1@system.com',
      parent_email: 'parent1@system.com',
      department: 'Electronics',
      password: hashedPassword,
      face_descriptor: null,
      face_image: null,
      re_enroll_allowed: 0
    });
    students.push({
      student_id: 3,
      name: 'Bob Johnson',
      register_no: 'REG003',
      email: 'student2@system.com',
      parent_email: 'parent2@system.com',
      department: 'Information Technology',
      password: hashedPassword,
      face_descriptor: null,
      face_image: null,
      re_enroll_allowed: 0
    });
    db.write('students', students);
    console.log('Seed Students loaded');
  }
};

db.saveOtp = (email, otp, expiresAt) => {
  const otps = db.read('otps');
  const filtered = otps.filter(o => o.email.toLowerCase() !== email.toLowerCase());
  filtered.push({ email, otp, expiresAt });
  db.write('otps', filtered);
};

db.getOtp = (email) => {
  const otps = db.read('otps');
  return otps.find(o => o.email.toLowerCase() === email.toLowerCase()) || null;
};

db.deleteOtp = (email) => {
  const otps = db.read('otps');
  const filtered = otps.filter(o => o.email.toLowerCase() !== email.toLowerCase());
  db.write('otps', filtered);
};

initDb();

module.exports = db;
