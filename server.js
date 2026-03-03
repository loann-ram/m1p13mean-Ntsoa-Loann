const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const createTypeClient = require('./utils/TypeClient');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const auth = require("./middleware/auth");
const authAdmin = require("./middleware/authAdmin");

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:4200',
        methods: ['GET', 'POST'],
        credentials: true
    }
});
require('./utils/socket').initSocket(io);

io.on('connection', (socket) => {
    console.log(' Socket connecté :', socket.id);

    socket.on('rejoindre', (userId) => {
        socket.join(`user_${userId}`);
        console.log(`User ${userId} a rejoint sa room`);
    });

    socket.on('disconnect', () => {
        console.log('Socket déconnecté :', socket.id);
    });
});
['uploads/logos', 'uploads/locaux', 'uploads/produits/temp'].forEach(dir => {
    const fullPath = path.join(__dirname, dir);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`Dossier créé : ${fullPath}`);
    }
});
mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log("MongoDB connecté avec succès");
        await createTypeClient();
        const { demarrerCronJobs } = require('./utils/cron');
        demarrerCronJobs();
        app.use('/auth', require('./routes/authRoutes'));
        app.use('/boutique', require('./routes/boutiqueRoutes'));
        app.use('/panier', require('./routes/panierRoutes'));
        app.use('/categorie', require('./routes/categorieRoutes'));
        app.use('/sousCategorie', require('./routes/sousCategorieRoutes'));
        app.use('/LocaleCM', require('./routes/LocaleRoute'));
        app.use('/VisiteCM', require('./routes/visiteRoutes'));
        app.use('/ReservationCM', require('./routes/ReservationLocalRoute'));
        app.use('/DemandeLocationCM', require('./routes/DemandeLocRoute'));
        app.use('/DossierCM', require('./routes/DossierRoute'));
        app.use('/ResponseDm', (req, res, next) => {
            if (req.path.startsWith('/contrat-apercu') || req.path.startsWith('/apercu-contrat')) {
                return next();
            }
            const authMiddleware = require('./middleware/auth');
            return authMiddleware(req, res, next);
        }, require('./routes/ResponseDmRoute'));
        app.use('/PaimentCm', require('./routes/PaiementLoyerRoute'));
        app.use('/CommandeCm', require('./routes/CommandeRoutes'));
        app.use('/notifications', require('./routes/NotificationRoute'));
        app.use('/Statistique', require('./routes/StatRoute'));
        app.use('/admin', require('./routes/adminRoutes'));
        app.use('/produit', require('./routes/produitRoutes'));
        app.use('/stock', require('./routes/stockRoutes'));
        app.use('/typeClient', require('./routes/typeClientRoutes'));
        app.use('/commande', require('./routes/commandeRoutes'));
        app.use('/vente', require('./routes/venteRoutes'));

        server.listen(PORT, () => {
            console.log(`Serveur démarré sur le port ${PORT}`);
        });
    })
    .catch(err => {
        console.error("Erreur de connexion MongoDB:", err.message);
    });
