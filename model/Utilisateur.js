const mongoose = require('mongoose');

const UtilisateurSchema = new mongoose.Schema({
    inscription:{
        type: Date,
        default: Date.now
    },
    nom:{
        type: String,
        required: true
    },
    prenom: {
        type: String
    },
    email:{
        type: String,
        required: true,
        lowercase: true,
        unique: true
    },
    mdp:{
        type: String,
        required: true,
    },
    telephone:{
        type: String,
    },
    roles:{
        type: [String],
        enum : ['boutique','acheteur'],
        default: ['acheteur']
    },
    typeClient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TypeClientex',
        required: true
    }
});

module.exports =mongoose.models.Utilisateur || mongoose.model('Utilisateur',UtilisateurSchema);