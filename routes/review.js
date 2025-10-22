// const express=require("express");
// const router=express.Router();
// const wrapAsync=require("../utils/wrapAsync.js");
// const {reviewSchema}=require("../MAJORPROJECT/schemaValidation.js");
// const ExpressError = require("../utils/ExpressError.js");
// const Review=require("../MAJORPROJECT/models/review.js"); 
// // REVIEW POST ROUTE
// router.post("/", validateReview,wrapAsync(async(req,res)=>{
//     console.log(req.body);
//     let listing=await Listing.findById(req.params.id);
//     let newReview=new Review(req.body.review);
//     listing.reviews.push(newReview);
//     await newReview.save();  
//     await listing.save();
//     res.redirect(`/listings/${listing._id}`);
// }))
// // DELETE REVIEW
// router.delete("/:reviewId", wrapAsync(async (req, res) => {
//     const { id, reviewId } = req.params;

//     await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
//     await Review.findByIdAndDelete(reviewId);

//     res.redirect(`/listings/${id}`);
// }));
// const express = require("express");
// const router = express.Router({ mergeParams: true }); // Important to access :id from parent route
// const wrapAsync = require("../utils/wrapAsync.js");
// const { reviewSchema } = require("../schemaValidation.js");
// const ExpressError = require("../utils/ExpressError.js");
// const Review = require("../models/review.js");
// const Listing = require("../models/listing.js");

// // Validation middleware
// const validateReview = (req, res, next) => {
//     const { error } = reviewSchema.validate(req.body);
//     if (error) {
//         const errMsg = error.details.map(el => el.message).join(",");
//         throw new ExpressError(400, errMsg);
//     }
//     else {
//         next();
//     }
// };

// // REVIEW POST ROUTE
// router.post("/", validateReview, wrapAsync(async (req, res) => {
//     const listing = await Listing.findById(req.params.id);
//     const newReview = new Review(req.body.review);
//     listing.reviews.push(newReview);
//     await newReview.save();
//     await listing.save();
//     res.redirect(`/listings/${listing._id}`);
// }));

// // DELETE REVIEW
// router.delete("/:reviewId", wrapAsync(async (req, res) => {
//     const { id, reviewId } = req.params;
//     await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
//     await Review.findByIdAndDelete(reviewId);
//     res.redirect(`/listings/${id}`);
// }));

// module.exports = router;
// const express = require("express");
// const router = express.Router({ mergeParams: true });
// const wrapAsync = require("../utils/wrapAsync");
// const { reviewSchema } = require("../schemaValidation");
// const ExpressError = require("../utils/ExpressError");
// const Review = require("../models/review");
// const Listing = require("../models/listing");

// const validateReview = (req, res, next) => {
//     const { error } = reviewSchema.validate(req.body);
//     if (error) {
//         const msg = error.details.map(el => el.message).join(",");
//         throw new ExpressError(400, msg);
//     }
//     next();
// };

// router.post("/", validateReview, wrapAsync(async (req, res) => {
//     const listing = await Listing.findById(req.params.id);
//     const review = new Review(req.body.review);
//     listing.reviews.push(review);
//     await review.save();
//     await listing.save();
//     res.redirect(`/listings/${listing._id}`);
// }));

// router.delete("/:reviewId", wrapAsync(async (req, res) => {
//     const { id, reviewId } = req.params;
//     await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
//     await Review.findByIdAndDelete(reviewId);
//     res.redirect(`/listings/${id}`);
// }));

// module.exports = router;
const express = require("express");
const router = express.Router({ mergeParams: true });
const wrapAsync = require("../utils/wrapAsync");
const ExpressError = require("../utils/ExpressError");
const Listing = require("../models/listing");
const Review = require("../models/review");
const { reviewSchema } = require("../schemaValidation");
const {isLoggedIn,isReviewauthor}=require("../routes/middleware")

// Validation middleware
const validateReview = (req, res, next) => {
    const { error } = reviewSchema.validate(req.body);
    if (error) {
        const msg = error.details.map(el => el.message).join(",");
        throw new ExpressError(400, msg);
    }
    next();
};

// Add Review
router.post("/", isLoggedIn,validateReview, wrapAsync(async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    const newReview = new Review(req.body.review);
    console.log("current User:",req.user);
    newReview.author=req.user._id;
    listing.reviews.push(newReview);
    await newReview.save();
    await listing.save();
    res.redirect(`/listings/${req.params.id}`);
}));

// Delete Review
router.delete("/:reviewId",isLoggedIn,isReviewauthor, wrapAsync(async (req, res) => {
    const { id, reviewId } = req.params;
    await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
    await Review.findByIdAndDelete(reviewId);
      req.flash("success", "Review deleted successfully!"); 
   
    res.redirect(`/listings/${id}`);
}));

module.exports = router;

