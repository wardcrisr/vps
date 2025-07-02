const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const paths = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../..', '.env'),
  path.resolve(process.cwd(), '.env')
];

for (const p of paths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    console.info('[envloader] loaded', p);
    break;
  }
}

if (!process.env.IDR_SECRET && !process.env.IDATARIVER_SECRET) {
  console.error('IDR_SECRET missing, aborting...');
  process.exit(1);
} 