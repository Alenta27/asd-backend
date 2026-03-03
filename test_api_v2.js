const http = require('http');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const userId = '68c75cede1778a7e4fd63f05';
const token = jwt.sign(
  { id: userId, email: 'alentahhhtom10@gmail.com', role: 'teacher' },
  process.env.JWT_SECRET || "your-super-secret-jwt-key-change-this-in-production"
);

function makeRequest(urlPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: urlPath,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (err) => { reject(err); });
    req.end();
  });
}

async function runTest() {
  try {
    console.log('Testing /api/teacher/students...');
    const res1 = await makeRequest('/api/teacher/students');
    console.log('Status:', res1.status);
    console.log('Students count:', Array.isArray(res1.data) ? res1.data.length : 'Not an array');
    if (Array.isArray(res1.data) && res1.data.length > 0) {
        console.log('First student name:', res1.data[0].name);
    }

    console.log('Testing /api/teacher/class-stats...');
    const res2 = await makeRequest('/api/teacher/class-stats');
    console.log('Status:', res2.status);
    console.log('Stats:', res2.data);

    process.exit(0);
  } catch (err) {
    console.error('Test Error:', err);
    process.exit(1);
  }
}

runTest();
