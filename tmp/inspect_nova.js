require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config/database');
const getModel = require('../dry/core/factories/modelFactory');

const WorkspacesSchema = require('../dryApp/Nova/features/workspaces/model/workspaces.schema');
const EspacesSchema = require('../dryApp/Nova/features/espaces/model/espaces.schema');
const PagesSchema = require('../dryApp/Nova/features/pages/model/pages.schema');
const BlocsSchema = require('../dryApp/Nova/features/blocs/model/blocs.schema');

(async () => {
  await mongoose.connect(config.MONGO_URI);
  const db = mongoose.connection.useDb('NovaDB', { useCache: true });
  const User = getModel('Nova', 'User');
  const Workspace = getModel('Nova', 'Workspace', WorkspacesSchema);
  const Espace = getModel('Nova', 'Espace', EspacesSchema);
  const Page = getModel('Nova', 'Page', PagesSchema);
  const Bloc = getModel('Nova', 'Bloc', BlocsSchema);

  const users = await User.find({}).select('name email role novaRole').lean();
  console.log('DB:', db.name);
  console.log('USERS:', JSON.stringify(users, null, 2));
  console.log('WORKSPACES:', JSON.stringify(await Workspace.find({}).select('nom createdBy deletedAt').lean(), null, 2));
  console.log('ESPACES:', JSON.stringify(await Espace.find({}).select('nom workspaceId createdBy deletedAt').lean(), null, 2));
  console.log('COUNTS:', {
    pages: await Page.countDocuments({}),
    blocs: await Bloc.countDocuments({}),
  });
  await mongoose.disconnect();
})().catch((e) => {
  console.error('ERREUR:', e);
  process.exit(1);
});
