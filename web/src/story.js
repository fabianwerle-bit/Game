// Texte: Zettel, Scheiben-Zettel, Ziele, Ende
export const NOTES = {
  todo: { t: 'Zettel am Schrank', x: 'Nicht vergessen:\n– Einkaufen im Dorfladen\n– Volltanken (Tankstelle, Nordost)\n– Fähre zurück: Freitag, 9 Uhr\n\nEndlich mal ein paar Tage Ruhe.' },
  shop: { t: 'Zettel an der Ladenkasse', x: 'Bin oben beim Leuchtturm.\nAlle sind beim Leuchtturm.\nNimm dir, was du brauchst.\n\n– H.' },
  pub: { t: 'Bierdeckel im Gasthaus', x: 'Er kommt jede Nacht die Straße runter.\nImmer dasselbe Auto. Nie nimmt er die Plane ab.\nWir haben aufgehört, die Türen abzuschließen.\nEs hilft nicht.' },
  house: { t: 'Tagebuchseite', x: 'Der Camper ist wieder da.\nSteht am Hafen, wie jedes Mal.\nDer Fahrer tut so, als kenne er uns nicht.\n\nIch habe aufgehört zu zählen.' },
  lightdoor: { t: 'Tür am Leuchtturm', x: 'Abgeschlossen.\nAuf einem Schild: »Schlüssel beim Hafenmeister.«' },
  officedoor: { t: 'Büro des Hafenmeisters', x: 'Abgeschlossen. Hinter der Scheibe klebt ein Zettel:\n»Bin übermorgen zurück.«' },
  office: { t: 'Notiz des Hafenmeisters', x: 'Fährbetrieb eingestellt. Es kommt keine Fähre mehr.\nEs ist nie eine gekommen.\n\nDen Leuchtturm-Schlüssel habe ich in die Kapelle gebracht.\nGeh da nicht nachts hin.' },
  chapel: { t: 'Zettel auf dem Altar', x: 'Du hast ihn wieder gefunden.\nDu findest ihn immer.\n\nBitte. Diesmal nicht.' },
  cabin: { t: 'Zettel in der Jagdhütte', x: 'Sechs Schuss sind drin.\nEs hält ihn auf. Für eine Nacht.\nTöten kannst du ihn nicht.\nIch habe es versucht.' },
  camp: { t: 'Nasser Zettel im Zelt', x: 'Wir sind zu Fuß los, zum Leuchtturm.\nDas Auto lassen wir stehen.\nWenn du das liest: Fahr nicht nachts.' },
};
export const WIND = {
  2: 'Schön, dass du wieder da bist.',
  3: 'Du schläfst so unruhig.\nIch habe eine Weile zugesehen.',
  4: 'Ich war letzte Nacht ganz nah.\nDu hast die Tür nicht abgeschlossen.\nDu schließt sie nie ab.',
  5: 'FAHR NICHT ZUM LEUCHTTURM\nFAHR NICHT ZUM LEUCHTTURM\nFAHR NICHT ZUM LEUCHTTURM',
  6: 'Sieh dir die Schrift an.\nSieh sie dir GENAU an.',
};
export const WAKE = {
  2: 'Der Morgen ist grau. An der Windschutzscheibe klemmt ein Zettel.',
  3: 'Es regnet. Wieder ein Zettel an der Scheibe.',
  4: 'In der Nacht hat etwas am Bus gekratzt. Der Zettel ist nass.',
  5: 'Du hast kaum geschlafen. Draußen hat jemand deinen Namen gesagt.',
  6: 'Es wird nicht mehr richtig hell.',
};
export function objective(S) {
  const n = S.notes;
  if (!n.includes('todo')) return 'Steig hinten in den Bus und sieh dich um.';
  if (!n.includes('shop')) return 'Fahr ins Dorf und besorg Vorräte im Laden.';
  if (!n.includes('lightdoor') && !n.includes('office')) return 'Alle sind beim Leuchtturm? Sieh nach. (Norden)';
  if (!n.includes('office')) return S.day < 3 ? 'Der Hafenmeister ist erst an Tag 3 zurück. Überlebe bis dahin.' : 'Zum Büro des Hafenmeisters am Hafen.';
  if (!S.key) return 'Der Schlüssel liegt in der Kapelle im Dorf.';
  return 'Zum Leuchtturm. Ruf über Funk um Hilfe.';
}
export const ENDING = [
  'Das Funkgerät rauscht.\nDann eine Stimme. Ruhig. Müde.',
  '»Tag 1. Ein paar ruhige Tage auf der Insel.«',
  'Es ist deine Stimme.',
  'An der Wand hängen Zettel. Hunderte.\n»Schön, dass du wieder da bist.«\n»Fahr nicht zum Leuchtturm.«',
  'Alle in deiner Handschrift.',
  'Du hast sie nicht bekommen.\nDu hast sie geschrieben.',
  'Jedes Mal, wenn du funkst, beginnt die Woche von vorn.\nNur einer von euch erinnert sich.',
  'Der Mann unter der Plane wollte dich nie töten.\nEr wollte dich aufhalten.',
  'Diesmal bist du der, der sich erinnert.',
];
