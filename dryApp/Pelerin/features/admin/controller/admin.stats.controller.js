const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');

const TemoignageSchema = require('../../temoignage/model/temoignage.schema');
const QuizSchema = require('../../quiz/model/quiz.schema');
const MeditationSchema = require('../../meditation/model/meditation.schema');
const ParcoursSchema = require('../../parcours/model/parcours.schema');
const DevPersonnelSchema = require('../../devPersonnel/model/devPersonnel.schema');
const AudioTrackSchema = require('../../audioTrack/model/audioTrack.schema');
const PodcastShowSchema = require('../../podcastShow/model/podcastShow.schema');
const PodcastEpisodeSchema = require('../../podcastEpisode/model/podcastEpisode.schema');

// GET /admin/stats — vue d'ensemble pour le tableau de bord admin.
module.exports = asyncHandler(async (req, res) => {
  const User = req.getModel('User');
  const Temoignage = req.getModel('Temoignage', TemoignageSchema);
  const Quiz = req.getModel('Quiz', QuizSchema);
  const Meditation = req.getModel('Meditation', MeditationSchema);
  const Parcours = req.getModel('Parcours', ParcoursSchema);
  const DevPersonnel = req.getModel('DevPersonnel', DevPersonnelSchema);
  const AudioTrack = req.getModel('AudioTrack', AudioTrackSchema);
  const PodcastShow = req.getModel('PodcastShow', PodcastShowSchema);
  const PodcastEpisode = req.getModel('PodcastEpisode', PodcastEpisodeSchema);

  const [
    totalUsers,
    totalAdmins,
    pendingTemoignages,
    totalQuizQuestions,
    totalMeditations,
    totalParcours,
    publishedParcours,
    totalDevPersonnel,
    totalAudioTracks,
    totalPodcastShows,
    totalPodcastEpisodes,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ role: 'admin' }),
    Temoignage.countDocuments({ isApproved: false }),
    Quiz.countDocuments({}),
    Meditation.countDocuments({}),
    Parcours.countDocuments({}),
    Parcours.countDocuments({ isPublished: true }),
    DevPersonnel.countDocuments({}),
    AudioTrack.countDocuments({}),
    PodcastShow.countDocuments({}),
    PodcastEpisode.countDocuments({}),
  ]);

  return sendResponse(res, {
    totalUsers,
    totalAdmins,
    // "Actifs 30j" necessiterait un suivi de lastLogin/lastSeen — ces champs
    // existent sur le schema User partage mais ne sont ecrits nulle part dans
    // le controleur de connexion (kernel), donc toujours vides aujourd'hui.
    // Voir docs/ROADMAP.md pour le suivi de ce gap plutot que d'afficher un
    // chiffre trompeur (toujours 0) ici.
    pendingTemoignages,
    totalQuizQuestions,
    totalMeditations,
    totalParcours,
    publishedParcours,
    totalDevPersonnel,
    totalAudioTracks,
    totalPodcastShows,
    totalPodcastEpisodes,
  }, 'Statistiques recuperees');
});
