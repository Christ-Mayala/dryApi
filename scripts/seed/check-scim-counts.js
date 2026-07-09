#!/usr/bin/env node
require('dotenv').config();
if (process.env.MONGO_URI && process.env.MONGO_URI.startsWith('mongodb+srv://')) {
  require('dns').setServers(['8.8.8.8', '1.1.1.1']);
}
const { connectCluster, getTenantDB } = require('../../dry/config/connection/dbConnection');
const getModel = require('../../dry/core/factories/modelFactory');

const run = async () => {
  await connectCluster();
  getTenantDB('SCIM');
  const Property = getModel('SCIM', 'Property', require('../../dryApp/SCIM/features/property/model/property.schema.js'));
  const Reservation = getModel('SCIM', 'Reservation', require('../../dryApp/SCIM/features/reservation/model/reservation.schema.js'));
  const Message = getModel('SCIM', 'Message', require('../../dryApp/SCIM/features/message/model/message.schema.js'));
  console.log('Property count:', await Property.countDocuments({}));
  console.log('Reservation count:', await Reservation.countDocuments({}));
  console.log('Message count:', await Message.countDocuments({}));
};

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
