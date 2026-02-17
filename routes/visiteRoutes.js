const express = require('express');
const router = express.Router();
const Visite = require('../model/Visite');
const Local = require('../model/Local');
//Afficher all visite
router.get('/all-visite', async function (req, res) {
    const AllVisite = await Visite.find();
    res.json(AllVisite);
});
//Afficher all visite pour un local donnée
router.get('/visite-local/:localId', async function (req, res) {
    try {
        const visites = await Visite.find({
            local_id: req.params.localId,
            status: { $ne: 'Annulée' }  // Exclure les annulées
        }).sort({ date: 1, heure_debut: 1 });

        res.json(visites);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
//Afficher all visite non annulé
router.get('/all-visite', async function (req, res) {
    try{
    const visites = await Visite.find({
        status: { $ne: 'Annulée' }  // Exclure les annulées
    });
    res.json(visites);
    }catch(error){
        res.status(500).json({ message: error.message });
    }
});
//Afficher les dates de visites disponibles
router.get('/date-visite-disponibles/:localId/:month/:year', async (req, res) => {
  try{
    const monthOfDate = req.params.month;
  const yearsOfDate = req.params.year;
  const debutMois = new Date(yearsOfDate, monthOfDate-1,1);
  //console.log("debut de mois"+debutMois);
  const finMois = new Date(yearsOfDate, monthOfDate,0);
    //console.log("fin de mois"+finMois);
    const creneauxPossibles = [
        '09:00-10:00', '10:00-11:00', '11:00-12:00',
        '14:00-15:00', '15:00-16:00', '16:00-17:00', '17:00-18:00'
    ];

    const visiteThisMonth = await Visite.find({
        localeID:req.params.localId,
        date:{$gte: debutMois,$lte: finMois},
        status:{$ne: 'Annulée'}
    })

const dateDispThisMonth = [];
    for (let jour = 1; jour <= finMois.getDate(); ++jour) {
        const date = new Date(yearsOfDate, monthOfDate - 1, jour);
        //console.log(date);
        const dateStr = date.toLocaleDateString('sv-SE');
        //console.log(dateStr);

        // Visites déjà réservées ce jour
        const visitesJour = visiteThisMonth.filter(v =>
            v.date.toLocaleDateString('sv-SE') === dateStr
        );
        // Trouver les créneaux disponibles
        const creneauxDisponibles = creneauxPossibles.filter(creneau => {
            const [heureDebut] = creneau.split('-');
            const heureSimple = heureDebut.split(':')[0];
            return !visitesJour.some(v => v.heure_debut === heureSimple);
        });
        if (creneauxDisponibles.length > 0) {
            dateDispThisMonth.push({
                date: dateStr,
                creneaux_disponibles: creneauxDisponibles
            });
        }
    }

    res.json(dateDispThisMonth);

} catch (error) {
      res.status(500).json({ message: error.message });

  }
});
//Creation d'une visite de locale
// Réserver une visite
router.post('/Reserved-visit', async (req, res) => {
    try {
        // Vérifier si le local existe et est disponible
        const localID = await req.body.localeID
        const local = await Local.findById(localID)
        console.log(localID);
        console.log(local);
        console.log(local.etat_boutique);

        if (!local) {
            return res.status(404).json({ message: 'Local non trouvé' });
        }

        if (local.etat_boutique !== 'disponible') {
            return res.status(400).json({ message: 'Ce local n\'est plus disponible' });
        }

        // Créer la visite
        const nouvelleVisite = new Visite({
            localeID: req.body.localeID,
            client: req.body.client,
            date: req.body.date,
            heure_debut: req.body.heure_debut,
            heure_fin: req.body.heure_fin,
        });

        const visiteSauvegardee = await nouvelleVisite.save();
        res.status(201).json(visiteSauvegardee);

    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Annuler une visite
router.patch('/:id/annuler', async (req, res) => {
    try {
        const visite = await Visite.findByIdAndUpdate(
            req.params.id,
            { statut: 'annulée' },
            { new: true }
        );

        if (!visite) {
            return res.status(404).json({ message: 'Visite non trouvée' });
        }

        res.json(visite);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});
module.exports = router;