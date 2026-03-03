const express = require('express');
const router = require('./routes/socialAttention');
const app = express();

app.use('/api/social-attention', router);

console.log('Registered Routes:');
app._router.stack.forEach(function(r){
  if (r.route && r.route.path){
    console.log(r.route.path)
  } else if (r.name === 'router') {
     r.handle.stack.forEach(function(sr){
         if (sr.route && sr.route.path) {
             console.log('/api/social-attention' + sr.route.path);
         }
     })
  }
});
