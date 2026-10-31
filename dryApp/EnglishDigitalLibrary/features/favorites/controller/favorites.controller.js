const sendResponse = require('../../../../../dry/utils/http/response');
const service = require('../service/favorites.service');

// Les favoris sont personnels : l'identifiant utilisateur vient toujours du jeton validé.
exports.list = async (req, res) => sendResponse(res, await service.list(req), 'Favorites');
exports.add = async (req, res) => { await service.add(req, req.params.bookId); sendResponse(res, { isFavorite: true }, 'Book added to favorites'); };
exports.remove = async (req, res) => { await service.remove(req, req.params.bookId); sendResponse(res, { isFavorite: false }, 'Book removed from favorites'); };
