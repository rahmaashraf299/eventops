
import Joi from "joi";

const eventQueryValidation = Joi.object({
  search: Joi.string().trim().allow(""),
  venue: Joi.string().trim().allow(""),
  minPrice: Joi.number().min(0),
  maxPrice: Joi.number().min(0),
  startsAfter: Joi.date().iso(),
  startsBefore: Joi.date().iso(),
  sort: Joi.string().valid("price", "-price", "-startsAt"),
}).unknown(false);

export const validateEventQuery = (req, res, next) => {
  const { error, value } = eventQueryValidation.validate(req.query, {
    abortEarly: false,
    convert: true,
  });

  if (error) {
    return res.status(400).json({
      success: false,
      message: "Invalid event query parameters",
      errors: error.details.map((detail) => detail.message),
    });
  }

  if (
    value.minPrice !== undefined &&
    value.maxPrice !== undefined &&
    value.minPrice > value.maxPrice
  ) {
    return res.status(400).json({
      success: false,
      message: "Minimum price cannot be greater than maximum price",
    });
  }

  if (
    value.startsAfter &&
    value.startsBefore &&
    value.startsAfter > value.startsBefore
  ) {
    return res.status(400).json({
      success: false,
      message: "Start date range is invalid",
    });
  }

  req.validatedQuery = value;
  next();
};

