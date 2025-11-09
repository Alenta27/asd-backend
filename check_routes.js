const fs = require('fs');
const path = require('path');

// Read all route files
const routesDir = './routes';
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
  const content = fs.readFileSync(path.join(routesDir, file), 'utf8');
  const lines = content.split('\n');
  
  lines.forEach((line, idx) => {
    if (line.includes('router.') && (line.includes('get') || line.includes('post') || line.includes('put') || line.includes('delete') || line.includes('patch'))) {
      console.log(`${file}:${idx+1} - ${line.trim()}`);
    }
  });
});