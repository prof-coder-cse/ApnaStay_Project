const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const { listingSchema } = require("../schemaValidation.js");
const ExpressError = require("../utils/ExpressError");
const Listing = require("../models/listing");
const { isLoggedIn, isOwner }=require("../routes/middleware.js");
const Review = require("../models/review");
const {storage}=require("../cloudConfig.js");
const multer  = require('multer')
const upload = multer({ storage }) 


const validateListing = (req, res, next) => {
    const { error } = listingSchema.validate(req.body);
    if (error) {
        const msg = error.details.map(el => el.message).join(",");
        throw new ExpressError(400, msg);
    }
    next();
};

// router.route("/")
// .post(upload.single("listing[image]"),(req,res)=>{
//     res.send(req.file);
// })
router.get("/", wrapAsync(async (req, res) => {
    const listings = await Listing.find({});
    res.render("listings/index", { allListings: listings });
}));
// NEW ROUTE
router.get("/new", isLoggedIn, (req, res) => {
    
    res.render("listings/new");
});


// CREATE ROUTE

// router.post("/",isLoggedIn, validateListing, wrapAsync(async (req, res) => {
//     const newListing = new Listing(req.body);
//     newListing.owner=req.user._id;
//     await newListing.save();
//     req.flash("success", "new listing created");
//     res.redirect("/listings");
// }));
// ✅ FINAL CREATE ROUTE — without router.route()
router.post(
  "/", 
  isLoggedIn, 
  upload.single("image"), // ✅ Cloudinary Upload
  validateListing, 
  wrapAsync(async (req, res) => {

    // const newListing = new Listing(req.body.listing);
    const newListing = new Listing({
  title: req.body.title,
  price: req.body.price,
  country: req.body.country,
  location: req.body.location,
  description: req.body.description,
});

    newListing.owner = req.user._id;

    // ✅ Save image from Cloudinary
    if (req.file) {
      newListing.image = {
        url: req.file.path,
        filename: req.file.filename
       
      };
    }

    await newListing.save();
    req.flash("success", "New Listing Created!");
    res.redirect(`/listings/${newListing._id}`);
  })
);
router.get("/test-insert", async (req, res) => {
    try {
        await Listing.create({ title: "Test Listing", description: "Atlas connected!" });
        res.send("✅ Data inserted into Atlas!");
    } catch (err) {
        console.log(err);
        res.send("❌ Insert failed");
    }
});

// SHOW ROUTE
router.get("/:id", wrapAsync(async (req, res) => {
    const listing = await Listing.findById(req.params.id).populate({path: "reviews",populate:{
        path:"author",
    }}).populate("owner");
    if(!listing){
        req.flash("error","Listing you requested does no")
    }
    console.log(listing);
    res.render("listings/show", { listing });
}));
// EDIT ROUTE



router.get("/:id/edit", isLoggedIn,isOwner,wrapAsync(async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    res.render("listings/edit", { listing });
}));
// update route
// router.put("/:id", isLoggedIn,isOwner,upload.single("image"),validateListing,wrapAsync(async (req, res) => {
// //     const {id}=req.params
// //     let listing=await Listing.findById(id);
// //     if(!listing.owner._id.equals(res.locals.currentUser._id)){
// // req.flash("error","you don't have permission to edit"); 
// // return res.redirect(`/listings/${id}`)
// //     }
//     await Listing.findByIdAndUpdate(req.params.id, req.body, { new: true });
//     res.redirect("/listings");
// }));

router.put("/:id", isLoggedIn, isOwner, upload.single("image"), validateListing, wrapAsync(async (req, res) => {
    const listing = await Listing.findById(req.params.id);

    // ✅ Update basic fields manually
    listing.title = req.body.title;
    listing.price = req.body.price;
    listing.country = req.body.country;
    listing.location = req.body.location;
    listing.description = req.body.description;

    // ✅ If a new image is uploaded, update Cloudinary URL & filename
    if (req.file) {
        listing.image = {
            url: req.file.path,
            filename: req.file.filename
        };
    }

    await listing.save(); // ✅ Save updated document
    req.flash("success", "Listing Updated Successfully!");
    res.redirect(`/listings/${listing._id}`);
}));

// delete route
router.delete("/:id", isLoggedIn,isOwner,wrapAsync(async (req, res) => {
    await Listing.findByIdAndDelete(req.params.id);
    req.flash("success", "Listing deleted successfully!");
    res.redirect("/listings");
}));

module.exports = router;

// <--const express = require("express");
// const router = express.Router();
// const Listing = require("../models/listing");
// const wrapAsync = require("../utils/wrapAsync");
// const { listingSchema } = require("../schemaValidation");
// const ExpressError = require("../utils/ExpressError");

// // Middleware to validate listing
// const validateListing = (req, res, next) => {
//     const { error } = listingSchema.validate(req.body);
//     if (error) {
//         const msg = error.details.map(el => el.message).join(",");
//         throw new ExpressError(400, msg);
//     } else {
//         next();
//     }
// // };

// // Show all listings
// router.get("/", wrapAsync(async (req, res) => {
//     const allListings = await Listing.find({});
//     res.render("listings/listing", { allListings, success: req.flash("success") });
// }));

// // Render new listing form
// router.get("/new", (req, res) => {
//     res.render("listings/new");
// });

// // Create a new listing
// router.post("/", validateListing, wrapAsync(async (req, res) => {
//     const newListing = new Listing(req.body);
//     await newListing.save();
//     req.flash("success", "Listing created successfully!");
//     res.redirect("/listings");
// }));

// // Show a single listing
// router.get("/:id", wrapAsync(async (req, res) => {
//     const listing = await Listing.findById(req.params.id);
//     if (!listing) {
//         req.flash("success", "Listing not found!");
//         return res.redirect("/listings");
//     }
//     res.render("listings/show", { listing });
// }));

// // Render edit form
// router.get("/:id/edit", wrapAsync(async (req, res) => {
//     const listing = await Listing.findById(req.params.id);
//     if (!listing) {
//         req.flash("success", "Listing not found!");
//         return res.redirect("/listings");
//     }
//     res.render("listings/edit", { listing });
// }));

// // Update a listing
// router.put("/:id", validateListing, wrapAsync(async (req, res) => {
//     const { id } = req.params;
//     await Listing.findByIdAndUpdate(id, req.body, { new: true });
//     req.flash("success", "Listing updated successfully!");
//     res.redirect(`/listings/${id}`);
// }));

// // Delete a listing
// router.delete("/:id", wrapAsync(async (req, res) => {
//     const { id } = req.params;
//     await Listing.findByIdAndDelete(id);
//     req.flash("success", "Listing deleted successfully!");
//     res.redirect("/listings");
// }));

// module.exports = router;
