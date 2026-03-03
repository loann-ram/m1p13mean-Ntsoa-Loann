const Visite = require('../model/Visite');
async function getDatesDispo(localId, month, year, day) {
    const monthOfDate = month || new Date().getMonth() + 1;
    const yearsOfDate = year || new Date().getFullYear();
    const dayDepart = day || 1;

    const debutMois = new Date(yearsOfDate, monthOfDate - 1,dayDepart );
    const finMois = new Date(yearsOfDate, monthOfDate, 0);

    const creneauxPossibles = [
        '09:00-10:00', '10:00-11:00', '11:00-12:00',
        '14:00-15:00', '15:00-16:00', '16:00-17:00', '17:00-18:00'
    ];

    const APidateferieResp = await fetch(
        `https://date.nager.at/api/v3/PublicHolidays/${yearsOfDate}/MG`
    );
    const joursFerier = await APidateferieResp.json();
    const joursFerierSet = new Set(joursFerier.map(j => j.date));

    const visiteThisMonth = await Visite.find({
        localeID: localId,
        date: { $gte: debutMois, $lte: finMois },
        status: { $ne: 'Annulée' }
    });

    const aujourd_hui = new Date();
    const jourDepart = (
        parseInt(yearsOfDate) === aujourd_hui.getFullYear() &&
        parseInt(monthOfDate) === aujourd_hui.getMonth() + 1
    ) ? aujourd_hui.getDate() : 1;

    const dateDispThisMonth = [];

    for (let jour = jourDepart; jour <= finMois.getDate(); ++jour) {
        const date = new Date(yearsOfDate, monthOfDate - 1, jour);
        const dateStr = date.toLocaleDateString('sv-SE');
        const jourSemaine = date.getDay();

        if (jourSemaine === 0 || jourSemaine === 6 || joursFerierSet.has(dateStr)) {
            continue;
        }

        const visitesJour = visiteThisMonth.filter(v =>
            v.date.toLocaleDateString('sv-SE') === dateStr
        );

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

    return dateDispThisMonth;
}

module.exports = getDatesDispo;