const mongoose = require('../server/node_modules/mongoose');

async function run() {
  const remoteUri = process.env.MONGO_URI || "mongodb+srv://shalitha:Shali2003@cluster0.y3vqrv7.mongodb.net/jsp_distributors";
  const conn = await mongoose.createConnection(remoteUri).asPromise();
  const targetDb = conn.useDb('jsp_distributors');
  const prods = await targetDb.collection('products').find({}).toArray();
  console.log(`Total products: ${prods.length}`);
  prods.forEach(p => {
    console.log(`- ItemCode: ${p.itemCode}, Name: ${p.displayName || p.productName}`);
    console.log(`  currentSellingPrice: ${p.currentSellingPrice} (${typeof p.currentSellingPrice})`);
    console.log(`  currentBillingPrice: ${p.currentBillingPrice} (${typeof p.currentBillingPrice})`);
    console.log(`  currentCostPrice: ${p.currentCostPrice} (${typeof p.currentCostPrice})`);
    console.log(`  customerBillingPrice: ${p.customerBillingPrice} (${typeof p.customerBillingPrice})`);
    console.log(`  keys: ${Object.keys(p).join(', ')}`);
  });
  await conn.close();
}

run();

