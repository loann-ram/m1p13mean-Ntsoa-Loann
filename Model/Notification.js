const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    clientID:   { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', required: true },
    titre:      { type: String, required: true },
    message:    { type: String, required: true },
    type:       { type: String, enum: ['info', 'paiement', 'retard', 'alerte'], default: 'info' },
    lu:         { type: Boolean, default: false },
    lienAction: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.models.Notification
    || mongoose.model('Notification', notificationSchema);
