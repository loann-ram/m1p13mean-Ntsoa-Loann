
const express = require('express');
const router  = express.Router();

const Local            = require('../Model/Local');
const Visite           = require('../Model/Visite');
const ReservationLocal = require('../Model/ReservationLocal');
const DemandeClient    = require('../Model/DemandeClient');
const PaiementLoyer    = require('../Model/PaiementLoyer');
const PaiementCommande = require('../Model/PaiementCommande');
const Commande         = require('../Model/Commande');
const Utilisateur      = require('../Model/Utilisateur');
const ReponseDemande   = require('../Model/ResponseDm');
const auth = require("../middleware/auth");
const toNum = (v) => {
    if (!v) return 0;
    if (typeof v === 'object' && v.$numberDecimal) return parseFloat(v.$numberDecimal);
    return parseFloat(v) || 0;
};
const getLast12Months = () => {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months;
};
router.get('/',auth, async (req, res) => {
    try {
        const now        = new Date();
        const moisActuel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const debutMois  = new Date(now.getFullYear(), now.getMonth(), 1);
        const debutAnnee = new Date(now.getFullYear(), 0, 1);
        const last12     = getLast12Months();
        const debut12    = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        const [

            allLocaux,
            totalClients,
            nouveauxClientsMois,
            clientsParType,
            visitesParStatut,
            visitesMensuelles,
            visitesParHeure,
            visitesParLocal,
            demandesParStatut,
            reservationsParStatut,
            loyersMensuelsBrut,
            loyersParStatut,
            loyersEnRetard,
            totalLoyersDus,
            totalLoyersPaies,
            loyersParMode,
            commandesParStatut,
            commandesMensuelles,
            totalCommandesMontant,
            commandesParMode,
            preuvesCmdenAttente,
            preuvesCmLoyerAttente,

        ] = await Promise.all([
            Local.find().lean(),

            Utilisateur.countDocuments({ roles: { $in: ['acheteur', 'boutique'] } }),
            Utilisateur.countDocuments({ inscription: { $gte: debutMois } }),
            Utilisateur.aggregate([
                { $unwind: '$roles' },
                { $match: { roles: { $in: ['acheteur', 'boutique'] } } },
                { $group: { _id: '$roles', count: { $sum: 1 } } }
            ]),

            Visite.aggregate([
                { $group: { _id: '$statut', count: { $sum: 1 } } }
            ]),
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

            Visite.aggregate([
                { $group: { _id: '$heure_debut', count: { $sum: 1 } } },
                { $sort: { '_id': 1 } }
            ]),
            Visite.aggregate([
                { $group: { _id: '$localeID', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 },
                { $lookup: { from: 'locals', localField: '_id', foreignField: '_id', as: 'local' } },
                { $unwind: { path: '$local', preserveNullAndEmptyArrays: true } },
                { $project: { nom: '$local.nom_boutique', count: 1 } }
            ]),
            DemandeClient.aggregate([
                { $group: { _id: '$statusDm', count: { $sum: 1 } } }
            ]),
            ReservationLocal.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
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
            PaiementLoyer.aggregate([
                { $group: { _id: '$statut', count: { $sum: 1 }, total: { $sum: '$montantDu' } } }
            ]),
            PaiementLoyer.countDocuments({ statut: { $in: ['en retard', 'impaye'] } }),
            PaiementLoyer.aggregate([
                { $group: { _id: null, total: { $sum: '$montantDu' } } }
            ]),
            PaiementLoyer.aggregate([
                { $group: { _id: null, total: { $sum: '$montantPaye' } } }
            ]),
            PaiementLoyer.aggregate([
                { $match: { statut: 'paye' } },
                { $group: { _id: '$modePaiement', count: { $sum: 1 }, total: { $sum: '$montantPaye' } } }
            ]),
            Commande.aggregate([
                { $group: { _id: '$statut', count: { $sum: 1 } } }
            ]),
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
            PaiementCommande.aggregate([
                { $match: { statut: 'paye' } },
                { $group: { _id: null, total: { $sum: '$montantPaye' } } }
            ]),
            PaiementCommande.aggregate([
                { $match: { statut: 'paye' } },
                { $group: { _id: '$modePaiement', count: { $sum: 1 }, total: { $sum: '$montantPaye' } } }
            ]),
            PaiementCommande.countDocuments({ statutPreuve: 'en_attente_validation' }),
            PaiementLoyer.countDocuments({ statutPreuve: 'en_attente_validation' }),
        ]);
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
        const loyersMoisMap = {};
        loyersMensuelsBrut.forEach(l => { loyersMoisMap[l._id] = l.totalPaye; });

        const loyersMensuels = last12.map(m => ({
            mois:  m,
            label: new Date(m + '-01').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
            total: loyersMoisMap[m] ?? 0
        }));
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
            loyersMensuels,     
            commandesMensuels: commandesMois, 

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
        const catMap = {};
        allLocaux.forEach(l => {
            const cat = l.categorie || 'Non défini';
            if (!catMap[cat]) catMap[cat] = { total: 0, disponibles: 0, loues: 0 };
            catMap[cat].total++;
            if (l.etat_boutique === 'disponible') catMap[cat].disponibles++;
            if (l.etat_boutique === 'louée')      catMap[cat].loues++;
        });
        const empMap = {};
        allLocaux.forEach(l => {
            const emp = l.emplacement || 'Non défini';
            if (!empMap[emp]) empMap[emp] = { total: 0, disponibles: 0, loues: 0 };
            empMap[emp].total++;
            if (l.etat_boutique === 'disponible') empMap[emp].disponibles++;
            if (l.etat_boutique === 'louée')      empMap[emp].loues++;
        });
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
        const totalVisites          = visitesParStatut.reduce((s, v) => s + v.count, 0);
        const visitesTerminees       = visitesParStatut.find(v => v._id === 'Terminée')?.count ?? 0;
        const visitesConfirmees      = visitesParStatut.find(v => v._id === 'Confirmée')?.count ?? 0;
        const visitesAnnulees        = visitesParStatut.find(v => v._id === 'Annulée')?.count ?? 0;

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
