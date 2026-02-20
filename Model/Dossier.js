const mongoose = require('mongoose');

const Dossier = new mongoose.Schema({

    clientID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Utilisateur',
        required: true
    },
    typeDossier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TypeDossier',
        required: true
    },
    statusDm: {
        type: String,
        enum: ['accepte', 'refuse', 'en attente'],
        default: 'en attente'
    },

    cheminDossier: {
        type: String,
        ref: 'Client',
        required: true
    },

}, { timestamps: true });

module.exports = mongoose.model('Dossier', Dossier);