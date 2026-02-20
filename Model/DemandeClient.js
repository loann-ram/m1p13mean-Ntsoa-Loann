const mongoose = require('mongoose');

const DemandeClient = new mongoose.Schema({
    clientID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client',
        required: true
    },

    dossierClientID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Dossier'
    },

    statusDm: {
        type: String,
        enum: ['accepte', 'refuse', 'en attente'],
        default: 'en attente'
    },

    dateDm: {
        type: Date,
        default: Date.now
    }

}, { timestamps: true });

module.exports = mongoose.model('DemandeClient', DemandeClient);