const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    inscription: {
        type: Date,
        default: Date.now
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    mdp: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['boutique', 'acheteur'],
        required: true
    },
    is_actif: {
        type: Boolean,
        default: true
    }
},{ timestamps: true });

module.exports = mongoose.model('User', UserSchema);