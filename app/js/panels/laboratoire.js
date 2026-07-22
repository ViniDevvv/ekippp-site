import { createLabPanel } from '../lab-panel-factory.js';

export const { title, subtitle, render } = createLabPanel({
  category: 'laboratoire',
  title: 'Laboratoire',
  subtitle: 'Planning de production et historique',
  createHeading: "Aucun laboratoire pour l'instant",
  createHint: "Crée ton premier laboratoire pour commencer à planifier la production.",
  namePlaceholder: 'Ex: Tranquillisant',
  createButtonLabel: 'Créer le labo',
  emptyMemberMsg: "Aucun laboratoire n'a encore été créé par les responsables de l'organisation.",
  recipeCardTitle: 'Recette',
});
