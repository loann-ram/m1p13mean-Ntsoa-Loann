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

// ── Middlewares ────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Socket.io ──────────────────────────────────────────────
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:4200',
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Initialiser socket.io pour le rendre disponible partout
require('./utils/socket').initSocket(io);

io.on('connection', (socket) => {
    console.log('🟢 Socket connecté :', socket.id);

    // Le client Angular envoie son userId pour rejoindre sa room privée
    socket.on('rejoindre', (userId) => {
        socket.join(`user_${userId}`);
        console.log(`👤 User ${userId} a rejoint sa room`);
    });

    socket.on('disconnect', () => {
        console.log('🔴 Socket déconnecté :', socket.id);
    });
});

// ── Création des dossiers uploads ─────────────────────────
['uploads/logos', 'uploads/locaux', 'uploads/produits/temp'].forEach(dir => {
    const fullPath = path.join(__dirname, dir);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`✅ Dossier créé : ${fullPath}`);
    }
});

// ── MongoDB + Routes ───────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log("MongoDB connecté avec succès");

        // Créer les types de client par défaut
        await createTypeClient();

        // Démarrer les cron jobs
        const { demarrerCronJobs } = require('./utils/cron');
        demarrerCronJobs();

        // ── Routes ─────────────────────────────────────────────
        console.log('1 - Route auth');
        app.use('/auth', require('./routes/authRoutes'));

        console.log('2 - Route boutique');
        app.use('/boutique', require('./routes/boutiqueRoutes'));

        console.log('3 - Route panier');
        app.use('/panier', require('./routes/panierRoutes'));

        console.log('4 - Route categorie');
        app.use('/categorie', require('./routes/categorieRoutes'));

        console.log('5 - Route sousCategorie');
        app.use('/sousCategorie', require('./routes/sousCategorieRoutes'));

        console.log('6 - Route locale');
        app.use('/LocaleCM', require('./routes/LocaleRoute'));

        console.log('7 - Route visite');
        app.use('/VisiteCM', require('./routes/visiteRoutes'));

        console.log('8 - Route reservation');
        app.use('/ReservationCM', require('./routes/ReservationLocalRoute'));

        console.log('9 - Route demande location');
        app.use('/DemandeLocationCM', require('./routes/DemandeLocRoute'));

        console.log('10 - Route dossier');
        app.use('/DossierCM', require('./routes/DossierRoute'));

       console.log('11 - Route response');
        app.use('/ResponseDm', (req, res, next) => {
            if (req.path.startsWith('/contrat-apercu') || req.path.startsWith('/apercu-contrat')) {
                return next();
            }
            // Le require direct doit être exécuté immédiatement
            const authMiddleware = require('./middleware/auth');
            return authMiddleware(req, res, next);
        }, require('./routes/ResponseDmRoute'));

        console.log('12 - Route paiement');
        app.use('/PaimentCm', require('./routes/PaiementLoyerRoute'));

        console.log('13 - Route commande');
        app.use('/CommandeCm', require('./routes/CommandeRoutes'));

        console.log('14 - Route notifications');
        app.use('/notifications', require('./routes/NotificationRoute'));

        console.log('15 - Route statistique');
        app.use('/Statistique', require('./routes/StatRoute'));

        console.log('16 - Route admin');
        app.use('/admin', require('./routes/adminRoutes'));

        console.log('17 - Route produit');
        app.use('/produit', require('./routes/produitRoutes'));

        console.log('18 - Route stock');
        app.use('/stock', require('./routes/stockRoutes'));

        console.log('19 - Route typeClient');
        app.use('/typeClient', require('./routes/typeClientRoutes'));

        console.log('20 - Route commande');
        app.use('/commande', require('./routes/commandeRoutes'));

        console.log('21 - Route vente');
        app.use('/vente', require('./routes/venteRoutes'));

        console.log('✅ Toutes les routes enregistrées');

        // ── Démarrage du serveur ───────────────────────────────
        server.listen(PORT, () => {
            console.log(`🚀 Serveur démarré sur le port ${PORT}`);
        });
    })
    .catch(err => {
        console.error("❌ Erreur de connexion MongoDB:", err.message);
    });