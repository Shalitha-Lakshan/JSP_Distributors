const dotenv = require("dotenv");
const mongoose = require("mongoose");
const app = require("./app");

dotenv.config();

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  throw new Error("MONGO_URI is required");
}

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    // Drop lingering unique index invoiceNo_1 on supplierreturns collection if it exists
    try {
      await mongoose.connection.db.collection("supplierreturns").dropIndex("invoiceNo_1");
      console.log("Successfully dropped lingering unique index invoiceNo_1 on supplierreturns.");
    } catch (err) {
      // Safe to ignore if index does not exist or was already dropped
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database connection error", error);
    process.exit(1);
  });
