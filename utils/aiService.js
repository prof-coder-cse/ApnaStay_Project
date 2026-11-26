/**
 * WanderAI Service Engine (v2)
 *
 * Requires Node 18+ (uses global fetch / AbortController).
 *
 * Env vars:
 *   GEMINI_API_KEY (or AI_API_KEY)  - required for real AI answers
 *   GEMINI_MODEL                    - optional, default "gemini-2.5-flash"
 *   AI_DEBUG=true                   - optional, logs why the cloud call failed
 *
 * Design rules:
 *  - Cloud AI is the primary path. Failures are LOGGED (never silent).
 *  - The offline fallback never invents facts (no fake restaurants, amenities, etc.).
 *    It only uses data that is actually present in `listing` / `reviews`.
 */

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const TIMEOUT_MS = 20000;

function log(...args) {
    if (process.env.AI_DEBUG === "true") console.warn("[WanderAI]", ...args);
}

// ---------- Gemini helper ----------
async function callGemini({ prompt, system = "", history = [], json = false, maxTokens = 1500, temperature = 0.6 }) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
    if (!apiKey) {
        log("No API key set - using offline engine.");
        return null;
    }

    const contents = [
        ...history
            .filter(h => h && h.text)
            .slice(-10)
            .map(h => ({ role: h.role === "model" || h.role === "assistant" ? "model" : "user", parts: [{ text: String(h.text) }] })),
        { role: "user", parts: [{ text: prompt }] }
    ];

    const body = {
        contents,
        generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
            ...(json ? { responseMimeType: "application/json" } : {}),
            // 2.5-flash "thinking" tokens eat the output budget and can truncate answers
            ...(MODEL.includes("2.5-flash") ? { thinkingConfig: { thinkingBudget: 0 } } : {})
        }
    };
    if (system) body.systemInstruction = { parts: [{ text: system }] };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
                body: JSON.stringify(body),
                signal: controller.signal
            }
        );

        if (!res.ok) {
            log(`Gemini HTTP ${res.status}:`, (await res.text()).slice(0, 300));
            return null;
        }

        const data = await res.json();
        const cand = data?.candidates?.[0];
        const text = (cand?.content?.parts || []).map(p => p.text || "").join("").trim();

        if (!text) {
            log("Empty Gemini response. finishReason:", cand?.finishReason, "feedback:", JSON.stringify(data?.promptFeedback));
            return null;
        }
        if (cand?.finishReason === "MAX_TOKENS") log("Response truncated (MAX_TOKENS).");
        return text;
    } catch (e) {
        log("Gemini request failed:", e.name === "AbortError" ? "timeout" : e.message);
        return null;
    } finally {
        clearTimeout(timer);
    }
}

function parseJson(raw) {
    if (!raw) return null;
    try {
        const start = raw.indexOf("{");
        const end = raw.lastIndexOf("}");
        if (start === -1 || end === -1) return null;
        return JSON.parse(raw.slice(start, end + 1));
    } catch {
        return null;
    }
}

const has = (text, words) => words.some(w => new RegExp(`\\b${w}`, "i").test(text));

// ---------- 1. Concierge ----------
async function chatWithConcierge(message, listing = {}, history = []) {
    const loc = listing.location || "";
    const country = listing.country || "";
    const place = [loc, country].filter(Boolean).join(", ") || "the destination";
    const title = listing.title || "this property";

    const system = `You are "WanderAI", a travel concierge for a vacation-rental platform.

PROPERTY FACTS (the only facts you may state about the property):
- Title: ${title}
- Location: ${place}
- Price: ${listing.price ? "₹" + listing.price + " per night" : "not specified"}
- Description: ${listing.description || "not provided"}

RULES:
- Answer the guest's actual question directly and specifically. Do not give a generic greeting unless they only greet you.
- Use real, well-known places, foods, and activities for ${place}. If you are not confident a specific restaurant or attraction exists, name the area/type of place instead. Never invent business names.
- Never invent property amenities, distances, or policies that are not in the facts above. If asked, say the guest should confirm with the host.
- Stay on travel/stay topics; politely redirect otherwise.
- Be concise (under 250 words). Use short bullet points for lists. Mention best season/timing or transport tips when relevant.`;

    const cloud = await callGemini({ prompt: message, system, history, maxTokens: 1200 });
    if (cloud) return { source: "Gemini AI", response: cloud };

    // ----- Offline fallback (honest, no invented facts) -----
    const m = String(message || "");
    let reply;

    if (has(m, ["itinerar", "plan", "schedule", "days?", "trip"])) {
        reply = `**A flexible 2-day outline for ${place}** (staying at ${title})

**Day 1** – Settle in, then explore the main area of ${loc || "the town"} on foot. Try a local meal for dinner.
**Day 2** – Pick one signature sight or nature spot nearby in the morning, a local market in the afternoon, and a relaxed evening.

My live AI service is unavailable right now, so I can't give specific place names. Ask your host for their top picks, or retry in a moment for a detailed plan.`;
    } else if (has(m, ["food", "eat", "restaurant", "cafe", "dinner", "lunch", "breakfast"])) {
        reply = `For food in ${place}, I'd suggest trying the **regional specialties** the area is known for, from small local eateries rather than tourist-facing places.

My live AI service is unavailable right now, so I can't name specific restaurants reliably. Your host and recent Google Maps reviews are the best sources for current picks.`;
    } else if (has(m, ["pack", "weather", "bring", "wear", "climate"])) {
        reply = `**General packing list for ${place}:**
- Comfortable walking shoes
- Clothing suited to the season (check the forecast a few days before travel)
- Power bank, charger/adapter, ID documents
- Sunscreen, water bottle, basic medicines

Retry shortly for climate-specific advice.`;
    } else if (has(m, ["attraction", "visit", "sight", "see", "things to do", "activit"])) {
        reply = `I can't fetch verified attractions for ${place} right now because the live AI service is unreachable. Please retry in a moment, or ask the host for nearby recommendations.`;
    } else if (has(m, ["hi", "hello", "hey", "help"]) && m.trim().split(/\s+/).length <= 4) {
        reply = `👋 Hi! I'm WanderAI, your concierge for **${title}** in **${place}**. Ask me for an itinerary, food ideas, packing tips, or things to do nearby.`;
    } else {
        reply = `I couldn't reach the live AI service just now, so I can't answer that reliably. Please try again in a moment. In the meantime, I can still help with a basic itinerary outline or packing tips for ${place}.`;
    }

    return { source: "WanderAI Offline", response: reply };
}

// ---------- 2. Review summarizer ----------
const POSITIVE = ["great", "good", "amazing", "excellent", "wonderful", "beautiful", "perfect", "lovely", "clean", "comfortable", "friendly", "helpful", "stunning", "recommend", "loved", "love", "best", "cozy", "peaceful", "spacious", "awesome", "superb"];
const NEGATIVE = ["bad", "poor", "dirty", "noisy", "noise", "loud", "rude", "broken", "smell", "smelly", "uncomfortable", "terrible", "worst", "disappointed", "disappointing", "overpriced", "small", "cold", "unhelpful", "late", "cramped", "bugs", "insects"];

const TOPICS = {
    cleanliness: ["clean", "tidy", "spotless", "dirty", "smell", "dust"],
    "views & scenery": ["view", "scenery", "beach", "mountain", "sunset", "lake"],
    "host & service": ["host", "helpful", "friendly", "responsive", "rude", "unhelpful"],
    location: ["location", "close", "nearby", "walking distance", "far", "remote"],
    "noise level": ["noise", "noisy", "loud", "quiet", "peaceful"],
    "comfort & space": ["comfortable", "cozy", "spacious", "bed", "cramped", "small", "uncomfortable"],
    "value for money": ["value", "price", "worth", "overpriced", "cheap"],
    parking: ["parking"]
};

function scoreComment(text) {
    const t = (text || "").toLowerCase();
    let pos = 0, neg = 0;
    POSITIVE.forEach(w => { const re = new RegExp(`\\b(not |no |never )?${w}\\b`, "g"); for (const x of t.matchAll(re)) x[1] ? neg++ : pos++; });
    NEGATIVE.forEach(w => { const re = new RegExp(`\\b(not |no |never )?${w}\\b`, "g"); for (const x of t.matchAll(re)) x[1] ? pos++ : neg++; });
    return { pos, neg };
}

function heuristicSummary(listingTitle, reviews) {
    const rated = reviews.filter(r => Number(r.rating) > 0);
    const avg = rated.length ? rated.reduce((a, r) => a + Number(r.rating), 0) / rated.length : null;

    let posTotal = 0, negTotal = 0;
    const topicStats = {};

    reviews.forEach(r => {
        const text = (r.comment || "").toLowerCase();
        const { pos, neg } = scoreComment(text);
        posTotal += pos; negTotal += neg;
        const polarity = pos - neg + (Number(r.rating) >= 4 ? 1 : Number(r.rating) && Number(r.rating) <= 2 ? -1 : 0);
        for (const [topic, kws] of Object.entries(TOPICS)) {
            if (kws.some(k => new RegExp(`\\b${k}`).test(text))) {
                topicStats[topic] = topicStats[topic] || { pos: 0, neg: 0 };
                polarity >= 0 ? topicStats[topic].pos++ : topicStats[topic].neg++;
            }
        }
    });

    const lexScore = posTotal + negTotal ? posTotal / (posTotal + negTotal) : null;
    const ratingScore = avg !== null ? avg / 5 : null;
    const parts = [ratingScore, lexScore].filter(v => v !== null);
    const sentimentScore = parts.length ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100) : 50;

    const pros = Object.entries(topicStats).filter(([, s]) => s.pos > s.neg).sort((a, b) => b[1].pos - a[1].pos).map(([t, s]) => `Guests praise ${t} (${s.pos} mention${s.pos > 1 ? "s" : ""})`);
    const cons = Object.entries(topicStats).filter(([, s]) => s.neg > 0).sort((a, b) => b[1].neg - a[1].neg).map(([t, s]) => `Some guests had issues with ${t} (${s.neg} mention${s.neg > 1 ? "s" : ""})`);

    const label = sentimentScore >= 80 ? "Very Positive" : sentimentScore >= 60 ? "Mostly Positive" : sentimentScore >= 40 ? "Mixed" : "Negative";
    const n = reviews.length;

    return {
        sentiment: `${label} (${sentimentScore}%${avg !== null ? `, ${avg.toFixed(1)}★ avg` : ""})`,
        sentimentScore,
        summary: `Across ${n} review${n > 1 ? "s" : ""}, guest feedback for "${listingTitle}" is ${label.toLowerCase()}.` +
            (pros[0] ? ` The most common positive theme is ${pros[0].replace("Guests praise ", "")}.` : "") +
            (cons[0] ? ` The main concern raised is ${cons[0].replace("Some guests had issues with ", "")}.` : ""),
        pros: pros.slice(0, 3).length ? pros.slice(0, 3) : ["No clear positive theme yet"],
        cons: cons.slice(0, 2).length ? cons.slice(0, 2) : ["No recurring complaints in the available reviews"]
    };
}

async function summarizeReviews(listingTitle, reviews = []) {
    const valid = (reviews || []).filter(r => r && (r.comment || "").trim());
    if (valid.length === 0) {
        return {
            sentiment: "No reviews yet",
            sentimentScore: 0,
            summary: "This property has no written reviews yet.",
            pros: [],
            cons: []
        };
    }

    const reviewsText = valid.slice(0, 40).map((r, i) => `Review ${i + 1} (${r.rating ? r.rating + "/5" : "no rating"}): ${String(r.comment).slice(0, 500)}`).join("\n");

    const prompt = `Analyze these guest reviews for "${listingTitle}".

Reviews:
${reviewsText}

Return JSON with exactly these keys:
{
  "sentiment": "short label with percent, e.g. \\"Mostly Positive (82%)\\"",
  "sentimentScore": <integer 0-100 reflecting the actual reviews, not inflated>,
  "summary": "2 sentences summarizing the real consensus, including any complaints",
  "pros": ["up to 3 strengths that appear in the reviews"],
  "cons": ["up to 2 genuine concerns from the reviews; empty array if none"]
}
Base everything ONLY on the reviews above. Do not invent details.`;

    const raw = await callGemini({
        prompt,
        system: "You are a precise hospitality review analyst. Output JSON only.",
        json: true,
        temperature: 0.2,
        maxTokens: 1000
    });

    const parsed = parseJson(raw);
    if (parsed && typeof parsed.summary === "string" && Array.isArray(parsed.pros)) {
        return {
            sentiment: String(parsed.sentiment || ""),
            sentimentScore: Math.max(0, Math.min(100, Math.round(Number(parsed.sentimentScore) || 0))),
            summary: parsed.summary,
            pros: parsed.pros.slice(0, 3),
            cons: Array.isArray(parsed.cons) ? parsed.cons.slice(0, 2) : []
        };
    }

    return heuristicSummary(listingTitle, valid);
}

// ---------- 3. Listing description generator ----------
async function generateListingDescription(data = {}) {
    const {
        title = "",
        location = "",
        country = "",
        propertyType = "Property",
        vibes = "cozy and modern",
        amenities = [],      // e.g. ["Wi-Fi", "Pool"]  (optional but improves accuracy)
        maxGuests = null,
        bedrooms = null
    } = data;

    const place = [location, country].filter(Boolean).join(", ") || "a great destination";
    const amenityList = Array.isArray(amenities) ? amenities.filter(Boolean) : String(amenities || "").split(",").map(s => s.trim()).filter(Boolean);

    const facts = [
        `Working title: ${title || "(none)"}`,
        `Location: ${place}`,
        `Property type: ${propertyType}`,
        `Desired vibe: ${vibes}`,
        amenityList.length ? `Confirmed amenities: ${amenityList.join(", ")}` : "Confirmed amenities: none provided",
        maxGuests ? `Max guests: ${maxGuests}` : "",
        bedrooms ? `Bedrooms: ${bedrooms}` : ""
    ].filter(Boolean).join("\n");

    const prompt = `Write listing copy for a vacation rental.

${facts}

Return JSON:
{
  "title": "catchy title under 60 characters",
  "description": "2 short paragraphs (max ~150 words total): the stay experience, then the location",
  "highlights": ["3 short highlights"]
}

Rules: mention ONLY the amenities listed above. Do not invent Wi-Fi, pools, views, distances, or nearby business names. Describe the area only with well-known, general characteristics of ${place}. Warm, specific, no clichés or emojis.`;

    const raw = await callGemini({
        prompt,
        system: "You are an expert vacation-rental copywriter. Output JSON only.",
        json: true,
        temperature: 0.7,
        maxTokens: 1000
    });

    const parsed = parseJson(raw);
    if (parsed && parsed.title && parsed.description && Array.isArray(parsed.highlights)) {
        return { title: parsed.title, description: parsed.description, highlights: parsed.highlights.slice(0, 3) };
    }

    // Fallback: only uses provided data
    const cleanTitle = title.trim() || `${propertyType} in ${location || "a Great Location"}`;
    const amenityLine = amenityList.length ? ` Guests can enjoy ${amenityList.slice(0, 6).join(", ")}.` : "";
    const sizeLine = [bedrooms ? `${bedrooms} bedroom${bedrooms > 1 ? "s" : ""}` : "", maxGuests ? `up to ${maxGuests} guests` : ""].filter(Boolean).join(", ");

    return {
        title: cleanTitle,
        description: `Welcome to this ${vibes} ${propertyType.toLowerCase()} in ${place}${sizeLine ? `, with space for ${sizeLine}` : ""}.${amenityLine}\n\nIt's a comfortable base for exploring ${location || "the area"}. Contact the host for details about the neighbourhood and nearby recommendations.`,
        highlights: [
            `Located in ${place}`,
            `${vibes.charAt(0).toUpperCase() + vibes.slice(1)} atmosphere`,
            amenityList.length ? amenityList.slice(0, 3).join(" • ") : "Comfortable stay for your trip"
        ]
    };
}

module.exports = { chatWithConcierge, summarizeReviews, generateListingDescription };
