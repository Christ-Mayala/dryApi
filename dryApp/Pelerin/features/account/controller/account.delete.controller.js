const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const NotesSchema = require('../../notes/model/notes.schema');
const BibleAnnotationSchema = require('../../bibleAnnotation/model/bibleAnnotation.schema');
const MeditationLogSchema = require('../../meditationLog/model/meditationLog.schema');
const HabitSchema = require('../../habit/model/habit.schema');
const HabitLogSchema = require('../../habitLog/model/habitLog.schema');
const QuizAttemptSchema = require('../../quizAttempt/model/quizAttempt.schema');
const ParcoursProgressSchema = require('../../parcoursProgress/model/parcoursProgress.schema');
const TemoignageSchema = require('../../temoignage/model/temoignage.schema');

// DELETE /account — suppression de compte en self-service (exigence App Store /
// Play Store : toute app qui permet de creer un compte doit permettre de le
// supprimer depuis l'app elle-meme). Efface reellement les donnees 100%
// personnelles (jamais de lecture croisee entre utilisateurs de toute facon),
// puis anonymise + soft-delete le User (l'historique d'audit garde une trace
// de l'id, sans donnees personnelles identifiables).
module.exports = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const User = req.getModel('User');

  const Notes = req.getModel('Notes', NotesSchema);
  const BibleAnnotation = req.getModel('BibleAnnotation', BibleAnnotationSchema);
  const MeditationLog = req.getModel('MeditationLog', MeditationLogSchema);
  const Habit = req.getModel('Habit', HabitSchema);
  const HabitLog = req.getModel('HabitLog', HabitLogSchema);
  const QuizAttempt = req.getModel('QuizAttempt', QuizAttemptSchema);
  const ParcoursProgress = req.getModel('ParcoursProgress', ParcoursProgressSchema);
  const Temoignage = req.getModel('Temoignage', TemoignageSchema);

  await Promise.all([
    Notes.deleteMany({ createdBy: userId }),
    BibleAnnotation.deleteMany({ createdBy: userId }),
    MeditationLog.deleteMany({ createdBy: userId }),
    Habit.deleteMany({ createdBy: userId }),
    HabitLog.deleteMany({ createdBy: userId }),
    QuizAttempt.deleteMany({ createdBy: userId }),
    ParcoursProgress.deleteMany({ createdBy: userId }),
    Temoignage.deleteMany({ authorUserId: userId }),
  ]);

  const user = await User.findById(userId);
  if (user) {
    user.name = 'Compte supprimé';
    user.email = `deleted-${userId}@lepelerin.invalid`;
    user.avatarUrl = null;
    user.refreshTokens = [];
    await user.softDelete();
  }

  return sendResponse(res, null, 'Compte et données personnelles supprimés');
});
