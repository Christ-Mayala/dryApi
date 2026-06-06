const { Student } = require('../models/student.model');
const { validateStudent } = require('../validators/student.validator');
const { cacheMiddleware } = require('../../../dry/middlewares/cache.middleware');
const { auditMiddleware } = require('../../../dry/middlewares/audit.middleware');

const studentsController = {
  // GET /api/v1/skillforge/students
  getAllStudents: [
    cacheMiddleware('students'),
    async (req, res, next) => {
      try {
        const students = await Student.find();
        res.json(students);
      } catch (error) {
        next(error);
      }
    }
  ],

  // GET /api/v1/skillforge/students/:id
  getStudentById: [
    cacheMiddleware('student'),
    async (req, res, next) => {
      try {
        const student = await Student.findById(req.params.id);
        if (!student) {
          return res.status(404).json({ message: 'Student not found' });
        }
        res.json(student);
      } catch (error) {
        next(error);
      }
    }
  ],

  // POST /api/v1/skillforge/students
  createStudent: [
    validateStudent,
    auditMiddleware('create'),
    async (req, res, next) => {
      try {
        const student = new Student(req.body);
        await student.save();
        res.status(201).json(student);
      } catch (error) {
        next(error);
      }
    }
  ],

  // PUT /api/v1/skillforge/students/:id
  updateStudent: [
    validateStudent,
    auditMiddleware('update'),
    async (req, res, next) => {
      try {
        const student = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!student) {
          return res.status(404).json({ message: 'Student not found' });
        }
        res.json(student);
      } catch (error) {
        next(error);
      }
    }
  ],

  // DELETE /api/v1/skillforge/students/:id
  deleteStudent: [
    auditMiddleware('delete'),
    async (req, res, next) => {
      try {
        const student = await Student.findByIdAndDelete(req.params.id);
        if (!student) {
          return res.status(404).json({ message: 'Student not found' });
        }
        res.json({ message: 'Student deleted successfully' });
      } catch (error) {
        next(error);
      }
    }
  ]
};

module.exports = studentsController;