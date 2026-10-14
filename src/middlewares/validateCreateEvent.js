import { createEventValidation } from "../modules/event/eventValidation.js";

export const validateCreateEvent = (req, res, next) => {
  const { error, value } = createEventValidation.validate(req.body, {
    abortEarly: false,
    convert: true,
  });

  if (error) {
    return res.status(400).json({
      success: false,
      message: "Invalid event data",
      errors: error.details.map((detail) => detail.message),
    });
  }

  req.body = value;

  next();
};