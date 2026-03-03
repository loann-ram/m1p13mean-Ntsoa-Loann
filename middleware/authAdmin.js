const jwt = require('jsonwebtoken');

const authAdmin = (req, res, next) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.role !== 'admin') {
            return res.status(403).json({ message: 'Accès refusé, admin uniquement' });
        }

        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token invalide ou manquant' });
    }
};

module.exports = authAdmin;