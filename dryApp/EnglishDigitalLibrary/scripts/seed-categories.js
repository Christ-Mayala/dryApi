const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const mongoose = require('mongoose');
const { connectCluster } = require('../../../dry/config/connection/dbConnection');
const getModel = require('../../../dry/core/factories/modelFactory');
const CategorySchema = require('../features/categories/model/category.schema');
const slugify = require('slugify');

// Classification de départ du cahier des charges; l'upsert permet de relancer le seed sans doublons.
const taxonomy = {
  'English Language Learning': {
    Grammar: ['Basic Grammar', 'Intermediate Grammar', 'Advanced Grammar', 'Parts of Speech', 'Sentence Structure', 'Tenses and Verb Forms', 'Punctuation', 'Common Grammar Mistakes'],
    Vocabulary: ['Basic Vocabulary', 'Intermediate Vocabulary', 'Advanced Vocabulary', 'Academic Vocabulary', 'Business Vocabulary', 'Idioms and Expressions', 'Phrasal Verbs', 'Collocations'],
    Writing: ['Essay Writing', 'Academic Writing', 'Creative Writing', 'Business Writing', 'Paragraph Writing', 'Letter and Email Writing'],
    'Reading Comprehension': ['Beginner Reading', 'Intermediate Reading', 'Advanced Reading', 'Academic Reading'],
    'Listening Comprehension': [],
    'Speaking and Pronunciation': ['American English Pronunciation', 'British English Pronunciation', 'Conversation Skills', 'Public Speaking'],
    Spelling: [], 'English for Beginners': [], 'English for Intermediate Learners': [], 'English for Advanced Learners': [],
    'English for Exams': ['IELTS Preparation', 'TOEFL Preparation', 'Cambridge English Exams', 'General English Tests'],
  },
  Literature: {
    Fiction: ['Romance', 'Gothic Fiction', 'Science Fiction', 'Mystery and Detective Fiction', 'Fantasy', 'Historical Fiction'], 'Non-Fiction': [], Novels: [], 'Short Stories': [], Poetry: [], 'Drama and Plays': [],
    'Classic Literature': [], 'Contemporary Literature': [], "Children's Literature": [],
    'Biographies and Autobiographies': [], Essays: [],
  },
  'Science and Technology': {
    Mathematics: ['Arithmetic', 'Algebra', 'Geometry', 'Statistics', 'Calculus'], Physics: [], Chemistry: [], Biology: [],
    'Computer Science': [], 'Web Development': ['HTML and CSS', 'JavaScript', 'React', 'Backend Development', 'Full Stack Development'],
    'Software Engineering': [], 'Artificial Intelligence': [], 'Machine Learning': [], Cybersecurity: [],
    'Computer Networks': [], Databases: [], 'Data Science': [], 'Cloud Computing': [],
  },
  'Business and Economics': {
    Entrepreneurship: [], 'Business Management': [], Marketing: [], 'Digital Marketing': [], Accounting: [], Economics: [],
    Finance: [], Leadership: [], 'Business Communication': [], 'Human Resources': [], 'Project Management': [], 'Business Strategy': [],
  },
  'Personal Development': {
    Productivity: [], Psychology: [], 'Communication Skills': [], 'Critical Thinking': [], 'Memory and Learning': [],
    'Self-Improvement': [], 'Time Management': [], 'Decision Making': [], 'Emotional Intelligence': [], 'Career Development': [],
  },
  'History and Geography': {
    'World History': [], 'African History': [], 'American History': [], 'European History': [], Geography: [],
    'Cultural Studies': [], 'Ancient Civilizations': [], 'Modern History': [],
  },
  'Law and Philosophy': {
    Philosophy: [], Ethics: [], 'Political Philosophy': [], 'Logic and Reasoning': [], 'International Law': [],
    'Business Law': [], 'Constitutional Law': [], 'Legal Studies': [],
  },
  'Health and Life Sciences': {
    Anatomy: [], 'Public Health': [], Nutrition: [], Nursing: [], 'General Biology': [], 'Medical Education': [], 'Health and Wellness': [],
  },
  'Education and Research': {
    'Teaching Methods': [], 'Educational Psychology': [], 'Study Skills': [], 'Academic Research': [],
    'Research Methodology': [], 'Scientific Writing': [], 'Learning Strategies': [],
  },
};

function slugPart(value) { return slugify(value, { lower: true, strict: true, trim: true }); }

const rootDescriptions = {
  'English Language Learning': 'Build practical English skills with grammar, vocabulary, reading, writing and exam preparation.',
  Literature: 'Explore enduring novels, poetry, plays and short stories from English-language literature.',
  'Science and Technology': 'Learn the ideas and tools shaping science, engineering, computing and the digital world.',
  'Business and Economics': 'Develop business, finance, leadership and economic knowledge for work and study.',
  'Personal Development': 'Books on communication, productivity, learning and thoughtful personal growth.',
  'History and Geography': 'Discover people, places and events that have shaped societies around the world.',
  'Law and Philosophy': 'Explore legal ideas, ethics, logic and the questions behind public life.',
  'Health and Life Sciences': 'Accessible reading across health, biology, nutrition and life sciences.',
  'Education and Research': 'Resources for teaching, study skills, research methods and academic writing.',
};

async function upsertCategory(Category, name, parentId, parentSlug, order, description = '') {
  const slug = [parentSlug, slugPart(name)].filter(Boolean).join('-');
  return Category.findOneAndUpdate(
    { slug },
    { $setOnInsert: { name, slug, parentId, order, status: 'active', description } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
}

async function main() {
  await connectCluster();
  const Category = getModel('EnglishDigitalLibrary', 'Category', CategorySchema);
  let created = 0;
  for (const [rootName, children] of Object.entries(taxonomy)) {
    const root = await upsertCategory(Category, rootName, null, '', created++, rootDescriptions[rootName] || '');
    let order = 0;
    for (const [childName, subcategories] of Object.entries(children)) {
      const child = await upsertCategory(Category, childName, root._id, root.slug, order++);
      let subOrder = 0;
      for (const subcategory of subcategories) await upsertCategory(Category, subcategory, child._id, child.slug, subOrder++);
    }
  }
  console.log('English Digital Library categories are ready.');
}

main().then(() => mongoose.disconnect()).catch(async error => { console.error('Category seed failed:', error.message); await mongoose.disconnect(); process.exitCode = 1; });
