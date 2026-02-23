const mongoose = require('mongoose');

const TypeDossier = new mongoose.Schema({

    nom: {
        type: String,
        required: true
    }

}, { timestamps: true });

module.exports = mongoose.model('TypeDossier', TypeDossier);