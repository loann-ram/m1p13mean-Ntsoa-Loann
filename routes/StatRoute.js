// routes/stats.routes.js
// ⚠️  CE FICHIER DOIT S'APPELER : StatRoute.js
// ⚠️  Et être monté dans server.js comme :
//     app.use('/Statistique', auth, require('./routes/StatRoute'));
// La route principale est GET /Statistique  (pas /stats)
const express = require('express');
const router  = express.Router();

const Local            = require('../model/Local');
const Visite           = require('../model/Visite');
const ReservationLocal = require('../model/ReservationLocal');
const DemandeClient    = require('../model/DemandeClient');
const PaiementLoyer    = require('../model/PaiementLoyer');
const PaiementCommande = require('../model/PaiementCommande');
const Commande         = require('../model/Commande');
const Utilisateur      = require('../model/Utilisateur');
const ReponseDemande   = require('../model/ResponseDm');
const auth = require("../middleware/auth");

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — parse Decimal128 en nombre JS
// ─────────────────────────────────────────────────────────────────────────────
const toNum = (v) => {
    if (!v) return 0;
    if (typeof v === 'object' && v.$numberDecimal) return parseFloat(v.$numberDecimal);
    return parseFloat(v) || 0;
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — 12 derniers mois sous forme ['2024-08', ..., '2025-07']
// ─────────────────────────────────────────────────────────────────────────────
const getLast12Months = () => {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/stats
// Retourne toutes les statistiques en une seule requête
// Structure : { kpis, finances, locaux, visites }
// ─────────────────────────────────────────────────────────────────────────────
router.get('/',auth, async (req, res) => {
    try {
        const now        = new Date();
        const moisActuel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const debutMois  = new Date(now.getFullYear(), now.getMonth(), 1);
        const debutAnnee = new Date(now.getFullYear(), 0, 1);
        const last12     = getLast12Months();
        const debut12    = new Date(now.getFullYear(), now.getMonth() - 11, 1);

        // ════════════════════════════════════════════════════════════════════
        // Toutes les requêtes en parallèle pour la performance
        // ════════════════════════════════════════════════════════════════════
        const [
            // ── LOCAUX
            allLocaux,

            // ── CLIENTS
            totalClients,
            nouveauxClientsMois,
            clientsParType,

            // ── VISITES
            visitesParStatut,
            visitesMensuelles,
            visitesParHeure,
            visitesParLocal,

            // ── DEMANDES
            demandesParStatut,

            // ── RÉSERVATIONS
            reservationsParStatut,

            // ── PAIEMENTS LOYERS
            loyersMensuelsBrut,
            loyersParStatut,
            loyersEnRetard,
            totalLoyersDus,
            totalLoyersPaies,
            loyersParMode,

            // ── COMMANDES
            commandesParStatut,
            commandesMensuelles,
            totalCommandesMontant,
            commandesParMode,

            // ── PREUVES EN ATTENTE
            preuvesCmdenAttente,
            preuvesCmLoyerAttente,

        ] = await Promise.all([

            // ── LOCAUX
            Local.find().lean(),

            // ── CLIENTS
            Utilisateur.countDocuments({ roles: { $in: ['acheteur', 'boutique'] } }),
            Utilisateur.countDocuments({ inscription: { $gte: debutMois } }),
            Utilisateur.aggregate([
                { $unwind: '$roles' },
                { $match: { roles: { $in: ['acheteur', 'boutique'] } } },
                { $group: { _id: '$roles', count: { $sum: 1 } } }
            ]),

            // ── VISITES par statut
            Visite.aggregate([
                { $group: { _id: '$statut', count: { $sum: 1 } } }
            ]),

            // ── VISITES mensuelles (12 derniers mois)
            Visite.aggregate([
                { $match: { createdAt: { $gte: debut12 } } },
                { $group: {
                        _id: {
                            year:  { $year: '$date' },
                            month: { $month: '$date' }
                        },
                        count: { $sum: 1 }
                    }},
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]),

            // ── VISITES par créneau horaire
            Visite.aggregate([
                { $group: { _id: '$heure_debut', count: { $sum: 1 } } },
                { $sort: { '_id': 1 } }
            ]),

            // ── VISITES par local (top 5)
            Visite.aggregate([
                { $group: { _id: '$localeID', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 },
                { $lookup: { from: 'locals', localField: '_id', foreignField: '_id', as: 'local' } },
                { $unwind: { path: '$local', preserveNullAndEmptyArrays: true } },
                { $project: { nom: '$local.nom_boutique', count: 1 } }
            ]),

            // ── DEMANDES par statut
            DemandeClient.aggregate([
                { $group: { _id: '$statusDm', count: { $sum: 1 } } }
            ]),

            // ── RÉSERVATIONS par statut
            ReservationLocal.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),

            // ── LOYERS mensuels (12 mois) — montants
            PaiementLoyer.aggregate([
                { $match: {
                        moisConcerne: { $in: last12 },
                        statut: 'paye'
                    }},
                { $group: {
                        _id: '$moisConcerne',
                        totalPaye: { $sum: '$montantPaye' },
                        count: { $sum: 1 }
                    }},
                { $sort: { _id: 1 } }
            ]),

            // ── LOYERS par statut
            PaiementLoyer.aggregate([
                { $group: { _id: '$statut', count: { $sum: 1 }, total: { $sum: '$montantDu' } } }
            ]),

            // ── LOYERS en retard (liste)
            PaiementLoyer.countDocuments({ statut: { $in: ['en retard', 'impaye'] } }),

            // ── Total loyers dus (tous)
            PaiementLoyer.aggregate([
                { $group: { _id: null, total: { $sum: '$montantDu' } } }
            ]),

            // ── Total loyers payés
            PaiementLoyer.aggregate([
                { $group: { _id: null, total: { $sum: '$montantPaye' } } }
            ]),

            // ── Loyers par mode de paiement
            PaiementLoyer.aggregate([
                { $match: { statut: 'paye' } },
                { $group: { _id: '$modePaiement', count: { $sum: 1 }, total: { $sum: '$montantPaye' } } }
            ]),

            // ── COMMANDES par statut
            Commande.aggregate([
                { $group: { _id: '$statut', count: { $sum: 1 } } }
            ]),

            // ── COMMANDES mensuelles (12 mois)
            Commande.aggregate([
                { $match: { createdAt: { $gte: debut12 } } },
                { $group: {
                        _id: {
                            year:  { $year: '$createdAt' },
                            month: { $month: '$createdAt' }
                        },
                        count: { $sum: 1 },
                        total: { $sum: { $toDouble: '$montantTotal' } }
                    }},
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]),

            // ── Total commandes montant (payées)
            PaiementCommande.aggregate([
                { $match: { statut: 'paye' } },
                { $group: { _id: null, total: { $sum: '$montantPaye' } } }
            ]),

            // ── Commandes par mode paiement
            PaiementCommande.aggregate([
                { $match: { statut: 'paye' } },
                { $group: { _id: '$modePaiement', count: { $sum: 1 }, total: { $sum: '$montantPaye' } } }
            ]),

            // ── Preuves commandes en attente
            PaiementCommande.countDocuments({ statutPreuve: 'en_attente_validation' }),

            // ── Preuves loyers en attente
            PaiementLoyer.countDocuments({ statutPreuve: 'en_attente_validation' }),
        ]);

        // ════════════════════════════════════════════════════════════════════
        // CONSTRUCTION DES KPIs GLOBAUX
        // ════════════════════════════════════════════════════════════════════
        const locauxDisponibles  = allLocaux.filter(l => l.etat_boutique === 'disponible').length;
        const locauxLoues        = allLocaux.filter(l => l.etat_boutique === 'louée').length;
        const locauxMaintenance  = allLocaux.filter(l => l.etat_boutique === 'maintenance').length;
        const tauxOccupation     = allLocaux.length > 0
            ? Math.round((locauxLoues / allLocaux.length) * 100)
            : 0;

        const kpis = {
            locaux: {
                total:        allLocaux.length,
                disponibles:  locauxDisponibles,
                loues:        locauxLoues,
                maintenance:  locauxMaintenance,
                tauxOccupation
            },
            clients: {
                total:          totalClients,
                nouveauxCeMois: nouveauxClientsMois
            },
            alertes: {
                demandesEnAttente:   demandesParStatut.find(d => d._id === 'en attente')?.count ?? 0,
                visitesEnAttente:    visitesParStatut.find(v => v._id === 'en attente de confirmation')?.count ?? 0,
                loyersEnRetard:      loyersEnRetard,
                preuvesEnAttente:    preuvesCmdenAttente + preuvesCmLoyerAttente
            }
        };

        // ════════════════════════════════════════════════════════════════════
        // SECTION FINANCES
        // ════════════════════════════════════════════════════════════════════

        // Mapper les loyers sur les 12 mois (avec 0 pour les mois sans données)
        const loyersMoisMap = {};
        loyersMensuelsBrut.forEach(l => { loyersMoisMap[l._id] = l.totalPaye; });

        const loyersMensuels = last12.map(m => ({
            mois:  m,
            label: new Date(m + '-01').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
            total: loyersMoisMap[m] ?? 0
        }));

        // Mapper les commandes sur les 12 mois
        const cmdMoisMap = {};
        commandesMensuelles.forEach(c => {
            const k = `${c._id.year}-${String(c._id.month).padStart(2, '0')}`;
            cmdMoisMap[k] = { count: c.count, total: c.total };
        });

        const commandesMois = last12.map(m => ({
            mois:  m,
            label: new Date(m + '-01').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
            count: cmdMoisMap[m]?.count ?? 0,
            total: cmdMoisMap[m]?.total ?? 0
        }));

        const totalLoyerDu  = totalLoyersDus[0]?.total  ?? 0;
        const totalLoyerPay = totalLoyersPaies[0]?.total ?? 0;
        const totalCmdPay   = totalCommandesMontant[0]?.total ?? 0;

        const finances = {
            resume: {
                totalLoyersDus:    Math.round(totalLoyerDu),
                totalLoyersPaies:  Math.round(totalLoyerPay),
                totalLoyersRestant:Math.round(Math.max(0, totalLoyerDu - totalLoyerPay)),
                totalCommandesPaies: Math.round(totalCmdPay),
                revenusTotal:      Math.round(totalLoyerPay + totalCmdPay)
            },
            loyersMensuels,      // courbe 12 mois
            commandesMensuels: commandesMois, // courbe 12 mois

            loyersParStatut: loyersParStatut.map(l => ({
                statut: l._id,
                count:  l.count,
                total:  Math.round(l.total)
            })),

            commandesParStatut: commandesParStatut.map(c => ({
                statut: c._id,
                count:  c.count
            })),

            loyersParMode: loyersParMode.map(m => ({
                mode:  m._id || 'non précisé',
                count: m.count,
                total: Math.round(m.total)
            })),

            commandesParMode: commandesParMode.map(m => ({
                mode:  m._id || 'non précisé',
                count: m.count,
                total: Math.round(m.total)
            }))
        };

        // ════════════════════════════════════════════════════════════════════
        // SECTION LOCAUX
        // ════════════════════════════════════════════════════════════════════

        // Répartition par catégorie
        const catMap = {};
        allLocaux.forEach(l => {
            const cat = l.categorie || 'Non défini';
            if (!catMap[cat]) catMap[cat] = { total: 0, disponibles: 0, loues: 0 };
            catMap[cat].total++;
            if (l.etat_boutique === 'disponible') catMap[cat].disponibles++;
            if (l.etat_boutique === 'louée')      catMap[cat].loues++;
        });

        // Répartition par emplacement
        const empMap = {};
        allLocaux.forEach(l => {
            const emp = l.emplacement || 'Non défini';
            if (!empMap[emp]) empMap[emp] = { total: 0, disponibles: 0, loues: 0 };
            empMap[emp].total++;
            if (l.etat_boutique === 'disponible') empMap[emp].disponibles++;
            if (l.etat_boutique === 'louée')      empMap[emp].loues++;
        });

        // Revenus par local (top 5)
        const loyersParLocalRaw = await PaiementLoyer.aggregate([
            { $match: { statut: 'paye' } },
            { $group: { _id: '$localID', totalPaye: { $sum: '$montantPaye' }, count: { $sum: 1 } } },
            { $sort: { totalPaye: -1 } },
            { $limit: 5 },
            { $lookup: { from: 'locals', localField: '_id', foreignField: '_id', as: 'local' } },
            { $unwind: { path: '$local', preserveNullAndEmptyArrays: true } },
            { $project: { nom: '$local.nom_boutique', emplacement: '$local.emplacement', categorie: '$local.categorie', totalPaye: 1, count: 1 } }
        ]);

        const locaux = {
            etatGlobal: {
                disponibles: locauxDisponibles,
                loues:       locauxLoues,
                maintenance: locauxMaintenance,
                tauxOccupation
            },
            parCategorie: Object.entries(catMap).map(([cat, v]) => ({
                categorie:   cat,
                total:       v.total,
                disponibles: v.disponibles,
                loues:       v.loues
            })),
            parEmplacement: Object.entries(empMap).map(([emp, v]) => ({
                emplacement: emp,
                total:       v.total,
                disponibles: v.disponibles,
                loues:       v.loues
            })),
            topLocauxRevenus: loyersParLocalRaw.map(l => ({
                nom:        l.nom || 'Inconnu',
                emplacement:l.emplacement,
                categorie:  l.categorie,
                totalPaye:  Math.round(l.totalPaye),
                nbPaiements:l.count
            })),
            reservationsParStatut: reservationsParStatut.map(r => ({
                statut: r._id,
                count:  r.count
            })),
            demandesParStatut: demandesParStatut.map(d => ({
                statut: d._id,
                count:  d.count
            }))
        };

        // ════════════════════════════════════════════════════════════════════
        // SECTION VISITES
        // ════════════════════════════════════════════════════════════════════

        // Mapper visites mensuelles sur 12 mois
        const visiteMoisMap = {};
        visitesMensuelles.forEach(v => {
            const k = `${v._id.year}-${String(v._id.month).padStart(2, '0')}`;
            visiteMoisMap[k] = v.count;
        });

        const visitesMois = last12.map(m => ({
            mois:  m,
            label: new Date(m + '-01').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
            count: visiteMoisMap[m] ?? 0
        }));

        // Statuts visites
        const totalVisites          = visitesParStatut.reduce((s, v) => s + v.count, 0);
        const visitesTerminees       = visitesParStatut.find(v => v._id === 'Terminée')?.count ?? 0;
        const visitesConfirmees      = visitesParStatut.find(v => v._id === 'Confirmée')?.count ?? 0;
        const visitesAnnulees        = visitesParStatut.find(v => v._id === 'Annulée')?.count ?? 0;

        // Taux conversion visite → réservation (visites terminées avec une réservation)
        const visitesAvecResa = await Visite.aggregate([
            { $match: { statut: 'Terminée' } },
            { $lookup: {
                    from: 'reservationlocals',
                    localField: 'clientId',
                    foreignField: 'clientId',
                    as: 'reservations'
                }},
            { $match: { 'reservations.0': { $exists: true } } },
            { $count: 'total' }
        ]);
        const nbAvecResa      = visitesAvecResa[0]?.total ?? 0;
        const tauxConversion  = visitesTerminees > 0
            ? Math.round((nbAvecResa / visitesTerminees) * 100)
            : 0;

        const visites = {
            resume: {
                total:            totalVisites,
                enAttente:        visitesParStatut.find(v => v._id === 'en attente de confirmation')?.count ?? 0,
                confirmees:       visitesConfirmees,
                terminees:        visitesTerminees,
                annulees:         visitesAnnulees,
                tauxConversion
            },
            parStatut: visitesParStatut.map(v => ({
                statut: v._id || 'Inconnu',
                count:  v.count
            })),
            mensuelles: visitesMois,
            parHeure:   visitesParHeure.map(v => ({
                heure: `${String(v._id).padStart(2,'0')}h`,
                count: v.count
            })),
            topLocaux: visitesParLocal.map(v => ({
                nom:   v.nom || 'Local inconnu',
                count: v.count
            }))
        };

        // ════════════════════════════════════════════════════════════════════
        // RÉPONSE FINALE
        // ════════════════════════════════════════════════════════════════════
        return res.json({
            generatedAt: new Date().toISOString(),
            kpis,
            finances,
            locaux,
            visites
        });

    } catch (err) {
        console.error('[GET /stats]', err);
        res.status(500).json({ message: 'Erreur serveur stats', error: err.message });
    }
});

module.exports = router;