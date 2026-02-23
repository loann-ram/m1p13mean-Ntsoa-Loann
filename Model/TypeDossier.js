const mongoose = require('mongoose');

const TypeDossier = new mongoose.Schema({

    nom: {
        type: String,
        required: true
    },
    description: {
        type: String
    }
}, { timestamps: true });

module.exports = mongoose.model('TypeDossier', TypeDossier);