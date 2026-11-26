if (process.env.NODE_ENV != "production") {
    require("dotenv").config();
}

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const MongoStore = require("connect-mongo");

// ROUTERS
const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");
const bookingRouter = require("./routes/booking.js");
const aiRouter = require("./routes/ai.js");

// DATABASE CONFIGURATION (Atlas DB or Local MongoDB fallback)
const dbUrl = process.env.ATLASDB_URL || "mongodb://127.0.0.1:27017/apnastay";
const secret = process.env.SECRET || "apnastaycollegeprojectsecretkey2026";

// VIEW ENGINE
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// BODY PARSERS & STATIC FILES
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Essential for AI JSON API requests
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

// SESSION CONFIGURATION
const sessionOptions = {
    secret: secret,
    resave: false,
    saveUninitialized: true,
    cookie: {
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true
    }
};

// Use MongoStore if Atlas DB URL is provided or if configured in production
if (process.env.ATLASDB_URL) {
    const store = MongoStore.create({
        mongoUrl: process.env.ATLASDB_URL,
        crypto: {
            secret: secret
        },
        touchAfter: 24 * 3600
    });
    store.on("error", (err) => {
        console.log("ERROR in MONGO SESSION STORE:", err);
    });
    sessionOptions.store = store;
}

app.use(session(sessionOptions));
app.use(flash());

// PASSPORT AUTHENTICATION
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// GLOBAL LOCALS FOR VIEWS
app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currentUser = req.user;
    next();
});

// ROOT ROUTE
app.get("/", (req, res) => {
    return res.redirect("/listings");
});

// MOUNT ROUTERS
app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", bookingRouter);
app.use("/api/ai", aiRouter);
app.use("/", userRouter);

// 404 CATCH-ALL (Express 5 compatible)
app.use((req, res, next) => {
    next(new ExpressError(404, "Page Not Found"));
});

// GLOBAL ERROR HANDLER
app.use((err, req, res, next) => {
    console.error("Express Error Caught:", err.message || err);
    // Delegate to default error handler if headers have already been sent to client
    if (res.headersSent) {
        return next(err);
    }
    let { status = 500, message = "Something went wrong" } = err;
    return res.status(status).render("listings/error", { message });
});

// DATABASE CONNECTION
async function main() {
    await mongoose.connect(dbUrl);
}

main()
    .then(() => console.log("Connected to MongoDB successfully!"))
    .catch((err) => {
        console.log("MongoDB connection notice:", err.message);
        console.log("If running locally, ensure mongod is started: brew services start mongodb-community");
    });

// SERVER START
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🚀 ApnaStay Server running on http://localhost:${PORT}`);
});
