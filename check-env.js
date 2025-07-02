// check-env.js
const fs = require('fs');
require('dotenv').config();
console.log('cwd:', process.cwd());
console.log('files:', fs.readdirSync(process.cwd()));
console.log('Loaded KEY:', process.env.STRIPE_SECRET_KEY);
