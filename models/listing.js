const  mongoose  = require("mongoose");
const Review= require("./review.js")
// const listingSchema = new mongoose.Schema({
//   title: {
//     type: String,
    
//   },
//   description: String,

//   image: {
//     filename: String,
//     url: String
//   },

//   price: Number,
//   location: String,
//   country: String,
// },

// );
// const Listing = mongoose.model("Listing", listingSchema);
// module.exports=Listing;



const listingSchema = new mongoose.Schema({
    title: String,
    description: String,
    price: Number,
    location: String,
    country: String,
    image: {
        url: String,
        filename: String
    },
    reviews: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Review' }],
        default: []
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    }
});
listingSchema.post("findOneAndDelete", async(listing)=>{
    if(listing){
        await Review.deleteMany({_id: {$in: listing.reviews}});
    }
})


module.exports = mongoose.model('Listing', listingSchema);
 

