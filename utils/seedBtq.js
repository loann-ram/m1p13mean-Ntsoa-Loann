// seed/boutique.seed.js
// Lance avec : node seed/boutique.seed.js
// ─────────────────────────────────────────────────────────────────────────────
// Ce seed :
// 1. Cherche un client validé (ReponseDemande accepte) avec sa réservation
// 2. Crée une Boutique liée à son local
// 3. Crée des Catégories
// 4. Crée des Produits dans la boutique
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Utilisateur    = require('../model/Utilisateur');
const Local          = require('../model/Local');
const ReservationLocal = require('../model/ReservationLocal');
const DemandeClient  = require('../model/DemandeClient');
const ReponseDemande = require('../model/ResponseDm');
const Boutique       = require('../model/Boutique');
const Categorie      = require('../model/Categorie');
const Produit        = require('../model/Produit');

async function seed() {
    try {
        await mongoose.connect('mongodb://localhost:27017/CM_db');
        console.log('✅ MongoDB connecté');

        // ── ÉTAPE 1 : Trouver un client avec demande acceptée ──────────────────
        const reponse = await ReponseDemande.findOne({ statut: 'accepte' })
            .populate({
                path: 'demandeID',
                populate: { path: 'clientID' }
            })
            .lean();

        if (!reponse) {
            console.error('❌ Aucune demande acceptée trouvée. Valide d\'abord une demande.');
            process.exit(1);
        }

        const client = reponse.demandeID?.clientID;
        console.log(`✅ Client trouvé : ${client.email}`);

        // ── ÉTAPE 2 : Trouver la réservation confirmée du client ───────────────
        const reservation = await ReservationLocal
            .findOne({ clientId: client._id, status: 'Confirmée' })
            .populate('localeID')
            .lean();

        if (!reservation) {
            console.error('❌ Aucune réservation confirmée pour ce client.');
            process.exit(1);
        }

        const local = reservation.localeID;
        console.log(`✅ Local trouvé : ${local.nom_boutique} (${local.emplacement})`);

        // ── ÉTAPE 3 : Créer les catégories ────────────────────────────────────
        let categorie = await Categorie.findOne({ nom: 'Vêtements' });
        if (!categorie) {
            categorie = await Categorie.create({
                nom: 'Vêtements',
                sousCategories: [
                    { nom: 'Homme' },
                    { nom: 'Femme' },
                    { nom: 'Enfant' }
                ]
            });
            console.log('✅ Catégorie "Vêtements" créée');
        } else {
            console.log('ℹ️  Catégorie "Vêtements" déjà existante');
        }

        let categorie2 = await Categorie.findOne({ nom: 'Accessoires' });
        if (!categorie2) {
            categorie2 = await Categorie.create({
                nom: 'Accessoires',
                sousCategories: [
                    { nom: 'Sacs' },
                    { nom: 'Bijoux' },
                    { nom: 'Chaussures' }
                ]
            });
            console.log('✅ Catégorie "Accessoires" créée');
        } else {
            console.log('ℹ️  Catégorie "Accessoires" déjà existante');
        }

        // ── ÉTAPE 4 : Créer la boutique ───────────────────────────────────────
        let boutique = await Boutique.findOne({ local: local._id, is_active: true });
        if (!boutique) {
            boutique = await Boutique.create({
                utilisateurId: client._id,
                local: local._id,
                nom: `Boutique de ${client.email.split('@')[0]}`,
                description: 'Boutique créée automatiquement via seed',
                telephone: client.telephone || '034' + Math.floor(Math.random() * 9000000 + 1000000),
                logo: null,
                categories: [categorie._id, categorie2._id],
                horaires: [
                    { jour: 'Lundi',    is_open: true,  ouverture: '08:00', fermeture: '18:00' },
                    { jour: 'Mardi',    is_open: true,  ouverture: '08:00', fermeture: '18:00' },
                    { jour: 'Mercredi', is_open: true,  ouverture: '08:00', fermeture: '18:00' },
                    { jour: 'Jeudi',    is_open: true,  ouverture: '08:00', fermeture: '18:00' },
                    { jour: 'Vendredi', is_open: true,  ouverture: '08:00', fermeture: '17:00' },
                    { jour: 'Samedi',   is_open: true,  ouverture: '09:00', fermeture: '13:00' },
                    { jour: 'Dimanche', is_open: false }
                ],
                is_active: true
            });
            console.log(`✅ Boutique créée : ${boutique.nom} (ID: ${boutique._id})`);
        } else {
            console.log(`ℹ️  Boutique déjà existante : ${boutique.nom}`);
        }

        // ── ÉTAPE 5 : Créer des produits ─────────────────────────────────────
        const produitsExistants = await Produit.countDocuments({ boutiqueId: boutique._id });

        if (produitsExistants > 0) {
            console.log(`ℹ️  ${produitsExistants} produits déjà existants pour cette boutique`);
        } else {
            const sousCatHomme   = categorie.sousCategories.find(s => s.nom === 'Homme');
            const sousCatFemme   = categorie.sousCategories.find(s => s.nom === 'Femme');
            const sousCatSacs    = categorie2.sousCategories.find(s => s.nom === 'Sacs');
            const sousCatBijoux  = categorie2.sousCategories.find(s => s.nom === 'Bijoux');

            const produits = await Produit.insertMany([
                {
                    boutiqueId: boutique._id,
                    nom: 'T-shirt Classique Homme',
                    description: 'T-shirt en coton 100%, coupe classique',
                    prix: 25000,
                    images: ['tshirt-homme.jpg'],
                    categorieId: categorie._id,
                    sousCategorieId: sousCatHomme._id,
                    stock: 50,
                    is_disponible: true
                },
                {
                    boutiqueId: boutique._id,
                    nom: 'Robe Élégante Femme',
                    description: 'Robe légère pour toutes occasions',
                    prix: 75000,
                    images: ['robe-femme.jpg', 'robe-femme-2.jpg'],
                    categorieId: categorie._id,
                    sousCategorieId: sousCatFemme._id,
                    stock: 20,
                    is_disponible: true
                },
                {
                    boutiqueId: boutique._id,
                    nom: 'Sac à Main Cuir',
                    description: 'Sac en cuir véritable, plusieurs coloris',
                    prix: 120000,
                    images: ['sac-cuir.jpg'],
                    categorieId: categorie2._id,
                    sousCategorieId: sousCatSacs._id,
                    stock: 15,
                    is_disponible: true
                },
                {
                    boutiqueId: boutique._id,
                    nom: 'Collier Doré',
                    description: 'Collier plaqué or, résistant à l\'eau',
                    prix: 35000,
                    images: ['collier.jpg'],
                    categorieId: categorie2._id,
                    sousCategorieId: sousCatBijoux._id,
                    stock: 30,
                    is_disponible: true
                },
                {
                    boutiqueId: boutique._id,
                    nom: 'Jean Slim Homme',
                    description: 'Jean slim stretch, coupe moderne',
                    prix: 65000,
                    images: ['jean-slim.jpg'],
                    categorieId: categorie._id,
                    sousCategorieId: sousCatHomme._id,
                    stock: 0,           // ← stock épuisé pour tester
                    is_disponible: false // ← indisponible pour tester
                }
            ]);

            console.log(`✅ ${produits.length} produits créés`);
        }

        // ── RÉSUMÉ ────────────────────────────────────────────────────────────
        const produits = await Produit.find({ boutiqueId: boutique._id }).lean();

        console.log('\n═══════════════════════════════════════════════');
        console.log('📋 RÉSUMÉ DU SEED');
        console.log('═══════════════════════════════════════════════');
        console.log(`👤 Client     : ${client.email}`);
        console.log(`🏪 Local      : ${local.nom_boutique} (${local.emplacement})`);
        console.log(`🛍️  Boutique   : ${boutique.nom}`);
        console.log(`   ID boutique: ${boutique._id}`);
        console.log(`📦 Produits   : ${produits.length} produits`);
        console.log('───────────────────────────────────────────────');
        produits.forEach(p => {
            const dispo = p.is_disponible ? '✅' : '❌';
            console.log(`  ${dispo} ${p.nom} — ${p.prix.toLocaleString('fr-FR')} Ar — stock: ${p.stock} — ID: ${p._id}`);
        });
        console.log('═══════════════════════════════════════════════');
        console.log('\n✅ Seed terminé ! Tu peux maintenant tester le panier.\n');

        await mongoose.disconnect();
        process.exit(0);

    } catch (err) {
        console.error('❌ Erreur seed:', err.message);
        await mongoose.disconnect();
        process.exit(1);
    }
}

seed();