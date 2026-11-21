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
  const adminLogin = await post('https://jsp-distributors.onrender.com/api/auth/login', {
    email: 'admin@jsp.com',
    password: 'admin@123'
  });
  const token = adminLogin.data.token;

  // 1. Get products
  const prods = await get('https://jsp-distributors.onrender.com/api/products', token);
  console.log("=== PRODUCTS ON RENDER ===");
  if (Array.isArray(prods.data)) {
    prods.data.forEach(p => {
      console.log(`- ${p.itemCode} | ${p.displayName || p.productName} | ID: ${p._id} | Selling: ${p.currentSellingPrice} | Billing: ${p.currentBillingPrice} | Stock: ${p.totalStock} | HasBatchesField: ${Boolean(p.batches)} | BatchesCount: ${p.batches?.length || 0}`);
    });
  }

  // 2. Find TP50
  const tp50 = prods.data.find(p => p.itemCode === 'TP50');
  if (tp50) {
    console.log("\n=== TP50 DETAILS ===");
    console.log(JSON.stringify(tp50, null, 2));

    // 3. Query /api/stock/product/:productId
    const stockBatches = await get(`https://jsp-distributors.onrender.com/api/stock/product/${tp50._id}`, token);
    console.log("\n=== /api/stock/product/:productId FOR TP50 ===");
    console.log(JSON.stringify(stockBatches.data, null, 2));
  } else {
    console.log("\nTP50 not found in products array!");
  }

  // 4. Query all stock batches via /api/stock/batches (manager view)
  const allBatches = await get('https://jsp-distributors.onrender.com/api/stock/batches', token);
  console.log("\n=== ALL STOCK BATCHES ON RENDER (/api/stock/batches) ===");
  console.log(`Status: ${allBatches.status}`);
  if (Array.isArray(allBatches.data)) {
    allBatches.data.forEach(b => {
      console.log(`- Batch: ${b.batchNo} | Prod: ${b.productId?.itemCode || b.productId} | Rem: ${b.remainingQty} | Wholesale(Billing): ${b.billingPrice} | Retail(Selling): ${b.sellingPrice}`);
    });
  }
}

run().catch(console.error);

