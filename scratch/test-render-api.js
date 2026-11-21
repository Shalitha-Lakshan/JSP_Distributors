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

async function test() {
  console.log("Testing Login as Admin/Manager on Render...");
  const adminLogin = await post('https://jsp-distributors.onrender.com/api/auth/login', {
    email: 'admin@jsp.com',
    password: 'admin@123'
  });
  console.log("Admin login status:", adminLogin.status);
  if (adminLogin.status === 200) {
    const token = adminLogin.data.token;
    const prodRes = await get('https://jsp-distributors.onrender.com/api/products', token);
    console.log("Admin get /api/products status:", prodRes.status);
    if (Array.isArray(prodRes.data)) {
      console.log("Found products count:", prodRes.data.length);
      const aud = prodRes.data.find(p => p.itemCode === 'AUD-B-0104');
      console.log("AUD-B-0104 via Admin:", aud);
      const bp = prodRes.data.find(p => p.itemCode === 'BP-TUM-0523');
      console.log("BP-TUM-0523 via Admin:", bp);
      const cp = prodRes.data.find(p => p.itemCode === 'CP100');
      console.log("CP100 via Admin:", cp);
    }
  }

  // Also test rep login
  console.log("\nTesting Login as Rep on Render...");
  const repLogin = await post('https://jsp-distributors.onrender.com/api/auth/login', {
    email: 'shalitha@gmail.com',
    password: '123456'
  });
  console.log("Rep login status:", repLogin.status);
  if (repLogin.status === 200) {
    const repToken = repLogin.data.token;
    const repProdRes = await get('https://jsp-distributors.onrender.com/api/products', repToken);
    console.log("Rep get /api/products status:", repProdRes.status);
    if (Array.isArray(repProdRes.data)) {
      console.log("Found products count for rep:", repProdRes.data.length);
      const aud = repProdRes.data.find(p => p.itemCode === 'AUD-B-0104');
      console.log("AUD-B-0104 via Rep:", aud);
    }
  }
}

test();
