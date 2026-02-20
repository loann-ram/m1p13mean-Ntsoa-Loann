const mongoose = require('mongoose');


const LocalSchema = new mongoose.Schema({
        nom_boutique: String,
        avantage: [String],
        description: String,
        surface: Number,
        emplacement:{
            type: String,
            enum: ['Emplacement FC','Emplacement OS','Emplacement Ev','Emplacement Str-RDC','Emplacement Str-1Etg']
        },
        loyer: Number,
        image: String,
        etat_boutique: {
            type: String,
            enum: ['disponible', 'louée', 'maintenance'],
            default: 'disponible'
        },
        categorie: {
            type: String,
            enum: ['Pop-up-store', 'Open-space', 'Evenementiel','Food-court']
        }
    },
    { timestamps: true });

module.exports = mongoose.model('Local', LocalSchema);