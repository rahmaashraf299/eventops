import Joi from 'joi';

export const createApplicationSchema = Joi.object({
    organizationName: Joi.string().trim().min(2).max(100).required().messages({
        'string.empty': 'Organization name cannot be empty',
        'string.min': 'Organization name must be at least 2 characters',
        'string.max': 'Organization name cannot exceed 100 characters',
        'any.required': 'Organization name is required'
    })
});

export const reviewApplicationSchema = Joi.object({
    status: Joi.string().valid('approved', 'rejected').required().messages({
        'any.only': 'Status must be either approved or rejected',
        'any.required': 'Status is required'
    }),
    reviewNotes: Joi.string().trim().max(500).allow('', null).messages({
        'string.max': 'Review notes cannot exceed 500 characters'
    })
});
