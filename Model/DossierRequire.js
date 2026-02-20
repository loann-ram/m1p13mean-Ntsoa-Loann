const mongoose = require('mongoose');

const DossierRequire = new mongoose.Schema({

    typeClient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TypeClient',
        unique: true
    },

    typeDocument:[ {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TypeDocument'
    }
    ],

    obligatoire: {
        type: Boolean,
        default: true
    }

}, { timestamps: true });

module.exports = mongoose.model('DossierRequirement', DossierRequire);