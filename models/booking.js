const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bookingSchema = new Schema({
    listing: {
        type: Schema.Types.ObjectId,
        ref: "Listing",
        required: true
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    checkIn: {
        type: Date,
        required: true
    },
    checkOut: {
        type: Date,
        required: true
    },
    nights: {
        type: Number,
        required: true,
        min: 1
    },
    guests: {
        type: Number,
        required: true,
        default: 1,
        min: 1
    },
    pricePerNight: {
        type: Number,
        required: true
    },
    nightlyTotal: {
        type: Number,
        required: true
    },
    serviceFee: {
        type: Number,
        default: 0
    },
    tax: {
        type: Number,
        default: 0
    },
    totalPrice: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ["confirmed", "cancelled", "completed"],
        default: "confirmed"
    },
    bookingCode: {
        type: String,
        unique: true,
        required: true
    },
    guestName: {
        type: String
    },
    guestEmail: {
        type: String
    },
    specialRequests: {
        type: String,
        default: ""
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Helper static method to check for overlapping active reservations
bookingSchema.statics.hasOverlap = async function(listingId, checkIn, checkOut, excludeBookingId = null) {
    const query = {
        listing: listingId,
        status: "confirmed",
        checkIn: { $lt: checkOut },
        checkOut: { $gt: checkIn }
    };
    if (excludeBookingId) {
        query._id = { $ne: excludeBookingId };
    }
    const overlap = await this.findOne(query);
    return !!overlap;
};

module.exports = mongoose.model("Booking", bookingSchema);
