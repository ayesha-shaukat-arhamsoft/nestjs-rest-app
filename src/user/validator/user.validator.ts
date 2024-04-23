import * as Joi from 'joi';

export const createUserSchema = Joi.object({
  first_name: Joi.string().optional(),
  last_name: Joi.string().optional(),
  avatar: Joi.string().optional(),
  email: Joi.string().email().required(),
});
