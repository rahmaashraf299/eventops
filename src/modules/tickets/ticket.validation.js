import Joi from "joi";

export const checkInValidation = Joi.object({
  qrToken: Joi.string().trim().min(8).max(128).required(),
});

export const validateCheckIn = (req, res, next) => {
  const { error, value } = checkInValidation.validate(req.body, {
    abortEarly: false,
    convert: true,
  });

  if (error) {
    return res.status(400).json({
      success: false,
      message: "Invalid check-in data",
      errors: error.details.map((detail) => detail.message),
    });
  }

  req.body = value;
  next();
};
