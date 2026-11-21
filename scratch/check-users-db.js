const mongoose = require('../server/node_modules/mongoose');

async function run() {
  const remoteUri = process.env.MONGO_URI || "mongodb+srv://shalitha:Shali2003@cluster0.y3vqrv7.mongodb.net/jsp_distributors";
  const conn = await mongoose.createConnection(remoteUri).asPromise();
  const targetDb = conn.useDb('jsp_distributors');
  const users = await targetDb.collection('users').find({}).toArray();
  console.log('Users in Atlas:', users.map(u => ({ id: u._id, name: u.name, email: u.email, role: u.role, status: u.status })));
  await conn.close();
}

run();

