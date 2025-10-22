const mongoose = require("mongoose");
const initData = require("../init/data.js");
const Listing = require("../models/listing.js");

main()
  .then(() => {
    console.log(" Connected to DB");
    initDb();
  })
  .catch((err) => {
    console.log(" DB connection error:", err);
  });

async function main() {
  await mongoose.connect("mongodb://127.0.0.1:27017/wanderlust");
}

const initDb = async () => {
    await Listing.deleteMany({});
    const ownerId = new mongoose.Types.ObjectId("68ce52d2cc2658cf55296bbf");

     initData.data=initData.data.map((obj)=> ({...obj, owner: '68ce52d2cc2658cf55296bbf'}));

    await Listing.insertMany(initData.data);
    console.log(" Data saved");
  
};
initDb();