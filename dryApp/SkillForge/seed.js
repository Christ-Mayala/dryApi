const path = require('path');

module.exports = async ({ appName, getModel, logSeed }) => {
  let count = 0;
  // courses
  const coursesSchema = require('./features/courses/model/courses.schema');
  const Courses = getModel(appName, 'Courses', coursesSchema);
  const coursesDocs = [
  {
    title: 'exemple_title_' + index,
    subtitle: 'exemple_subtitle_' + index,
    price: 'exemple_price_' + index,
    duration: 'exemple_duration_' + index,
    level: 'exemple_level_' + index,
    categoryId: 'exemple_categoryId_' + index,
    trailerUrl: 'exemple_trailerUrl_' + index,
    contentUrl: 'exemple_contentUrl_' + index,
    isPublished: 'exemple_isPublished_' + index,
    label: `Exemple courses ${index}`
  },
  {
    title: 'exemple_title_' + index,
    subtitle: 'exemple_subtitle_' + index,
    price: 'exemple_price_' + index,
    duration: 'exemple_duration_' + index,
    level: 'exemple_level_' + index,
    categoryId: 'exemple_categoryId_' + index,
    trailerUrl: 'exemple_trailerUrl_' + index,
    contentUrl: 'exemple_contentUrl_' + index,
    isPublished: 'exemple_isPublished_' + index,
    label: `Exemple courses ${index}`
  },
  {
    title: 'exemple_title_' + index,
    subtitle: 'exemple_subtitle_' + index,
    price: 'exemple_price_' + index,
    duration: 'exemple_duration_' + index,
    level: 'exemple_level_' + index,
    categoryId: 'exemple_categoryId_' + index,
    trailerUrl: 'exemple_trailerUrl_' + index,
    contentUrl: 'exemple_contentUrl_' + index,
    isPublished: 'exemple_isPublished_' + index,
    label: `Exemple courses ${index}`
  }
  ];
  const coursesCreated = await Courses.insertMany(coursesDocs);
  count += coursesCreated.length;
  await logSeed({
    appName,
    feature: 'courses',
    modelName: 'Courses',
    schemaPath: path.join(__dirname, 'features', 'courses', 'model', 'courses.schema.js'),
    ids: coursesCreated.map((d) => d._id),
  });

  // ebooks
  const ebooksSchema = require('./features/ebooks/model/ebooks.schema');
  const Ebooks = getModel(appName, 'Ebooks', ebooksSchema);
  const ebooksDocs = [
  {
    title: 'exemple_title_' + index,
    author: 'exemple_author_' + index,
    price: 'exemple_price_' + index,
    summary: 'exemple_summary_' + index,
    pages: 'exemple_pages_' + index,
    format: 'exemple_format_' + index,
    coverUrl: 'exemple_coverUrl_' + index,
    fileUrl: 'exemple_fileUrl_' + index,
    label: `Exemple ebooks ${index}`
  },
  {
    title: 'exemple_title_' + index,
    author: 'exemple_author_' + index,
    price: 'exemple_price_' + index,
    summary: 'exemple_summary_' + index,
    pages: 'exemple_pages_' + index,
    format: 'exemple_format_' + index,
    coverUrl: 'exemple_coverUrl_' + index,
    fileUrl: 'exemple_fileUrl_' + index,
    label: `Exemple ebooks ${index}`
  },
  {
    title: 'exemple_title_' + index,
    author: 'exemple_author_' + index,
    price: 'exemple_price_' + index,
    summary: 'exemple_summary_' + index,
    pages: 'exemple_pages_' + index,
    format: 'exemple_format_' + index,
    coverUrl: 'exemple_coverUrl_' + index,
    fileUrl: 'exemple_fileUrl_' + index,
    label: `Exemple ebooks ${index}`
  }
  ];
  const ebooksCreated = await Ebooks.insertMany(ebooksDocs);
  count += ebooksCreated.length;
  await logSeed({
    appName,
    feature: 'ebooks',
    modelName: 'Ebooks',
    schemaPath: path.join(__dirname, 'features', 'ebooks', 'model', 'ebooks.schema.js'),
    ids: ebooksCreated.map((d) => d._id),
  });

  // categories
  const categoriesSchema = require('./features/categories/model/categories.schema');
  const Categories = getModel(appName, 'Categories', categoriesSchema);
  const categoriesDocs = [
  {
    name: 'exemple_name_' + index,
    description: 'exemple_description_' + index,
    slug: 'exemple_slug_' + index,
    icon: 'exemple_icon_' + index,
    parentId: 'exemple_parentId_' + index,
    label: `Exemple categories ${index}`
  },
  {
    name: 'exemple_name_' + index,
    description: 'exemple_description_' + index,
    slug: 'exemple_slug_' + index,
    icon: 'exemple_icon_' + index,
    parentId: 'exemple_parentId_' + index,
    label: `Exemple categories ${index}`
  },
  {
    name: 'exemple_name_' + index,
    description: 'exemple_description_' + index,
    slug: 'exemple_slug_' + index,
    icon: 'exemple_icon_' + index,
    parentId: 'exemple_parentId_' + index,
    label: `Exemple categories ${index}`
  }
  ];
  const categoriesCreated = await Categories.insertMany(categoriesDocs);
  count += categoriesCreated.length;
  await logSeed({
    appName,
    feature: 'categories',
    modelName: 'Categories',
    schemaPath: path.join(__dirname, 'features', 'categories', 'model', 'categories.schema.js'),
    ids: categoriesCreated.map((d) => d._id),
  });

  // orders
  const ordersSchema = require('./features/orders/model/orders.schema');
  const Orders = getModel(appName, 'Orders', ordersSchema);
  const ordersDocs = [
  {
    studentId: 'exemple_studentId_' + index,
    items: 'exemple_items_' + index,
    subtotal: 'exemple_subtotal_' + index,
    tax: 'exemple_tax_' + index,
    total: 'exemple_total_' + index,
    status: 'exemple_status_' + index,
    paymentMethod: 'exemple_paymentMethod_' + index,
    transactionId: 'exemple_transactionId_' + index,
    label: `Exemple orders ${index}`
  },
  {
    studentId: 'exemple_studentId_' + index,
    items: 'exemple_items_' + index,
    subtotal: 'exemple_subtotal_' + index,
    tax: 'exemple_tax_' + index,
    total: 'exemple_total_' + index,
    status: 'exemple_status_' + index,
    paymentMethod: 'exemple_paymentMethod_' + index,
    transactionId: 'exemple_transactionId_' + index,
    label: `Exemple orders ${index}`
  },
  {
    studentId: 'exemple_studentId_' + index,
    items: 'exemple_items_' + index,
    subtotal: 'exemple_subtotal_' + index,
    tax: 'exemple_tax_' + index,
    total: 'exemple_total_' + index,
    status: 'exemple_status_' + index,
    paymentMethod: 'exemple_paymentMethod_' + index,
    transactionId: 'exemple_transactionId_' + index,
    label: `Exemple orders ${index}`
  }
  ];
  const ordersCreated = await Orders.insertMany(ordersDocs);
  count += ordersCreated.length;
  await logSeed({
    appName,
    feature: 'orders',
    modelName: 'Orders',
    schemaPath: path.join(__dirname, 'features', 'orders', 'model', 'orders.schema.js'),
    ids: ordersCreated.map((d) => d._id),
  });

  // students
  const studentsSchema = require('./features/students/model/students.schema');
  const Students = getModel(appName, 'Students', studentsSchema);
  const studentsDocs = [
  {
    fullName: 'exemple_fullName_' + index,
    email: `demo+${Date.now()}@example.com`,
    phone: 'exemple_phone_' + index,
    preferences: 'exemple_preferences_' + index,
    balance: 'exemple_balance_' + index,
    enrolledCourses: 'exemple_enrolledCourses_' + index,
    label: `Exemple students ${index}`
  },
  {
    fullName: 'exemple_fullName_' + index,
    email: `demo+${Date.now()}@example.com`,
    phone: 'exemple_phone_' + index,
    preferences: 'exemple_preferences_' + index,
    balance: 'exemple_balance_' + index,
    enrolledCourses: 'exemple_enrolledCourses_' + index,
    label: `Exemple students ${index}`
  },
  {
    fullName: 'exemple_fullName_' + index,
    email: `demo+${Date.now()}@example.com`,
    phone: 'exemple_phone_' + index,
    preferences: 'exemple_preferences_' + index,
    balance: 'exemple_balance_' + index,
    enrolledCourses: 'exemple_enrolledCourses_' + index,
    label: `Exemple students ${index}`
  }
  ];
  const studentsCreated = await Students.insertMany(studentsDocs);
  count += studentsCreated.length;
  await logSeed({
    appName,
    feature: 'students',
    modelName: 'Students',
    schemaPath: path.join(__dirname, 'features', 'students', 'model', 'students.schema.js'),
    ids: studentsCreated.map((d) => d._id),
  });

  // reviews
  const reviewsSchema = require('./features/reviews/model/reviews.schema');
  const Reviews = getModel(appName, 'Reviews', reviewsSchema);
  const reviewsDocs = [
  {
    courseId: 'exemple_courseId_' + index,
    studentId: 'exemple_studentId_' + index,
    rating: 'exemple_rating_' + index,
    comment: 'exemple_comment_' + index,
    isApproved: 'exemple_isApproved_' + index,
    label: `Exemple reviews ${index}`
  },
  {
    courseId: 'exemple_courseId_' + index,
    studentId: 'exemple_studentId_' + index,
    rating: 'exemple_rating_' + index,
    comment: 'exemple_comment_' + index,
    isApproved: 'exemple_isApproved_' + index,
    label: `Exemple reviews ${index}`
  },
  {
    courseId: 'exemple_courseId_' + index,
    studentId: 'exemple_studentId_' + index,
    rating: 'exemple_rating_' + index,
    comment: 'exemple_comment_' + index,
    isApproved: 'exemple_isApproved_' + index,
    label: `Exemple reviews ${index}`
  }
  ];
  const reviewsCreated = await Reviews.insertMany(reviewsDocs);
  count += reviewsCreated.length;
  await logSeed({
    appName,
    feature: 'reviews',
    modelName: 'Reviews',
    schemaPath: path.join(__dirname, 'features', 'reviews', 'model', 'reviews.schema.js'),
    ids: reviewsCreated.map((d) => d._id),
  });

  return { count };
};
