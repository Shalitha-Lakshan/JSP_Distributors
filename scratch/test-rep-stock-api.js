const https = require('https');

function post(url, data) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = JSON.stringify(data);
    const req = https.request({
      hostname: u.hostname,
      port: 443,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let resp = '';
      res.on('data', d => resp += d);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(resp) });
        } catch (e) {
          resolve({ status: res.statusCode, data: resp });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function get(url, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      port: 443,
      path: u.pathname,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }, res => {
      let resp = '';
      res.on('data', d => resp += d);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(resp) });
        } catch (e) {
          resolve({ status: res.statusCode, data: resp });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  const repLogin = await post('https://jsp-distributors.onrender.com/api/auth/login', {
    email: 'shalitha@gmail.com',
    password: '123456'
  });
  console.log("Rep login status:", repLogin.status);
  const token = repLogin.data.token;

  // 1. Try /api/stock/product/6b005299e014fe87de83c78c (TP50) as Rep
  const res1 = await get('https://jsp-distributors.onrender.com/api/stock/product/6b005299e014fe87de83c78c', token);
  console.log("Rep GET /api/stock/product/TP50 status:", res1.status);
  console.log("Batches count:", Array.isArray(res1.data) ? res1.data.length : res1.data);
  if (Array.isArray(res1.data)) {
    res1.data.forEach(b => console.log(`  Batch: ${b.batchNo}, Qty: ${b.remainingQty}, Billing: ${b.billingPrice}, Selling: ${b.sellingPrice}`));
  }

  // 2. Try /api/stock/batches as Rep
  const res2 = await get('https://jsp-distributors.onrender.com/api/stock/batches', token);
  console.log("Rep GET /api/stock/batches status:", res2.status);
  console.log("All batches count:", Array.isArray(res2.data) ? res2.data.length : res2.data);
}

run().catch(console.error);

