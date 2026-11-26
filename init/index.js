if (process.env.NODE_ENV != "production") {
  require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
}

const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");

const dbUrl = process.env.ATLASDB_URL || "mongodb://127.0.0.1:27017/wanderlust";

async function main() {
  console.log("Connecting to:", dbUrl);
  await mongoose.connect(dbUrl);
  console.log(" Connected to DB");
  await initDb();
  await mongoose.disconnect();
  console.log(" Database initialization completed!");
}

const initDb = async () => {
  await Listing.deleteMany({});
  const ownerId = new mongoose.Types.ObjectId("65a000000000000000000001");

  const preparedData = initData.data.map((obj) => ({
    ...obj,
    owner: ownerId
  }));

  await Listing.insertMany(preparedData);
  console.log(" 30+ Sample Listings successfully seeded into database!");
};

main().catch((err) => {
  console.error(" DB connection or seeding error:", err);
});