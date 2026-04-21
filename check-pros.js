require('dotenv').config();
const mongoose = require('mongoose');
const { connectCluster, getTenantDB } = require('./dry/config/connection/dbConnection');

const run = async () => {
  console.log('Script started...');
  try {
    console.log('Connecting to DB...');
    await connectCluster();
    console.log('DB connected.');
    const db = getTenantDB('LaStreet');
    const pros = await db.collection('professionals').find({}).toArray();
    console.log(`Total pros: ${pros.length}`);
    for (const p of pros) {
      console.log(`- ${p.name}: status=${p.approvalStatus}, tradeId=${p.tradeId}`);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
