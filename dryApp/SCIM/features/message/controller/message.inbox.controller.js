const asyncHandler = require('express-async-handler');
const sendResponse = require('../../../../../dry/utils/http/response');
const { getPagination } = require('../../../../../dry/utils/data/pagination');
const mongoose = require('mongoose');

const MessageSchema = require('../model/message.schema');

module.exports = asyncHandler(async (req, res) => {
    const Message = req.getModel('Message', MessageSchema);
    const User = req.getModel('User');

    const { page, limit } = getPagination(req.query, { defaultLimit: 10, maxLimit: 100 });

    const me = mongoose.Types.ObjectId.isValid(req.user.id)
        ? new mongoose.Types.ObjectId(req.user.id)
        : req.user.id;

    const skip = (page - 1) * limit;
    const userCollection = User.collection.collectionName;

    const pipeline = [
        {
            $match: {
                $or: [{ expediteur: me }, { destinataire: me }],
            },
        },
        {
            $project: {
                expediteur: 1,
                destinataire: 1,
                sujet: 1,
                contenu: 1,
                lu: 1,
                createdAt: 1,
                updatedAt: 1,
                otherUserId: {
                    $cond: [{ $eq: ['$expediteur', me] }, '$destinataire', '$expediteur'],
                },
                unreadInc: {
                    $cond: [{ $and: [{ $eq: ['$destinataire', me] }, { $eq: ['$lu', false] }] }, 1, 0],
                },
            },
        },
        { $sort: { createdAt: -1 } },
        {
            $group: {
                _id: '$otherUserId',
                dernierMessage: { $first: '$$ROOT' },
                nonLus: { $sum: '$unreadInc' },
            },
        },
        {
            $lookup: {
                from: userCollection,
                localField: '_id',
                foreignField: '_id',
                as: 'correspondant',
            },
        },
        {
            $unwind: {
                path: '$correspondant',
                preserveNullAndEmptyArrays: false,
            },
        },
    ];

    if (req.user.role !== 'admin') {
        pipeline.push({
            $match: {
                'correspondant.role': 'admin',
            },
        });
    }

    pipeline.push({ $sort: { 'dernierMessage.createdAt': -1 } });
    pipeline.push({
        $facet: {
            meta: [{ $count: 'totalThreads' }],
            threads: [
                { $skip: skip },
                { $limit: limit },
                {
                    $project: {
                        _id: 0,
                        correspondant: {
                            _id: '$correspondant._id',
                            name: '$correspondant.name',
                            nom: '$correspondant.nom',
                            email: '$correspondant.email',
                            telephone: '$correspondant.telephone',
                        },
                        dernierMessage: {
                            _id: '$dernierMessage._id',
                            expediteur: '$dernierMessage.expediteur',
                            destinataire: '$dernierMessage.destinataire',
                            sujet: '$dernierMessage.sujet',
                            contenu: '$dernierMessage.contenu',
                            lu: '$dernierMessage.lu',
                            createdAt: '$dernierMessage.createdAt',
                            updatedAt: '$dernierMessage.updatedAt',
                        },
                        nonLus: 1,
                    },
                },
            ],
        },
    });

    const [agg] = await Message.aggregate(pipeline);
    const totalThreads = Number(agg?.meta?.[0]?.totalThreads || 0);
    const totalPages = Math.max(1, Math.ceil(totalThreads / limit));
    const threads = Array.isArray(agg?.threads) ? agg.threads : [];

    return sendResponse(res, { page, limit, totalThreads, totalPages, threads }, 'Boite de reception');
});
