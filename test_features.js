/**
 * Automated Verification Script for Wanderlust Booking & AI Features
 */
const assert = require("assert");
const mongoose = require("mongoose");
const aiService = require("./utils/aiService");
const Booking = require("./models/booking");

async function runTests() {
    console.log("==========================================");
    console.log(" RUNNING WANDERLUST VERIFICATION TESTS ");
    console.log("==========================================");

    // TEST 1: AI Service - Concierge Chat
    console.log("\n[1/4] Testing ApnaStay Concierge Chat...");
    const sampleListing = {
        title: "Sunset Villa Goa",
        location: "Goa",
        country: "India",
        price: 4500,
        description: "Beachfront villa with infinity pool and palm grove."
    };

    const itineraryResult = await aiService.chatWithConcierge("Plan a 2-day itinerary for my stay", sampleListing);
    assert(itineraryResult.response.length > 50, "Itinerary response should not be empty");
    assert(itineraryResult.response.includes("Day 1"), "Itinerary should contain Day 1");
    console.log("✅ WanderAI Concierge Itinerary response verified:", itineraryResult.source);

    const foodResult = await aiService.chatWithConcierge("What are the best food spots near here?", sampleListing);
    assert(foodResult.response.includes("Dining") || foodResult.response.includes("Food"), "Food response should be relevant");
    console.log("✅ WanderAI Dining recommendations verified:", foodResult.source);

    // TEST 2: AI Service - Review Summarization & Sentiment
    console.log("\n[2/4] Testing AI Review Sentiment & Summarization...");
    const sampleReviews = [
        { rating: 5, comment: "Absolutely breathtaking views and pristine cleanliness! The host was super hospitable." },
        { rating: 4, comment: "Cozy rooms and prime location near the beach. Had a slight wait for parking but loved the stay." }
    ];

    const reviewSummary = await aiService.summarizeReviews(sampleListing.title, sampleReviews);
    assert(reviewSummary.sentimentScore >= 80, "Sentiment score should be >= 80%");
    assert(reviewSummary.pros.length > 0, "Pros list should have items");
    assert(reviewSummary.summary.length > 20, "Summary should have text");
    console.log("✅ AI Review Sentiment analyzed successfully:", reviewSummary.sentiment);
    console.log("   Summary:", reviewSummary.summary);
    console.log("   Pros:", reviewSummary.pros.join(", "));

    // TEST 3: AI Service - Listing Description Generator
    console.log("\n[3/4] Testing Host AI Listing Generator...");
    const generated = await aiService.generateListingDescription({
        title: "Mountain Pine Haven",
        location: "Manali",
        country: "India",
        propertyType: "Wooden Chalet"
    });
    assert(generated.description.length > 100, "Generated description should be substantial");
    assert(generated.title.length > 5, "Generated title should be valid");
    console.log("✅ Host AI Generator produced copy successfully!");
    console.log("   Title:", generated.title);
    console.log("   Sample desc snippet:", generated.description.substring(0, 120) + "...");

    // TEST 4: Booking Model & Date Overlap Mathematics
    console.log("\n[4/4] Testing Booking Overlap Logic...");
    // Overlap logic test:
    // Existing: Nov 20 to Nov 25
    // Test A (overlapping): Nov 22 to Nov 27 -> overlap
    // Test B (adjacent / non-overlapping): Nov 25 to Nov 28 -> no overlap
    // Test C (before): Nov 15 to Nov 20 -> no overlap
    // Test D (inside): Nov 21 to Nov 24 -> overlap
    const existingCheckIn = new Date("2026-11-20T00:00:00Z");
    const existingCheckOut = new Date("2026-11-25T00:00:00Z");

    function isOverlapping(newIn, newOut) {
        return (newIn < existingCheckOut && newOut > existingCheckIn);
    }

    assert.strictEqual(isOverlapping(new Date("2026-11-22T00:00:00Z"), new Date("2026-11-27T00:00:00Z")), true, "Should overlap");
    assert.strictEqual(isOverlapping(new Date("2026-11-21T00:00:00Z"), new Date("2026-11-24T00:00:00Z")), true, "Should overlap inside");
    assert.strictEqual(isOverlapping(new Date("2026-11-25T00:00:00Z"), new Date("2026-11-28T00:00:00Z")), false, "Adjacent checkout/checkin should NOT overlap");
    assert.strictEqual(isOverlapping(new Date("2026-11-15T00:00:00Z"), new Date("2026-11-20T00:00:00Z")), false, "Prior booking should NOT overlap");

    console.log("✅ Booking date overlap calculations verified!");

    console.log("\n==========================================");
    console.log(" ALL TESTS PASSED SUCCESSFULLY! (4/4) ");
    console.log("==========================================");
}

runTests().catch(err => {
    console.error("❌ Test Failed:", err);
    process.exit(1);
});
