const db = require('./database');

console.log('--- DB INSPECTOR ---');
try {
  const students = db.read('students');
  console.log('Students in file:', students.length);
  
  const teachers = db.read('teachers');
  console.log('Teachers in file:', teachers.length);
  
  const sessions = db.read('sessions');
  console.log('Sessions in file:', sessions.length);

  const settings = db.read('settings');
  console.log('Settings in file:', settings);
  
  const attendance = db.read('attendance');
  console.log('Attendance in file:', attendance.length);

  console.log('\n--- Running dashboard queries ---');
  
  const q1 = db.prepare('SELECT COUNT(*) as count FROM students').get();
  console.log('q1 (totalStudents):', q1);

  const q2 = db.prepare("SELECT COUNT(*) as count FROM attendance_sessions WHERE session_status = 'ACTIVE'").get();
  console.log('q2 (activeSessions):', q2);

  const q3 = db.prepare("SELECT COUNT(*) as count FROM attendance WHERE status = 'PRESENT'").get();
  console.log('q3 (presentCount):', q3);

  const q4 = db.prepare("SELECT COUNT(*) as count FROM attendance WHERE status = 'ABSENT'").get();
  console.log('q4 (absentCount):', q4);

} catch (err) {
  console.error('Error running test:', err);
}
