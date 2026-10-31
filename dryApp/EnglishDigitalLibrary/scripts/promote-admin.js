const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const mongoose = require('mongoose');
const { connectCluster } = require('../../../dry/config/connection/dbConnection');
const getModel = require('../../../dry/core/factories/modelFactory');

async function main() {
  const email = (process.env.LIBRARY_ADMIN_EMAIL || process.argv[2] || '').trim().toLowerCase();
  if (!email) throw new Error('Set LIBRARY_ADMIN_EMAIL or pass the registered account email as an argument.');
  await connectCluster();
  const User = getModel('EnglishDigitalLibrary', 'User');
  const user = await User.findOneAndUpdate({ email }, { $set: { role: 'admin' } }, { new: true, runValidators: true }).select('name email role');
  if (!user) throw new Error('No library account with that email was found. Register it through the website first.');
  console.log(`Administrator role assigned to ${user.email}.`);
}

main().then(() => mongoose.disconnect()).catch(async error => { console.error('Admin promotion failed:', error.message); await mongoose.disconnect(); process.exitCode = 1; });
