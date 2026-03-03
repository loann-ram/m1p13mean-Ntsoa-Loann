const mongoose = require('mongoose');

const HoraireSchema = new mongoose.Schema({
    jour: {
        type: String,
        enum: [
            "Lundi", "Mardi", "Mercredi", "Jeudi",
            "Vendredi", "Samedi", "Dimanche"
        ],
        required: true
    },
    is_open: {
        type: Boolean,
        default: true
    },
    ouverture: {
        type: String,
        validate: {
            validator: function(v) {
                return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
            },
            message: props => ${props.value} n'est pas un format d'heure valide (HH:mm)!
        },
        required: function() { return this.is_open; }
    },
    fermeture: {
        type: String,
        validate: {
            validator: function(v) {
                return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
            },
            message: props => ${props.value} n'est pas un format d'heure valide (HH:mm)!
        },
        required: function() { return this.is_open; }
    }
});


const BoutiqueSchema = new mongoose.Schema({
    utilisateurId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Utilisateur',
        required: true
    },
    local: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Local',
        required: true
    },
    nom: {
        type: String,
        required: true,
        unique: true
    },
    description: String,
    telephone: {
        type: String,
        required: true,
        unique: true
    },
    logo: {
        type: String
    },
    categorie: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Categorie',
        required: true
    },
    horaires: [HoraireSchema],
    is_active: {
        type: Boolean,
        default: true
    },
    inscription: {
        type: Date,
        default: Date.now
    }
});

BoutiqueSchema.index({ local: 1 }, { unique: true, partialFilterExpression: { is_active: true } });

module.exports =mongoose.models.Boutique || mongoose.model('Boutique', BoutiqueSchema);