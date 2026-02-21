const Joi = require('joi');
const { commonSchemas } = require('../../../dry/utils/validation/validation.util');

const skillForgeSchemas = {
  Courses: {
    create: Joi.object({
      title: Joi.string().required(),
      subtitle: Joi.string().required(),
      price: Joi.number().required(),
      duration: Joi.number().required(),
      level: Joi.string().required(),
      categoryId: Joi.string().required(),
      trailerUrl: Joi.string().required(),
      contentUrl: Joi.string().required(),
      isPublished: Joi.boolean().required(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    }),
    update: Joi.object({
      title: Joi.string().optional(),
      subtitle: Joi.string().optional(),
      price: Joi.number().optional(),
      duration: Joi.number().optional(),
      level: Joi.string().optional(),
      categoryId: Joi.string().optional(),
      trailerUrl: Joi.string().optional(),
      contentUrl: Joi.string().optional(),
      isPublished: Joi.boolean().optional(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    })
  },
  Ebooks: {
    create: Joi.object({
      title: Joi.string().required(),
      author: Joi.string().required(),
      price: Joi.number().required(),
      summary: Joi.string().required(),
      pages: Joi.number().required(),
      format: Joi.string().required(),
      coverUrl: Joi.string().required(),
      fileUrl: Joi.string().required(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    }),
    update: Joi.object({
      title: Joi.string().optional(),
      author: Joi.string().optional(),
      price: Joi.number().optional(),
      summary: Joi.string().optional(),
      pages: Joi.number().optional(),
      format: Joi.string().optional(),
      coverUrl: Joi.string().optional(),
      fileUrl: Joi.string().optional(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    })
  },
  Categories: {
    create: Joi.object({
      name: Joi.string().required(),
      description: Joi.string().required(),
      slug: Joi.string().required(),
      icon: Joi.string().required(),
      parentId: Joi.string().required(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    }),
    update: Joi.object({
      name: Joi.string().optional(),
      description: Joi.string().optional(),
      slug: Joi.string().optional(),
      icon: Joi.string().optional(),
      parentId: Joi.string().optional(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    })
  },
  Orders: {
    create: Joi.object({
      studentId: Joi.string().required(),
      items: Joi.array().required(),
      subtotal: Joi.number().required(),
      tax: Joi.number().required(),
      total: Joi.number().required(),
      status: Joi.string().required(),
      paymentMethod: Joi.string().required(),
      transactionId: Joi.string().required(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    }),
    update: Joi.object({
      studentId: Joi.string().optional(),
      items: Joi.array().optional(),
      subtotal: Joi.number().optional(),
      tax: Joi.number().optional(),
      total: Joi.number().optional(),
      status: Joi.string().optional(),
      paymentMethod: Joi.string().optional(),
      transactionId: Joi.string().optional(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    })
  },
  Students: {
    create: Joi.object({
      fullName: Joi.string().required(),
      email: commonSchemas.email.required(),
      phone: Joi.string().required(),
      preferences: Joi.array().required(),
      balance: Joi.number().required(),
      enrolledCourses: Joi.array().required(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    }),
    update: Joi.object({
      fullName: Joi.string().optional(),
      email: commonSchemas.email.optional(),
      phone: Joi.string().optional(),
      preferences: Joi.array().optional(),
      balance: Joi.number().optional(),
      enrolledCourses: Joi.array().optional(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    })
  },
  Reviews: {
    create: Joi.object({
      courseId: Joi.string().required(),
      studentId: Joi.string().required(),
      rating: Joi.number().required(),
      comment: Joi.string().required(),
      isApproved: Joi.boolean().required(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    }),
    update: Joi.object({
      courseId: Joi.string().optional(),
      studentId: Joi.string().optional(),
      rating: Joi.number().optional(),
      comment: Joi.string().optional(),
      isApproved: Joi.boolean().optional(),
      label: Joi.string().min(2).max(200).optional(),
      status: commonSchemas.status.optional()
    })
  },
};

module.exports = { skillForgeSchemas };
