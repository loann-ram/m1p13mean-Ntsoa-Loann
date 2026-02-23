const mongoose = require('mongoose');

const UtilisateurSchema = new mongoose.Schema({
    inscription:{
        type: Date,
        default: Date.now
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
        required: function() {
            return this.roles.includes('boutique');
        }
    }
});

module.exports = mongoose.model('Utilisateur',UtilisateurSchema);