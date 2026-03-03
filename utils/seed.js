// seed-dossiers.js
const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });


const TypeDossier = require('../model/TypeDossier');
const DossierRequire = require('../model/DossierRequire');
const TypeClientex = require('../model/TypeClientex');

const INDIVIDU_DOCS = [
    {
        nom: "Pièce d'identité",
        description: "Carte d'identité nationale ou passeport valide. Permet de vérifier l'identité du locataire."
    },
    {
        nom: "Justificatif de domicile",
        description: "Facture récente (eau, électricité, internet) de moins de 3 mois. Confirme l'adresse actuelle."
    },
    {
        nom: "Justificatif de revenus",
        description: "Fiches de paie (3 derniers mois), attestation de travail ou déclaration de revenus. Permet d'évaluer la capacité de paiement."
    },
    {
        nom: "Dépôt de garantie",
        description: "Somme versée avant l'entrée dans les lieux. Sert de sécurité pour le propriétaire."
    }
];

const SOCIETE_DOCS = [
    {
        nom: "Statuts de la société",
        description: "Document officiel définissant la création et le fonctionnement de la société."
    },
    {
        nom: "Registre de commerce (RCS)",
        description: "Extrait d'immatriculation au registre de commerce. Prouve l'existence légale de l'entreprise."
    },
    {
        nom: "Numéro d'identification fiscale (NIF)",
        description: "Document fiscal prouvant que la société est enregistrée auprès des impôts."
    },
    {
        nom: "Pièce d'identité du gérant",
        description: "Carte d'identité ou passeport du représentant légal."
    },
    {
        nom: "Procès-verbal de nomination du gérant",
        description: "Document officiel désignant la personne autorisée à signer le contrat."
    },
    {
        nom: "Relevé bancaire professionnel",
        description: "Relevé bancaire du compte de la société (3 derniers mois)."
    },
    {
        nom: "Attestation de situation fiscale",
        description: "Certificat prouvant que la société est à jour dans ses obligations fiscales."
    }
];

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connecté à MongoDB');

        // ── 1. Récupérer les typeClientex INDIVIDU et SOCIETE
        const individu = await TypeClientex.findOne({ typeClientex: 'INDIVIDU' });
        const societe  = await TypeClientex.findOne({ typeClientex: 'SOCIETE' });

        if (!individu || !societe) {
            console.error('❌ TypeClientex INDIVIDU ou SOCIETE introuvable en base.');
            console.log('TypeClientex trouvés :', await TypeClientex.find());
            process.exit(1);
        }

        console.log('✅ INDIVIDU id :', individu._id);
        console.log('✅ SOCIETE  id :', societe._id);

        // ── 2. Créer les TypeDossier INDIVIDU
        console.log('\n📄 Création des TypeDossier INDIVIDU...');
        const individuDocIds = [];
        for (const doc of INDIVIDU_DOCS) {
            let existing = await TypeDossier.findOne({ nom: doc.nom });
            if (existing) {
                console.log(`  ⚠️  Déjà existant : ${doc.nom}`);
                individuDocIds.push(existing._id);
            } else {
                const created = await TypeDossier.create(doc);
                console.log(`  ✅ Créé : ${doc.nom}`);
                individuDocIds.push(created._id);
            }
        }

        // ── 3. Créer les TypeDossier SOCIETE
        console.log('\n🏢 Création des TypeDossier SOCIETE...');
        const societeDocIds = [];
        for (const doc of SOCIETE_DOCS) {
            let existing = await TypeDossier.findOne({ nom: doc.nom });
            if (existing) {
                console.log(`  ⚠️  Déjà existant : ${doc.nom}`);
                societeDocIds.push(existing._id);
            } else {
                const created = await TypeDossier.create(doc);
                console.log(`  ✅ Créé : ${doc.nom}`);
                societeDocIds.push(created._id);
            }
        }

        // ── 4. Créer DossierRequire pour INDIVIDU
        console.log('\n🔗 Création DossierRequire INDIVIDU...');
        const existingIndividu = await DossierRequire.findOne({ typeClientex: individu._id });
        if (existingIndividu) {
            await DossierRequire.findByIdAndUpdate(existingIndividu._id, {
                typeDocument: individuDocIds,
                obligatoire: true
            });
            console.log('  ⚠️  DossierRequire INDIVIDU déjà existant → mis à jour');
        } else {
            await DossierRequire.create({
                typeClientex: individu._id,
                typeDocument: individuDocIds,
                obligatoire: true
            });
            console.log('  ✅ DossierRequire INDIVIDU créé');
        }

        // ── 5. Créer DossierRequire pour SOCIETE
        console.log('\n🔗 Création DossierRequire SOCIETE...');
        const existingSociete = await DossierRequire.findOne({ typeClientex: societe._id });
        if (existingSociete) {
            await DossierRequire.findByIdAndUpdate(existingSociete._id, {
                typeDocument: societeDocIds,
                obligatoire: true
            });
            console.log('  ⚠️  DossierRequire SOCIETE déjà existant → mis à jour');
        } else {
            await DossierRequire.create({
                typeClientex: societe._id,
                typeDocument: societeDocIds,
                obligatoire: true
            });
            console.log('  ✅ DossierRequire SOCIETE créé');
        }

        console.log('\n🎉 Seed terminé avec succès !');
        process.exit(0);

    } catch (err) {
        console.error('❌ Erreur seed :', err);
        process.exit(1);
    }
}

seed();