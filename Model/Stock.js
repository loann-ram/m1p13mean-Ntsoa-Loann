const mongoose = require('mongoose');

const StockSchema = new mongoose.Schema({
    produitId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Produit',
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    taille: {
        type: String,
        required: false,
        trim: true
    },
    quantite: {
        type: Number,
        required: true
    }
});

StockSchema.index({ produitId: 1, date: -1 });

StockSchema.post('save', async function(doc) {
    try {
        const Produit = mongoose.model('Produit');
        const result = await this.constructor.aggregate([
            { $match: { produitId: doc.produitId } },
            { $group: { _id: null, total: { $sum: '$quantite' } } }
        ]);
        const totalStock = result.length > 0 ? result[0].total : 0;
        await Produit.findByIdAndUpdate(doc.produitId, { isDispo: totalStock > 0 });
    } catch (err) {
        console.error('Erreur mise à jour isDispo:', err);
    }
});

module.exports = mongoose.model('Stock', StockSchema);