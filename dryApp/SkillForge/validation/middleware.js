const { validate } = require('../../../dry/utils/validation/validation.util');
const { skillForgeSchemas } = require('./schemas');

// Mapping des champs significatifs pour generer un label si absent
const labelCandidates = {
  courses: ["label","name","nom","title","titre","subject","email","subtitle","price","duration","level","categoryId","trailerUrl","contentUrl","isPublished"],
  ebooks: ["label","name","nom","title","titre","subject","email","author","price","summary","pages","format","coverUrl","fileUrl"],
  categories: ["label","name","nom","title","titre","subject","email","description","slug","icon","parentId"],
  orders: ["label","name","nom","title","titre","subject","email","studentId","items","subtotal","tax","total","status","paymentMethod","transactionId"],
  students: ["label","name","nom","title","titre","subject","email","fullName","phone","preferences","balance","enrolledCourses"],
  reviews: ["label","name","nom","title","titre","subject","email","courseId","studentId","rating","comment","isApproved"],
};

const ensureLabel = (featureKey) => (req, res, next) => {
  try {
    if (req.body && !req.body.label) {
      const keys = labelCandidates[featureKey] || [];
      for (const key of keys) {
        const val = req.body[key];
        if (typeof val === 'string' && val.trim()) {
          req.body.label = val.trim();
          break;
        }
      }
    }
    next();
  } catch (e) {
    next();
  }
};

const validateSkillForge = {
  courses: {
    create: validate(skillForgeSchemas.Courses.create),
    update: validate(skillForgeSchemas.Courses.update)
  },
  ebooks: {
    create: validate(skillForgeSchemas.Ebooks.create),
    update: validate(skillForgeSchemas.Ebooks.update)
  },
  categories: {
    create: validate(skillForgeSchemas.Categories.create),
    update: validate(skillForgeSchemas.Categories.update)
  },
  orders: {
    create: validate(skillForgeSchemas.Orders.create),
    update: validate(skillForgeSchemas.Orders.update)
  },
  students: {
    create: validate(skillForgeSchemas.Students.create),
    update: validate(skillForgeSchemas.Students.update)
  },
  reviews: {
    create: validate(skillForgeSchemas.Reviews.create),
    update: validate(skillForgeSchemas.Reviews.update)
  },
};

module.exports = { validateSkillForge, ensureLabel };
