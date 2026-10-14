import { createApplicationSchema } from '../modules/organizerApplication/organizerApplication.validation.js';

export const validateCreateApplication = (req, res, next) => {
    const { error } = createApplicationSchema.validate(req.body, { abortEarly: false, stripUnknown: true });

    if (error) {
        const errors = error.details.map((detail) => ({
            field: detail.path.join('.'),
            message: detail.message.replace(/['"]/g, '')
        }));

        return res.status(400).json({
            success: false,
            message: 'Validation error: invalid application data',
            errors
        });
    }

    next();
};

export default validateCreateApplication;
