/**
 * WanderAI Service Engine
 * Dual-Mode AI Engine:
 * 1. Cloud Mode: Connects to Gemini API or OpenAI-compatible endpoint when API keys are configured.
 * 2. Intelligent Contextual Engine: Provides smart, zero-dependency offline generation with
 *    location awareness, sentiment analysis, and itinerary synthesis for seamless college demo reliability.
 */

const https = require("https");

// --- Helper for Gemini API calls ---
async function callGeminiApi(prompt, systemInstruction = "") {
    const apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
    if (!apiKey) return null;

    const postData = JSON.stringify({
        contents: [
            {
                role: "user",
                parts: [{ text: (systemInstruction ? systemInstruction + "\n\n" : "") + prompt }]
            }
        ],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 800,
        }
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    return new Promise((resolve) => {
        try {
            const req = https.request(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(postData)
                },
                timeout: 5000
            }, (res) => {
                let data = "";
                res.on("data", chunk => data += chunk);
                res.on("end", () => {
                    try {
                        const parsed = JSON.parse(data);
                        const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                        resolve(text || null);
                    } catch (e) {
                        resolve(null);
                    }
                });
            });

            req.on("error", () => resolve(null));
            req.on("timeout", () => {
                req.destroy();
                resolve(null);
            });

            req.write(postData);
            req.end();
        } catch (e) {
            resolve(null);
        }
    });
}

// --- 1. Concierge & Itinerary AI Assistant ---
async function chatWithConcierge(message, listing = {}) {
    const systemPrompt = `You are "WanderAI", an elite virtual concierge and local travel expert for Airbnb/Wanderlust.
You are assisting a guest looking at:
- Property: "${listing.title || 'Vacation Rental'}"
- Location: "${listing.location || 'Unknown'}, ${listing.country || ''}"
- Price: ₹${listing.price || 'N/A'}/night
- Description: "${listing.description || ''}"

Respond in a warm, polite, and helpful tone. Provide specific, tailored advice about local spots, best dining options, activities, packing tips, or custom itineraries. Keep response structured with bullet points where appropriate.`;

    // Try cloud API first if available
    const cloudResponse = await callGeminiApi(message, systemPrompt);
    if (cloudResponse) {
        return {
            source: "Gemini AI",
            response: cloudResponse
        };
    }

    // Contextual Fallback Engine (Offline resilient)
    const lower = (message || "").toLowerCase();
    const loc = listing.location || "this beautiful destination";
    const country = listing.country || "";
    const title = listing.title || "the property";

    let reply = "";

    if (lower.includes("itinerary") || lower.includes("plan") || lower.includes("day") || lower.includes("schedule")) {
        reply = `✨ **Curated 2-Day Itinerary for your stay at ${title} (${loc})**:

**Day 1: Arrival & Local Charm**
- **Morning**: Check-in, unpack, and enjoy morning coffee with panoramic views from ${title}.
- **Afternoon**: Explore the central streets of ${loc}, visit iconic local landmarks, and sample authentic regional street food.
- **Evening**: Catch the golden hour sunset nearby, followed by a cozy dinner at a top-rated local bistro.

**Day 2: Adventure & Unwinding**
- **Morning**: Early outdoor walk or scenic tour in and around ${loc}.
- **Afternoon**: Discover artisanal craft markets and cultural spots before relaxing at the property.
- **Night**: Stargaze or enjoy a peaceful dinner at ${title}.

*Tip: Need taxi, packing, or booking recommendations? Just ask me!*`;
    } else if (lower.includes("food") || lower.includes("eat") || lower.includes("restaurant") || lower.includes("cafe")) {
        reply = `🍽️ **Local Dining Recommendations near ${loc}**:
1. **The Heritage Kitchen**: Celebrated for authentic regional dishes and fresh seasonal ingredients.
2. **Sunset Terrace Bistro**: Perfect for an evening meal with scenic ambient views.
3. **Artisan Bakery & Cafe**: Great breakfast spot with freshly baked bread, premium coffee, and pastries.

*Foodie Tip*: Ask the host for their personal favorite hidden gems within walking distance!`;
    } else if (lower.includes("pack") || lower.includes("weather") || lower.includes("bring")) {
        reply = `🎒 **Packing & Travel Essentials for ${loc}, ${country}**:
- Comfortable walking/hiking shoes for exploring the local sights.
- Lightweight, breathable clothing during the day, plus a light jacket or shawl for cooler evenings.
- Universal power adapter, portable power bank, and your camera.
- Sunscreen, sunglasses, and personal toiletries.`;
    } else if (lower.includes("attraction") || lower.includes("do") || lower.includes("visit") || lower.includes("sight")) {
        reply = `📍 **Top Highlights & Activities in ${loc}**:
- **Scenic Lookouts**: Experience breathtaking views of ${loc}'s signature landscapes.
- **Historic & Cultural Walk**: Discover the unique heritage, architecture, and stories of ${country}.
- **Local Bazaars**: Pick up unique handcrafted souvenirs and taste regional delicacies.
- **Rest & Rejuvenate**: Unwind in the tranquil ambience of "${title}".`;
    } else {
        reply = `👋 **Hello from WanderAI Concierge!**

I'm your dedicated travel assistant for **"${title}"** in **${loc}, ${country}**.

Here are some things I can do for you:
- 🗺️ **"Plan a 2-day itinerary for my stay"**
- 🍴 **"Recommend the best restaurants and local food near here"**
- 🎒 **"What should I pack for ${loc}?"**
- 🚗 **"What are the top things to do around this property?"**

How can I help make your trip unforgettable?`;
    }

    return {
        source: "WanderAI Engine",
        response: reply
    };
}

// --- 2. AI Review Summarizer & Sentiment Analysis ---
async function summarizeReviews(listingTitle, reviews = []) {
    if (!reviews || reviews.length === 0) {
        return {
            sentiment: "No reviews yet",
            sentimentScore: 100,
            summary: "This property is ready for its first guest review!",
            pros: ["New listing ready for booking"],
            cons: ["Be the first to share your experience"]
        };
    }

    // Try cloud API
    const reviewsText = reviews.map((r, i) => `Review ${i + 1} (${r.rating || 5} stars): ${r.comment}`).join("\n");
    const cloudPrompt = `Analyze the following guest reviews for the property "${listingTitle}".
Return valid JSON only in this format:
{
  "sentiment": "e.g. 96% Positive",
  "sentimentScore": 96,
  "summary": "2-sentence summary of guest consensus",
  "pros": ["Highlight 1", "Highlight 2", "Highlight 3"],
  "cons": ["Observation or none"]
}

Reviews:
${reviewsText}`;

    const rawCloud = await callGeminiApi(cloudPrompt, "You are a hospitality data scientist. Return valid JSON only.");
    if (rawCloud) {
        try {
            const cleaned = rawCloud.replace(/```json/g, "").replace(/```/g, "").trim();
            const parsed = JSON.parse(cleaned);
            return parsed;
        } catch (e) {
            // fallback
        }
    }

    // Intelligent heuristic analyzer
    const totalRating = reviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
    const avgRating = (totalRating / reviews.length).toFixed(1);
    const sentimentScore = Math.min(100, Math.round((avgRating / 5) * 100));

    const combinedComments = reviews.map(r => (r.comment || "").toLowerCase()).join(" ");

    const pros = [];
    const cons = [];

    if (combinedComments.includes("clean") || combinedComments.includes("tidy") || combinedComments.includes("neat")) {
        pros.push("Pristine cleanliness & hygiene");
    } else {
        pros.push("Comfortable accommodations");
    }

    if (combinedComments.includes("view") || combinedComments.includes("scenery") || combinedComments.includes("beach") || combinedComments.includes("mountain")) {
        pros.push("Picturesque views & setting");
    }

    if (combinedComments.includes("host") || combinedComments.includes("friendly") || combinedComments.includes("helpful")) {
        pros.push("Warm, responsive hospitality");
    }

    if (combinedComments.includes("location") || combinedComments.includes("peaceful") || combinedComments.includes("close")) {
        pros.push("Prime, accessible location");
    }

    if (pros.length < 2) {
        pros.push("Great value for money", "Accurate listing description");
    }

    if (combinedComments.includes("noise") || combinedComments.includes("loud")) {
        cons.push("Ambient street noise mentioned");
    }
    if (combinedComments.includes("parking") || combinedComments.includes("car")) {
        cons.push("Limited parking spaces during peak hours");
    }
    if (cons.length === 0) {
        cons.push("No significant complaints reported by guests");
    }

    return {
        sentiment: `${sentimentScore}% Positive (${avgRating}★ / 5★)`,
        sentimentScore,
        summary: `Based on ${reviews.length} guest review${reviews.length > 1 ? 's' : ''}, guests overwhelmingly praise "${listingTitle}" for its hospitable atmosphere, accurate amenities, and comfortable stay.`,
        pros: pros.slice(0, 3),
        cons: cons.slice(0, 2)
    };
}

// --- 3. Host AI Listing Description Generator ---
async function generateListingDescription(data = {}) {
    const { title = "", location = "", country = "", propertyType = "Apartment / Villa", vibes = "cozy and modern" } = data;

    const cloudPrompt = `Generate a compelling, high-converting Airbnb listing copy for:
- Title: "${title}"
- Location: "${location}, ${country}"
- Type: "${propertyType}"
- Vibe: "${vibes}"

Return valid JSON with:
{
  "title": "catchy enhanced title",
  "description": "2-3 engaging, descriptive paragraphs highlighting comfort, amenities, and location",
  "highlights": ["highlight 1", "highlight 2", "highlight 3"]
}`;

    const rawCloud = await callGeminiApi(cloudPrompt, "Return only valid JSON.");
    if (rawCloud) {
        try {
            const cleaned = rawCloud.replace(/```json/g, "").replace(/```/g, "").trim();
            return JSON.parse(cleaned);
        } catch (e) {
            // fallback
        }
    }

    // Contextual generator
    const locStr = location ? `${location}${country ? ', ' + country : ''}` : "a prime destination";
    const cleanTitle = title.trim() || `Stunning Retreat in ${location || 'Paradise'}`;
    const enhancedTitle = cleanTitle.startsWith("✨") ? cleanTitle : `✨ ${cleanTitle} | Scenic Stay`;

    const generatedDesc = `Escape to this beautifully appointed ${propertyType.toLowerCase()} nestled in ${locStr}. Thoughtfully designed to blend contemporary comfort with relaxing elegance, this space serves as the perfect sanctuary for weekend getaways, remote work retreats, or family vacations.

Enjoy sun-drenched living areas, cozy sleeping quarters with premium bedding, and a peaceful ambiance throughout. Step outside to explore the vibrant neighborhood of ${location || 'the area'}, with top-rated eateries, artisanal cafes, and iconic sights just minutes away.

Whether you're sipping morning coffee on the private patio or unwinding under the stars, this property ensures a memorable and effortless stay.`;

    return {
        title: enhancedTitle,
        description: generatedDesc,
        highlights: [
            `Prime location in ${locStr}`,
            "High-speed Wi-Fi & dedicated workspace ready",
            "Self check-in with verified sanitization standards"
        ]
    };
}

module.exports = {
    chatWithConcierge,
    summarizeReviews,
    generateListingDescription
};
