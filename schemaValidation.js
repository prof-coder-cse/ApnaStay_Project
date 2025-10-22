const Joi = require('joi');

 module.exports.listingSchema = Joi.object({
    title: Joi.string().min(2).max(100).required(),
    description: Joi.string().min(10).max(500).required(),
    image:Joi.string(),
    price: Joi.number().required(),
    location: Joi.string().required(),
    country: Joi.string().required(),
});

module.exports.reviewSchema=Joi.object({
    review: Joi.object({
        rating:Joi.number().min(1).max(5).required(),
        comment: Joi.string().min(5).required(),
    }).required()
})