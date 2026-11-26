// middleware.js
const Listing = require("../models/listing");
const Review = require("../models/review"); 


function isLoggedIn(req,res,next){
    if(!req.isAuthenticated()){
        req.session.redirectUrl=req.originalUrl;
        req.flash("error","you must be logged in to create listing!")
       return res.redirect("/login")
    }
    next();
};
// function saveRedirectUrl(req,res,next){
//     if(req.session.redirectUrl){
//         res.locals.redirectUrl=req.session.redirectUrl;

//     }
//     next();
// };
function saveRedirectUrl(req, res, next) {
    if (req.session.redirectUrl) {
        // Agar URL me _method=DELETE ya POST type hai to usse /listings par redirect karo
        const redirectUrl = req.session.redirectUrl;
        if (redirectUrl.includes("_method=DELETE")) {
            res.locals.redirectUrl = "/listings";
        } else {
            res.locals.redirectUrl = redirectUrl;
        }
    }
    next();
}

async function isOwner (req,res,next){
      const {id}=req.params
    let listing=await Listing.findById(id);
    if(!listing.owner._id.equals(res.locals.currentUser._id)){
req.flash("error","you don't have permission");
return res.redirect(`/listings/${id}`)
    }
    next();
}
async function isReviewauthor(req,res,next) {
    const {id,reviewId}=req.params;
    let foundreview=await Review.findById(reviewId);
    if(!foundreview || !foundreview.author.equals(res.locals.currentUser._id)){
        req.flash("error","You are not the author of this review");
        return res.redirect(`/listings/${id}`);
    }
    next();
}

async function isBookingOwner(req, res, next) {
    const Booking = require("../models/booking");
    const { id } = req.params;
    let booking = await Booking.findById(id);
    if (!booking) {
        req.flash("error", "Booking not found");
        return res.redirect("/bookings");
    }
    if (!booking.user.equals(res.locals.currentUser._id)) {
        req.flash("error", "You do not have permission to view or manage this booking");
        return res.redirect("/bookings");
    }
    next();
}

module.exports = { isLoggedIn, saveRedirectUrl, isOwner, isReviewauthor, isBookingOwner };
