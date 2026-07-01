import { GeometryType } from '../enums.js';

export interface DefaultCategoryConfig {
  id: number;
  name: { fr: string; en: string };
  slug: string;
  icon: string;
  color: string;
  order: number;
}

export interface DefaultLayerConfig {
  name: { fr: string; en: string };
  slug: string;
  categoryId: number;
  tagsOsm: string;
  geometryType: GeometryType;
}

export const defaultCategories: DefaultCategoryConfig[] = [
  { id: 1, name: { fr: 'Santé', en: 'Health' }, slug: 'sante', icon: 'local_hospital', color: '#e74c3c', order: 1 },
  { id: 2, name: { fr: 'Éducation', en: 'Education' }, slug: 'education', icon: 'school', color: '#3498db', order: 2 },
  { id: 3, name: { fr: 'Finance', en: 'Finance' }, slug: 'finance', icon: 'payments', color: '#2ecc71', order: 3 },
  { id: 4, name: { fr: 'Environnement', en: 'Environment' }, slug: 'environnement', icon: 'eco', color: '#27ae60', order: 4 },
  { id: 5, name: { fr: 'Commerce et Shopping', en: 'Commerce & Shopping' }, slug: 'commerce-shopping', icon: 'storefront', color: '#9b59b6', order: 5 },
  { id: 6, name: { fr: 'Restauration', en: 'Restauration' }, slug: 'restauration', icon: 'restaurant', color: '#e67e22', order: 6 },
  { id: 7, name: { fr: 'Hébergement', en: 'Accommodation' }, slug: 'hebergement', icon: 'hotel', color: '#f1c40f', order: 7 },
  { id: 8, name: { fr: 'Loisirs', en: 'Leisure' }, slug: 'loisirs', icon: 'sports_soccer', color: '#1abc9c', order: 8 },
  { id: 9, name: { fr: 'Administration et Institutions Publiques', en: 'Administration & Public Institutions' }, slug: 'administration-institutions-publiques', icon: 'account_balance', color: '#34495e', order: 9 },
  { id: 10, name: { fr: 'Automobile et Transport', en: 'Automobile & Transport' }, slug: 'automobile-transport', icon: 'directions_car', color: '#7f8c8d', order: 10 },
];

export const defaultLayers: DefaultLayerConfig[] = [
  // 1. Santé
  {
    name: { fr: 'Hôpitaux', en: 'Hospitals' },
    slug: 'hopitaux',
    categoryId: 1,
    tagsOsm: 'amenity=hospital',
    geometryType: GeometryType.POINT,
  },
  {
    name: { fr: 'Centres de Santé / Dispensaires', en: 'Health Centers / Clinics' },
    slug: 'centres-de-sante-dispensaires',
    categoryId: 1,
    tagsOsm: 'amenity=clinic',
    geometryType: GeometryType.POINT,
  },
  {
    name: { fr: 'Imagerie Médicale / Radiologie', en: 'Medical Imaging / Radiology' },
    slug: 'imagerie-medicale-radiologie',
    categoryId: 1,
    tagsOsm: 'healthcare=radiologist',
    geometryType: GeometryType.POINT,
  },
  {
    name: { fr: 'Maternité / Sage-femme', en: 'Maternity / Midwife' },
    slug: 'maternite-sage-femme',
    categoryId: 1,
    tagsOsm: 'healthcare=midwife',
    geometryType: GeometryType.POINT,
  },
  {
    name: { fr: 'Nutrition et Diététique', en: 'Nutrition & Dietetics' },
    slug: 'nutrition-dietetique',
    categoryId: 1,
    tagsOsm: 'healthcare=nutritionist',
    geometryType: GeometryType.POINT,
  },

  // 2. Éducation
  {
    name: { fr: 'École Primaire', en: 'Primary School' },
    slug: 'ecole-primaire',
    categoryId: 2,
    tagsOsm: 'amenity=school',
    geometryType: GeometryType.POINT,
  },
  {
    name: { fr: 'École Maternelle', en: 'Kindergarten' },
    slug: 'ecole-maternelle',
    categoryId: 2,
    tagsOsm: 'amenity=kindergarten',
    geometryType: GeometryType.POINT,
  },
  {
    name: { fr: 'Université / Enseignement Supérieur', en: 'University / Higher Education' },
    slug: 'universite-enseignement-superieur',
    categoryId: 2,
    tagsOsm: 'amenity=university',
    geometryType: GeometryType.POINT,
  },
  {
    name: { fr: 'Bibliothèque Universitaire', en: 'University Library' },
    slug: 'bibliotheque-universitaire',
    categoryId: 2,
    tagsOsm: 'amenity=library',
    geometryType: GeometryType.POINT,
  },
  {
    name: { fr: 'Centre de Formation Professionnelle', en: 'Vocational Training Center' },
    slug: 'centre-formation-professionnelle',
    categoryId: 2,
    tagsOsm: 'office=educational_institution',
    geometryType: GeometryType.POINT,
  },

  // 3. Finance
  {
    name: { fr: 'Distributeur Automatique de Billets (ATM)', en: 'Automated Teller Machine (ATM)' },
    slug: 'atm-distributeurs',
    categoryId: 3,
    tagsOsm: 'amenity=atm',
    geometryType: GeometryType.POINT,
  },
  {
    name: { fr: 'Microfinance', en: 'Microfinance' },
    slug: 'microfinance',
    categoryId: 3,
    tagsOsm: 'office=financial;finance=microcredit',
    geometryType: GeometryType.POINT,
  },
  {
    name: { fr: 'Bourse / Marché Financier', en: 'Stock Exchange / Financial Market' },
    slug: 'bourse-marche-financier',
    categoryId: 3,
    tagsOsm: 'office=financial',
    geometryType: GeometryType.POINT,
  },
  {
    name: { fr: 'Coopérative d\'Épargne et de Crédit', en: 'Savings and Credit Cooperative' },
    slug: 'cooperative-epargne-credit',
    categoryId: 3,
    tagsOsm: 'office=financial;finance=credit_union',
    geometryType: GeometryType.POINT,
  },
  {
    name: { fr: 'Mobile Money / Transfert d\'Argent Mobile', en: 'Mobile Money Transfer' },
    slug: 'mobile-money',
    categoryId: 3,
    tagsOsm: 'office=financial;service=mobile_money',
    geometryType: GeometryType.POINT,
  },

  // 4. Environnement
  {
    name: { fr: 'Espaces Verts et Parcs Urbains', en: 'Green Spaces and Urban Parks' },
    slug: 'espaces-verts-parcs',
    categoryId: 4,
    tagsOsm: 'leisure=park',
    geometryType: GeometryType.POLYGON,
  },
  {
    name: { fr: 'Gestion des Déchets / Recyclage', en: 'Waste Management / Recycling' },
    slug: 'gestion-dechets-recyclage',
    categoryId: 4,
    tagsOsm: 'amenity=recycling',
    geometryType: GeometryType.POINT,
  },
  {
    name: { fr: 'Stations d\'Épuration / Traitement des Eaux', en: 'Wastewater Treatment Plants' },
    slug: 'stations-epuration',
    categoryId: 4,
    tagsOsm: 'man_made=wastewater_plant',
    geometryType: GeometryType.POLYGON,
  },
  {
    name: { fr: 'Réserves Naturelles / Aires Protégées', en: 'Nature Reserves / Protected Areas' },
    slug: 'reserves-naturelles-aires-protegees',
    categoryId: 4,
    tagsOsm: 'leisure=nature_reserve',
    geometryType: GeometryType.POLYGON,
  },
  {
    name: { fr: 'Stations de Mesure de la Qualité de l\'Air', en: 'Air Quality Monitoring Stations' },
    slug: 'qualite-air-stations',
    categoryId: 4,
    tagsOsm: 'man_made=monitoring_station',
    geometryType: GeometryType.POINT,
  },

  // 5. Commerce et Shopping
  {
    name: { fr: 'Librairie', en: 'Bookstore' },
    slug: 'librairie',
    categoryId: 5,
    tagsOsm: 'shop=books',
    geometryType: GeometryType.POINT,
  },
  {
    name: { fr: 'Marché Local', en: 'Local Market' },
    slug: 'marche-local',
    categoryId: 5,
    tagsOsm: 'amenity=marketplace',
    geometryType: GeometryType.POINT,
  },
  {
    name: { fr: 'Animalerie', en: 'Pet Shop' },
    slug: 'animalerie',
    categoryId: 5,
    tagsOsm: 'shop=pet',
    geometryType: GeometryType.POINT,
  },
  {
    name: { fr: 'Cordonnerie', en: 'Shoe Repair' },
    slug: 'cordonnerie',
    categoryId: 5,
    tagsOsm: 'shop=shoe_repair',
    geometryType: GeometryType.POINT,
  },
  {
    name: { fr: 'Magasin Bio / Produits Naturels', en: 'Organic Shop / Natural Products' },
    slug: 'magasin-bio',
    categoryId: 5,
    tagsOsm: 'shop=organic',
    geometryType: GeometryType.POINT,
  },

  // 6. Restauration
  {
    name: { fr: 'Pub / Brasserie Artisanale', en: 'Pub / Craft Brewery' },
    slug: 'pub-brasserie',
    categoryId: 6,
    tagsOsm: 'amenity=pub',
    geometryType: GeometryType.POINT,
  },
  {
    name: { fr: 'Food Truck / Restauration Ambulante', en: 'Food Truck / Mobile Fast Food' },
    slug: 'food-truck',
    categoryId: 6,
    tagsOsm: 'amenity=fast_food;mobile=yes',
    geometryType: GeometryType.POINT,
  },
  {
    name: { fr: 'Traiteur Événementiel / Salle de Réception', en: 'Event Catering / Reception Hall' },
    slug: 'traiteur-evenementiel',
    categoryId: 6,
    tagsOsm: 'amenity=events_venue',
    geometryType: GeometryType.POINT,
  },
  {
    name: { fr: 'Bar à Chicha / Lounge', en: 'Shisha Bar / Lounge' },
    slug: 'bar-chicha-lounge',
    categoryId: 6,
    tagsOsm: 'amenity=bar',
    geometryType: GeometryType.POINT,
  },
  {
    name: { fr: 'Cave à Vin / Bar à Vin', en: 'Wine Cellar / Wine Bar' },
    slug: 'cave-a-vin',
    categoryId: 6,
    tagsOsm: 'shop=wine',
    geometryType: GeometryType.POINT,
  },

  // 7. Hébergement
  {
    name: { fr: 'Résidence Meublée / Appart\'Hôtel', en: 'Furnished Apartment / Aparthotel' },
    slug: 'residence-meublee-apparthotel',
    categoryId: 7,
    tagsOsm: 'tourism=apartment',
    geometryType: GeometryType.POINT,
  },
  {
    name: { fr: 'Chambre d\'Hôtes', en: 'Guest House' },
    slug: 'chambre-dhotes',
    categoryId: 7,
    tagsOsm: 'tourism=guest_house',
    geometryType: GeometryType.POINT,
  },
  {
    name: { fr: 'Auberge de Jeunesse', en: 'Hostel' },
    slug: 'auberge-jeunesse',
    categoryId: 7,
    tagsOsm: 'tourism=hostel',
    geometryType: GeometryType.POINT,
  },
  {
    name: { fr: 'Camping', en: 'Camp Site' },
    slug: 'camping',
    categoryId: 7,
    tagsOsm: 'tourism=camp_site',
    geometryType: GeometryType.POLYGON,
  },
  {
    name: { fr: 'Motel', en: 'Motel' },
    slug: 'motel',
    categoryId: 7,
    tagsOsm: 'tourism=motel',
    geometryType: GeometryType.POINT,
  },

  // 8. Loisirs
  {
    name: { fr: 'Parc d\'Attractions', en: 'Theme Park' },
    slug: 'parc-attractions',
    categoryId: 8,
    tagsOsm: 'tourism=theme_park',
    geometryType: GeometryType.POLYGON,
  },
  {
    name: { fr: 'Zoo / Parc Animalier', en: 'Zoo / Animal Park' },
    slug: 'zoo-parc-animalier',
    categoryId: 8,
    tagsOsm: 'tourism=zoo',
    geometryType: GeometryType.POLYGON,
  },
  {
    name: { fr: 'Piscine Publique / Complexe Aquatique', en: 'Public Swimming Pool / Aquatics Center' },
    slug: 'piscine-publique',
    categoryId: 8,
    tagsOsm: 'leisure=swimming_pool',
    geometryType: GeometryType.POLYGON,
  },
  {
    name: { fr: 'Terrain de Sport / Stade', en: 'Sports Field / Stadium' },
    slug: 'terrain-sport-stade',
    categoryId: 8,
    tagsOsm: 'leisure=stadium',
    geometryType: GeometryType.POLYGON,
  },
  {
    name: { fr: 'Aire de Jeux pour Enfants', en: 'Children\'s Playground' },
    slug: 'aire-jeux-enfants',
    categoryId: 8,
    tagsOsm: 'leisure=playground',
    geometryType: GeometryType.POLYGON,
  },

  // 9. Administration et Institutions Publiques
  {
    name: { fr: 'Mairies / Communes', en: 'Town Hall / Municipality' },
    slug: 'mairies-communes',
    categoryId: 9,
    tagsOsm: 'amenity=townhall',
    geometryType: GeometryType.POINT,
  },
  {
    name: { fr: 'Tribunaux', en: 'Courthouse' },
    slug: 'tribunaux',
    categoryId: 9,
    tagsOsm: 'amenity=courthouse',
    geometryType: GeometryType.POINT,
  },
  {
    name: { fr: 'Police et Gendarmerie', en: 'Police and Gendarmerie' },
    slug: 'police-gendarmerie',
    categoryId: 9,
    tagsOsm: 'amenity=police',
    geometryType: GeometryType.POINT,
  },
  {
    name: { fr: 'Préfectures', en: 'Prefectures' },
    slug: 'prefectures',
    categoryId: 9,
    tagsOsm: 'office=government',
    geometryType: GeometryType.POINT,
  },
  {
    name: { fr: 'Services des Impôts', en: 'Tax Services' },
    slug: 'services-impots',
    categoryId: 9,
    tagsOsm: 'office=government;government=tax',
    geometryType: GeometryType.POINT,
  },

  // 10. Automobile et Transport
  {
    name: { fr: 'Gare Routière / Station de Bus', en: 'Bus Station' },
    slug: 'gare-routiere-bus',
    categoryId: 10,
    tagsOsm: 'amenity=bus_station',
    geometryType: GeometryType.POINT,
  },
  {
    name: { fr: 'Aéroport', en: 'Airport' },
    slug: 'aeroport',
    categoryId: 10,
    tagsOsm: 'aeroway=aerodrome',
    geometryType: GeometryType.POLYGON,
  },
  {
    name: { fr: 'Port / Embarcadère', en: 'Port / Ferry Terminal' },
    slug: 'port-embarcadere',
    categoryId: 10,
    tagsOsm: 'amenity=ferry_terminal',
    geometryType: GeometryType.POINT,
  },
  {
    name: { fr: 'Gare Ferroviaire', en: 'Railway Station' },
    slug: 'gare-ferroviaire',
    categoryId: 10,
    tagsOsm: 'railway=station',
    geometryType: GeometryType.POINT,
  },
  {
    name: { fr: 'Location de Véhicules', en: 'Car Rental' },
    slug: 'location-vehicules',
    categoryId: 10,
    tagsOsm: 'amenity=car_rental',
    geometryType: GeometryType.POINT,
  },
];
