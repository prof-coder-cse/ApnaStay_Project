const express = require("express");
const router = express.Router();
const Listing = require("../models/listing");
const aiService = require("../utils/aiService");
const wrapAsync = require("../utils/wrapAsync");
const { isLoggedIn } = require("./middleware");

// 1. AI Concierge Chat (for listings & general travel questions)
router.post("/chat", wrapAsync(async (req, res) => {
    const { message, listingId } = req.body;

    if (!message || message.trim() === "") {
        return res.status(400).json({ error: "Message is required" });
    }

    let listing = {};
    if (listingId) {
        try {
            const foundListing = await Listing.findById(listingId);
            if (foundListing) {
                listing = foundListing;
            }
        } catch (e) {
            // Ignore invalid ObjectId and proceed with generic context
        }
    }

    const aiResult = await aiService.chatWithConcierge(message, listing);
    res.json({
        success: true,
        response: aiResult.response,
        source: aiResult.source
    });
}));

// 2. AI Review Summarization & Sentiment Analysis
router.get("/summarize-reviews/:id", wrapAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id).populate("reviews");

    if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
    }

    const insights = await aiService.summarizeReviews(listing.title, listing.reviews);
    res.json({
        success: true,
        insights
    });
}));

// 3. AI Host Listing Generator / Enhancer
router.post("/generate-description", isLoggedIn, wrapAsync(async (req, res) => {
    const { title, location, country, propertyType, vibes } = req.body;

    const generated = await aiService.generateListingDescription({
        title,
        location,
        country,
        propertyType,
        vibes
    });

    res.json({
        success: true,
        data: generated
    });
}));

module.exports = router;
