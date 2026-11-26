/**
 * WanderAI Service Engine (Improved)
 * Dual-Mode AI Engine:
 * 1. Cloud Mode: Gemini / OpenAI-compatible when API keys are present.
 * 2. Intelligent Contextual Engine: Smarter offline generation with
 *    better intent detection, location awareness, and higher-quality
 *    review analysis.
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
            temperature: 0.65,
            maxOutputTokens: 900,
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
                timeout: 6000
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

// --- Intent helpers for offline mode ---
function detectIntent(message) {
    const lower = (message || "").toLowerCase().trim();

    const intents = [
        { name: "itinerary", keywords: ["itinerary", "plan", "schedule", "day trip", "what to do each day", "2 day", "3 day", "weekend plan"] },
        { name: "food", keywords: ["food", "eat", "restaurant", "cafe", "dining", "breakfast", "lunch", "dinner", "cuisine", "where to eat"] },
        { name: "pack", keywords: ["pack", "packing", "what to bring", "weather", "clothes", "essentials", "what should i bring"] },
        { name: "attractions", keywords: ["attraction", "visit", "sight", "things to do", "places to see", "activities", "explore", "must see", "tourist"] },
        { name: "transport", keywords: ["taxi", "uber", "transport", "how to reach", "airport", "train", "bus", "metro", "getting around", "commute"] },
        { name: "safety", keywords: ["safe", "safety", "security", "is it safe", "night", "alone"] },
        { name: "family", keywords: ["family", "kids", "children", "child friendly", "baby"] },
        { name: "budget", keywords: ["budget", "cheap", "affordable", "cost", "expensive", "price"] },
        { name: "amenities", keywords: ["wifi", "parking", "kitchen", "ac", "air conditioning", "pool", "amenities", "facilities"] },
        { name: "checkin", keywords: ["check in", "check-in", "check out", "self check", "key", "arrival"] },
    ];

    for (const intent of intents) {
        if (intent.keywords.some(k => lower.includes(k))) {
            return intent.name;
        }
    }

    // Greeting / general
    if (lower.match(/^(hi|hello|hey|good morning|good evening|namaste)/) || lower.length < 12) {
        return "greeting";
    }

    return "general";
}

// --- 1. Concierge & Itinerary AI Assistant ---
async function chatWithConcierge(message, listing = {}) {
    const systemPrompt = `You are "WanderAI", an elite virtual concierge and local travel expert for Airbnb-style stays.
You are helping a guest with this property:
- Title: "${listing.title || 'Vacation Rental'}"
- Location: "${listing.location || 'Unknown'}, ${listing.country || ''}"
- Price: ₹${listing.price || 'N/A'}/night
- Description: "${listing.description || ''}"

Rules:
- Be warm, specific, and practical.
- Always ground advice in the actual location when possible.
- Use short paragraphs + bullet points.
- If the question is vague, still give useful local recommendations.
- Never invent fake specific restaurant names unless they are generic (e.g. "local cafe"). Prefer realistic guidance.`;

    // Cloud first
    const cloudResponse = await callGeminiApi(message, systemPrompt);
    if (cloudResponse) {
        return { source: "Gemini AI", response: cloudResponse };
    }

    // ---------- Improved Offline Engine ----------
    const loc = listing.location || "this destination";
    const country = listing.country || "";
    const title = listing.title || "the property";
    const price = listing.price ? `₹${listing.price}` : "the listed price";
    const intent = detectIntent(message);
    const lower = (message || "").toLowerCase();

    let reply = "";

    switch (intent) {
        case "itinerary":
            reply = `✨ **Personalized 2-Day Itinerary for ${title} (${loc})**

**Day 1 – Settle In & Local Flavors**
- Morning: Check-in, freshen up, and enjoy the view / quiet of the property.
- Afternoon: Walk the main streets of ${loc}. Try local street food or a popular cafe.
- Evening: Golden-hour walk + dinner at a well-rated neighborhood restaurant.

**Day 2 – Explore & Unwind**
- Morning: Early start for the top scenic spot or landmark near ${loc}.
- Afternoon: Local market / handicraft shopping + return to the property for rest.
- Evening: Relaxed dinner or stargazing from ${title}.

Want a 3-day version, family-friendly version, or food-focused version? Just tell me.`;
            break;

        case "food":
            reply = `🍽️ **Eating near ${loc}**

Recommended approach:
1. **Local specialty** – Ask the host for the one dish ${loc} is famous for and where locals actually go.
2. **Casual & reliable** – Look for busy neighborhood cafes or thali places within 10–15 min walk/ride.
3. **Evening** – Choose a place with outdoor seating if the weather is pleasant.

Quick tips:
- Breakfast: Local bakery or cafe near the property.
- Lunch: Regional thali or street food cluster.
- Dinner: Slightly nicer place with good reviews (check Google Maps ratings >4.2).

I can also suggest vegetarian-only, budget, or late-night options if you tell me your preference.`;
            break;

        case "pack":
            reply = `🎒 **What to Pack for ${loc}${country ? ", " + country : ""}**

Essentials:
- Comfortable walking shoes (you will walk a lot)
- Light, breathable day clothes + one warmer layer for evenings
- Universal adapter + power bank
- Sunscreen, sunglasses, basic medicines
- Reusable water bottle

Optional but useful:
- Light rain jacket / umbrella (depending on season)
- Small day-pack
- Any specific items based on activities (swimwear, hiking shoes, etc.)

Want season-specific advice (summer / monsoon / winter)? Tell me the month of travel.`;
            break;

        case "attractions":
            reply = `📍 **Things to Do around ${loc}**

Core experiences:
- **Scenic / viewpoint** – Most places near ${loc} have a signature lookout or natural spot. Start here.
- **Cultural / heritage** – Local temple, fort, old market, or museum that gives a feel of the place.
- **Neighborhood walk** – Best way to discover cafes, street food, and daily life.
- **Relax at the property** – Especially valuable if ${title} has a good view or outdoor space.

Pro tip: Ask the host for their personal “don’t miss” list — it is usually better than generic tourist guides.

Tell me if you prefer nature, culture, adventure, or food-focused activities and I will refine this.`;
            break;

        case "transport":
            reply = `🚗 **Getting Around ${loc}**

Typical options:
- **Airport / station transfer**: Pre-book a taxi or use the host’s recommended service (safer and clearer price).
- **Local movement**: Auto-rickshaw / Uber / local buses depending on the city size.
- **Walking**: Many attractions near residential stays are walkable — confirm distance with the host.

Ask the host:
1. Best way from airport/station to the property
2. Approximate auto/Uber cost for common routes
3. Whether parking is available if you are driving

I can help you plan specific transfers if you share your arrival details.`;
            break;

        case "safety":
            reply = `🛡️ **Safety Snapshot for ${loc}**

General guidance:
- Stick to well-lit and populated areas at night.
- Use known taxi apps or the host’s recommended drivers.
- Keep valuables in the property safe or locked luggage.
- Share your live location with family when moving around alone.

Most residential stays like "${title}" are in relatively calm neighborhoods. Still, treat the area with normal big-city / tourist-area caution.

If you are traveling solo or with kids, I can give more targeted tips.`;
            break;

        case "family":
            reply = `👨‍👩‍👧‍👦 **Family-Friendly Notes for ${title} in ${loc}**

- Check with the host about extra beds / baby cot availability.
- Prefer properties with kitchen access for easy meals with kids.
- Plan shorter activity days with built-in rest time at the property.
- Pack familiar snacks and any required medicines.

I can suggest a lighter itinerary suitable for young children if you tell me their ages.`;
            break;

        case "budget":
            reply = `💰 **Budget Tips for staying at ${title} (${price}/night)**

- Cooking a few meals at the property saves a lot.
- Use public transport or shared autos for short distances.
- Eat where locals eat for better value.
- Book any paid attractions online in advance when possible.

Want a rough daily budget estimate (food + local travel + activities)? Tell me your style (backpacker / mid-range / comfortable).`;
            break;

        case "amenities":
            reply = `🏠 **About Amenities at ${title}**

I recommend checking the official listing for exact facilities (Wi-Fi speed, parking, kitchen, AC, pool, etc.).

Common questions guests ask the host:
- Is the Wi-Fi strong enough for work calls?
- Is there secure parking?
- Kitchen fully equipped?
- Self check-in or host reception?

If you tell me which amenity matters most to you, I can help you phrase the question to the host.`;
            break;

        case "checkin":
            reply = `🔑 **Check-in Guidance**

Most modern listings offer self check-in (lockbox / smart lock) or host-assisted arrival.

Best practice:
1. Message the host 24–48 hours before arrival with your expected time.
2. Confirm exact instructions and any door codes.
3. Keep the host’s number saved.

If you share your arrival time, I can help you draft a clear message to the host.`;
            break;

        case "greeting":
            reply = `👋 **Hello! I’m WanderAI**, your local concierge for **${title}** in **${loc}${country ? ", " + country : ""}**.

I can help with:
- Custom itineraries
- Food & restaurant advice
- Packing lists
- Things to do
- Transport & safety tips

Just ask me anything about your stay!`;
            break;

        default:
            // General / fallback – still try to be useful
            reply = `I understand you're asking about: "${message}"

Here's how I can help with **${title}** in **${loc}**:

- If you want a ready plan → say “make a 2-day itinerary”
- Food recommendations → “best places to eat nearby”
- Packing advice → “what should I pack”
- Local attractions → “things to do in ${loc}”
- Transport / safety / family / budget → just ask directly

Feel free to rephrase or give more details and I’ll give you a focused answer.`;
    }

    return {
        source: "WanderAI Engine",
        response: reply
    };
}

// --- 2. Improved Review Summarizer & Sentiment Analysis ---
async function summarizeReviews(listingTitle, reviews = []) {
    if (!reviews || reviews.length === 0) {
        return {
            sentiment: "No reviews yet",
            sentimentScore: 100,
            summary: "This property is ready for its first guest review!",
            pros: ["New listing — opportunity to be the first reviewer"],
            cons: ["No guest feedback available yet"]
        };
    }

    // Cloud path
    const reviewsText = reviews
        .map((r, i) => `Review ${i + 1} (${r.rating || 5}★): ${r.comment || ""}`)
        .join("\n");

    const cloudPrompt = `Analyze these guest reviews for the property "${listingTitle}".
Return ONLY valid JSON in this exact shape:
{
  "sentiment": "e.g. 92% Positive",
  "sentimentScore": 92,
  "summary": "2-sentence balanced summary of overall guest experience",
  "pros": ["specific highlight 1", "specific highlight 2", "specific highlight 3"],
  "cons": ["specific observation or mild issue 1", "or empty if none"]
}

Be accurate and extract real themes from the text. Do not invent issues.

Reviews:
${reviewsText}`;

    const rawCloud = await callGeminiApi(cloudPrompt, "You are a hospitality data analyst. Return valid JSON only.");
    if (rawCloud) {
        try {
            const cleaned = rawCloud.replace(/```json/g, "").replace(/```/g, "").trim();
            const parsed = JSON.parse(cleaned);
            // basic validation
            if (parsed.sentiment && typeof parsed.sentimentScore === "number") {
                return parsed;
            }
        } catch (e) {
            // fall through to heuristic
        }
    }

    // ---------- Improved Offline Heuristic Analyzer ----------
    const ratings = reviews.map(r => Number(r.rating) || 5);
    const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    const sentimentScore = Math.min(100, Math.round((avgRating / 5) * 100));

    // Word lists
    const positiveWords = [
        "clean", "tidy", "spotless", "beautiful", "amazing", "wonderful", "excellent",
        "great", "perfect", "comfortable", "cozy", "spacious", "helpful", "friendly",
        "responsive", "kind", "location", "view", "scenery", "peaceful", "quiet",
        "recommend", "loved", "enjoyed", "fantastic", "superb", "value", "worth"
    ];

    const negativeWords = [
        "dirty", "messy", "noise", "noisy", "loud", "smell", "smelly", "broken",
        "issue", "problem", "delay", "late", "uncomfortable", "small", "tiny",
        "expensive", "overpriced", "parking", "far", "difficult", "poor", "bad",
        "disappointing", "worst", "never again"
    ];

    const prosMap = {
        clean: "Impeccable cleanliness",
        tidy: "Impeccable cleanliness",
        spotless: "Impeccable cleanliness",
        view: "Beautiful views / scenery",
        scenery: "Beautiful views / scenery",
        location: "Excellent location",
        host: "Friendly & responsive host",
        friendly: "Friendly & responsive host",
        helpful: "Friendly & responsive host",
        comfortable: "Very comfortable stay",
        cozy: "Cozy and welcoming atmosphere",
        spacious: "Spacious and well-designed",
        quiet: "Peaceful & quiet surroundings",
        peaceful: "Peaceful & quiet surroundings",
        value: "Good value for money",
        recommend: "Highly recommended by guests"
    };

    const consMap = {
        noise: "Some noise reported",
        noisy: "Some noise reported",
        loud: "Some noise reported",
        parking: "Parking can be limited",
        dirty: "Cleanliness concerns mentioned",
        messy: "Cleanliness concerns mentioned",
        small: "Space felt smaller than expected by some",
        tiny: "Space felt smaller than expected by some",
        far: "Slightly far from main attractions for some guests",
        issue: "Minor issues reported by a few guests",
        problem: "Minor issues reported by a few guests"
    };

    let positiveHits = 0;
    let negativeHits = 0;
    const foundPros = new Set();
    const foundCons = new Set();

    const allText = reviews.map(r => (r.comment || "").toLowerCase()).join(" ");

    positiveWords.forEach(w => {
        if (allText.includes(w)) {
            positiveHits++;
            if (prosMap[w]) foundPros.add(prosMap[w]);
        }
    });

    negativeWords.forEach(w => {
        if (allText.includes(w)) {
            negativeHits++;
            if (consMap[w]) foundCons.add(consMap[w]);
        }
    });

    // Default pros if none detected
    if (foundPros.size === 0) {
        foundPros.add("Comfortable overall stay");
        foundPros.add("Accurate listing description");
        if (avgRating >= 4.5) foundPros.add("Consistently high guest ratings");
    }

    // Default cons
    if (foundCons.size === 0) {
        if (avgRating >= 4.7) {
            foundCons.add("No significant complaints in the reviews");
        } else {
            foundCons.add("A few guests noted minor areas for improvement");
        }
    }

    // Build summary
    let summary = "";
    if (avgRating >= 4.6) {
        summary = `Guests highly rate "${listingTitle}" (${avgRating.toFixed(1)}★). They consistently praise the overall experience, comfort, and hospitality.`;
    } else if (avgRating >= 4.0) {
        summary = `Guests generally enjoy their stay at "${listingTitle}" (${avgRating.toFixed(1)}★). Most feedback is positive with only occasional minor notes.`;
    } else {
        summary = `Reviews for "${listingTitle}" average ${avgRating.toFixed(1)}★. Feedback is mixed — some guests were satisfied while others mentioned areas that could be improved.`;
    }

    if (positiveHits > negativeHits * 2) {
        summary += " The dominant tone across reviews is clearly positive.";
    }

    return {
        sentiment: `${sentimentScore}% Positive (${avgRating.toFixed(1)}★ average)`,
        sentimentScore,
        summary,
        pros: Array.from(foundPros).slice(0, 4),
        cons: Array.from(foundCons).slice(0, 3)
    };
}

// --- 3. Host AI Listing Description Generator ---
async function generateListingDescription(data = {}) {
    const {
        title = "",
        location = "",
        country = "",
        propertyType = "Apartment / Villa",
        vibes = "cozy and modern"
    } = data;

    const cloudPrompt = `Write high-converting Airbnb-style listing content.
Property details:
- Title: "${title}"
- Location: "${location}, ${country}"
- Type: "${propertyType}"
- Desired vibe: "${vibes}"

Return ONLY valid JSON:
{
  "title": "improved catchy title (max 50 chars preferred)",
  "description": "2-3 engaging paragraphs that feel warm and specific",
  "highlights": ["highlight 1", "highlight 2", "highlight 3"]
}`;

    const rawCloud = await callGeminiApi(cloudPrompt, "Return valid JSON only. Be specific and persuasive.");
    if (rawCloud) {
        try {
            const cleaned = rawCloud.replace(/```json/g, "").replace(/```/g, "").trim();
            return JSON.parse(cleaned);
        } catch (e) {
            // fallback
        }
    }

    // Offline generator
    const locStr = location ? `${location}${country ? ", " + country : ""}` : "a wonderful destination";
    const cleanTitle = title.trim() || `Beautiful Stay in ${location || "Paradise"}`;
    const enhancedTitle = cleanTitle.startsWith("✨") ? cleanTitle : `✨ ${cleanTitle}`;

    const description = `Welcome to this thoughtfully designed ${propertyType.toLowerCase()} in ${locStr}. Created for guests who value comfort, calm, and convenient access to local experiences, this space strikes the perfect balance between a stylish home and a relaxing retreat.

Inside you’ll find comfortable living areas, quality bedding, and all the essentials for a smooth stay. Whether you’re here for a short city break, a remote-work week, or a family getaway, the layout and amenities support both productivity and rest.

Step outside and you’re minutes from the character of ${location || "the neighborhood"} — local eateries, walks, and everyday moments that make a trip memorable. Guests often mention how easy it is to settle in and feel at home.`;

    return {
        title: enhancedTitle,
        description,
        highlights: [
            `Great base in ${locStr}`,
            "Comfortable & well-equipped for short or longer stays",
            "Ideal mix of privacy and local access"
        ]
    };
}

module.exports = {
    chatWithConcierge,
    summarizeReviews,
    generateListingDescription
};
