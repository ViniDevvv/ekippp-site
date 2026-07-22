import { createLabPanel } from '../lab-panel-factory.js';

export const { title, subtitle, render } = createLabPanel({
  category: 'recolte',
  title: 'Récolte',
  subtitle: 'Collecte de matières premières et historique',
  createHeading: "Aucun point de récolte pour l'instant",
  createHint: "Crée ton premier point de récolte pour commencer à planifier la collecte.",
  namePlaceholder: 'Ex: Champ de cannabis',
  createButtonLabel: 'Créer le point de récolte',
  emptyMemberMsg: "Aucun point de récolte n'a encore été créé par les responsables de l'organisation.",
  recipeCardTitle: 'Matériel requis',
});
