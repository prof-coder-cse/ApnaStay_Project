const express = require("express");
const router = express.Router({ mergeParams: true });
const Listing = require("../models/listing");
const Booking = require("../models/booking");
const wrapAsync = require("../utils/wrapAsync");
const ExpressError = require("../utils/ExpressError");
const { isLoggedIn, isBookingOwner } = require("./middleware");

// Helper to generate a unique readable booking reference
function generateBookingCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "WNDR-";
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// 1. API: Get booked dates for a listing (used by frontend calendar to disable booked ranges)
router.get("/listings/:id/booked-dates", wrapAsync(async (req, res) => {
    const { id } = req.params;
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const activeBookings = await Booking.find({
        listing: id,
        status: "confirmed",
        checkOut: { $gte: now }
    }).select("checkIn checkOut");

    res.json({
        bookedDates: activeBookings.map(b => ({
            from: b.checkIn.toISOString().split("T")[0],
            to: b.checkOut.toISOString().split("T")[0]
        }))
    });
}));

// 2. CREATE BOOKING for a listing
router.post("/listings/:id/bookings", isLoggedIn, wrapAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);

    if (!listing) {
        req.flash("error", "Listing not found");
        return res.redirect("/listings");
    }

    // Owner cannot book their own property
    if (listing.owner && listing.owner.equals(req.user._id)) {
        req.flash("error", "You cannot book your own property!");
        return res.redirect(`/listings/${id}`);
    }

    const { checkIn, checkOut, guests = 1, specialRequests = "" } = req.body;

    if (!checkIn || !checkOut) {
        req.flash("error", "Please select valid check-in and check-out dates.");
        return res.redirect(`/listings/${id}`);
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
        req.flash("error", "Invalid date format provided.");
        return res.redirect(`/listings/${id}`);
    }

    if (checkInDate < today) {
        req.flash("error", "Check-in date cannot be in the past.");
        return res.redirect(`/listings/${id}`);
    }

    if (checkOutDate <= checkInDate) {
        req.flash("error", "Check-out date must be after check-in date.");
        return res.redirect(`/listings/${id}`);
    }

    // Check for double booking
    const isOverlapping = await Booking.hasOverlap(id, checkInDate, checkOutDate);
    if (isOverlapping) {
        req.flash("error", "The selected dates are already booked! Please select other dates.");
        return res.redirect(`/listings/${id}`);
    }

    // Calculate nights & pricing
    const diffTime = checkOutDate.getTime() - checkInDate.getTime();
    const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const pricePerNight = Number(listing.price) || 0;
    const nightlyTotal = pricePerNight * nights;
    const serviceFee = Math.round(nightlyTotal * 0.05); // 5% platform service fee
    const tax = Math.round(nightlyTotal * 0.12);        // 12% GST/Taxes
    const totalPrice = nightlyTotal + serviceFee + tax;

    let bookingCode = generateBookingCode();
    // Ensure code is unique
    let existingCode = await Booking.findOne({ bookingCode });
    while (existingCode) {
        bookingCode = generateBookingCode();
        existingCode = await Booking.findOne({ bookingCode });
    }

    const newBooking = new Booking({
        listing: id,
        user: req.user._id,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        nights,
        guests: Math.max(1, parseInt(guests) || 1),
        pricePerNight,
        nightlyTotal,
        serviceFee,
        tax,
        totalPrice,
        status: "confirmed",
        bookingCode,
        guestName: req.user.username || "Guest",
        guestEmail: req.user.email || "",
        specialRequests
    });

    await newBooking.save();

    req.flash("success", `🎉 Booking Confirmed! Your confirmation code is ${bookingCode}`);
    res.redirect(`/bookings/${newBooking._id}`);
}));

// 3. GET "My Bookings" Dashboard
router.get("/bookings", isLoggedIn, wrapAsync(async (req, res) => {
    const bookings = await Booking.find({ user: req.user._id })
        .populate("listing")
        .sort({ createdAt: -1 });

    res.render("bookings/index", { bookings });
}));

// 4. GET Booking Voucher / Invoice Details
router.get("/bookings/:id", isLoggedIn, isBookingOwner, wrapAsync(async (req, res) => {
    const booking = await Booking.findById(req.params.id)
        .populate({
            path: "listing",
            populate: { path: "owner" }
        })
        .populate("user");

    if (!booking) {
        req.flash("error", "Booking not found");
        return res.redirect("/bookings");
    }

    res.render("bookings/show", { booking });
}));

// 5. CANCEL Booking
router.post("/bookings/:id/cancel", isLoggedIn, isBookingOwner, wrapAsync(async (req, res) => {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
        req.flash("error", "Booking not found");
        return res.redirect("/bookings");
    }

    if (booking.status === "cancelled") {
        req.flash("error", "This booking is already cancelled.");
        return res.redirect(`/bookings/${booking._id}`);
    }

    booking.status = "cancelled";
    await booking.save();

    req.flash("success", `Booking #${booking.bookingCode} has been successfully cancelled.`);
    res.redirect("/bookings");
}));

module.exports = router;
