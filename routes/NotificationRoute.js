const express = require('express');
const router = express.Router();
const Notification = require('../Model/Notification');

// GET toutes les notifications de l'utilisateur connecté
router.get('/mes-notifications', async (req, res) => {
    try {
        const notifications = await Notification
            .find({ clientID: req.user.id })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
// PATCH marquer toutes comme lues
router.patch('/marquer-toutes-lues', async (req, res) => {
    try {
        await Notification.updateMany({ clientID: req.user.id, lu: false }, { lu: true });
        res.json({ message: 'Toutes les notifications marquées comme lues' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
// PATCH toggle lu / non lu
router.patch('/:id/toggle-lu', async (req, res) => {
    try {
        const notif = await Notification.findOne({ _id: req.params.id, clientID: req.user.id });
        if (!notif) return res.status(404).json({ message: 'Notification non trouvée' });

        notif.lu = !notif.lu;
        await notif.save();
        res.json(notif);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
