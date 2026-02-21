
const { createApp } = require('./create-app-final-fixed.js');

const config = {
  name: 'SkillForge',
  features: [
    {
      name: 'courses',
      model: 'Course',
      fields: [
        'title:String',
        'description:String',
        'price:Number',
        'contentUrl:String',
        'author:String',
        'category:String',
        'level:String',
        'duration:Number',
        'thumbnail:String'
      ]
    },
    {
      name: 'ebooks',
      model: 'Ebook',
      fields: [
        'title:String',
        'description:String',
        'price:Number',
        'downloadUrl:String',
        'author:String',
        'format:String',
        'pages:Number',
        'coverImage:String'
      ]
    },
    {
      name: 'categories',
      model: 'Category',
      fields: [
        'name:String',
        'slug:String',
        'description:String',
        'icon:String'
      ]
    },
    {
      name: 'orders',
      model: 'Order',
      fields: [
        'user:String',
        'products:Array',
        'totalAmount:Number',
        'status:String',
        'paymentMethod:String',
        'transactionId:String'
      ]
    },
    {
      name: 'reviews',
      model: 'Review',
      fields: [
        'product:String',
        'user:String',
        'rating:Number',
        'comment:String'
      ]
    }
  ],
  addons: {
    payment: true,
    export: true
  },
  ultraPro: true,
  askAddons: false
};

(async () => {
  try {
    console.log('🚀 Auto-creating SkillForge app...');
    await createApp(config);
    console.log('✅ SkillForge app created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating app:', error);
    process.exit(1);
  }
})();
