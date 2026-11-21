const mongoose = require('../server/node_modules/mongoose');
const bcrypt = require('../server/node_modules/bcryptjs');

async function checkRepPass() {
  const remoteUri = process.env.MONGO_URI || "mongodb+srv://shalitha:Shali2003@cluster0.y3vqrv7.mongodb.net/jsp_distributors";
  const conn = await mongoose.createConnection(remoteUri).asPromise();
  const targetDb = conn.useDb('jsp_distributors');
  const reps = await targetDb.collection('users').find({ role: 'rep' }).toArray();
  for (const r of reps) {
    console.log(`Checking rep ${r.email}...`);
    for (const testPass of ['admin@123', 'password123', '123456', 'rajitha@123', 'rep@123', 'Shali2003']) {
      if (r.passwordHash && await bcrypt.compare(testPass, r.passwordHash)) {
        console.log(`Found password for ${r.email}: "${testPass}"`);
        break;
      }
    }
  }
  await conn.close();
}

checkRepPass();

