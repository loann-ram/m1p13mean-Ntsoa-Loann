const mongoose = require('mongoose');

const DossierRequire = new mongoose.Schema({

    typeClientex: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TypeClientex',
        unique: true
    },

    typeDocument:[ {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TypeDossier'
    }
    ],

    obligatoire: {
        type: Boolean,
        default: true
    }

}, { timestamps: true });

module.exports = mongoose.model('DossierRequire', DossierRequire);