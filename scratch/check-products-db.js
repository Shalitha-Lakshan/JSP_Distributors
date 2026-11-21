const mongoose = require('../server/node_modules/mongoose');

async function checkDb(uri, name) {
  try {
    console.log(`Checking ${name}: ${uri.replace(/\/\/.*@/, '//<credentials>@')}`);
    const conn = await mongoose.createConnection(uri).asPromise();
    const admin = conn.db.admin();
    const dbs = await admin.listDatabases();
    console.log(`${name} Databases:`, dbs.databases.map(d => d.name));
    
    // Check jsp_distributors db
    const targetDb = conn.useDb('jsp_distributors');
    const cols = await targetDb.db.listCollections().toArray();
    console.log(`${name} collections:`, cols.map(c => c.name));
    
    if (cols.some(c => c.name === 'products')) {
      const prods = await targetDb.collection('products').find({}).limit(10).toArray();
      console.log(`${name} sample products:`, JSON.stringify(prods, null, 2));
      const count = await targetDb.collection('products').countDocuments();
      console.log(`${name} total products count:`, count);
    }
    await conn.close();
  } catch (err) {
    console.log(`${name} connection error:`, err.message);
  }
}

async function run() {
  await checkDb('mongodb://127.0.0.1:27017', 'Local MongoDB');
  // Also check if remote URI is accessible outside sandbox or bypass
  const remoteUri = process.env.MONGO_URI || "mongodb+srv://shalitha:Shali2003@cluster0.y3vqrv7.mongodb.net/jsp_distributors";
  await checkDb(remoteUri, 'Atlas MongoDB');
}

run();
