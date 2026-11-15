// Texte: Zettel, Scheiben-Zettel, Ziele, Ende
export const NOTES = {
  todo: { t: 'Zettel am Schrank', x: 'Nicht vergessen:\n– Inselkarte holen (Lagerhalle am Hafen)\n– Einkaufen im Dorfladen\n– Volltanken (Tankstelle, Nordost)\n– Fähre zurück: Freitag, 9 Uhr\n\nEndlich mal ein paar Tage Ruhe.' },
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
Object.assign(NOTES, {
  minesign: { t: 'Aushang am Bergwerk', x: 'Stollen 2 gesperrt.\nDie Hauptsicherung für Leuchtturm und Funk hängt jetzt unten in der Endkammer.\nNiemand geht mehr allein hinunter.\n\n– Betriebsleitung' },
  names: { t: 'Liste an der Stollenwand', x: 'DU\nH. Brandt\nM. Brandt\nJ. Okafor\nE. Lindqvist\nP. Maas\nA. Maas\nT. Wieck\nS. Jonas\n\nAlle durchgestrichen. Nur der oberste Name nicht.\nDaneben Striche. Sehr viele Striche.' },
  mine1: { t: 'Zettel in der Endkammer', x: 'Ohne die Sicherung kein Funk.\nOhne Funk kein neuer Anfang.\n\nNimm sie nicht mit.\nZerschieß den Kasten.\nDann ist es endlich vorbei.' },
  school: { t: 'Heft auf dem Lehrerpult', x: 'Die Kinder malen alle dasselbe.\nEin Auto unter einem Tuch.\nEin langer Mann daneben.\n\nIch habe gefragt, wer das ist.\n»Der, der aufpasst«, sagen sie.' },
  graves: { t: 'Die Grabsteine', x: 'Brandt. Okafor. Lindqvist. Maas. Wieck. Jonas.\n\nAcht Namen.\nAcht Mal derselbe Todestag.\nEs ist das Datum von morgen.' },
  grave: { t: 'Das offene Grab', x: 'Frisch ausgehoben. Leer.\nAuf dem Stein steht noch kein Name.\n\nDie Grube hat deine Größe.' },
  wreck: { t: 'Logbuch aus dem Wrack', x: 'Tag 9. Kurs Nord. Nebel.\nTag 10. Kurs Nord. Die Insel liegt wieder vor uns.\nTag 11. Kurs Süd. Die Insel liegt wieder vor uns.\n\nDer Leuchtturm hat uns nicht gewarnt.\nEr hat uns gerufen.' },
  mast: { t: 'Wartungsbuch am Sendemast', x: 'Es geht nur ein Signal raus. Immer dasselbe.\nEine Stimme, die »Tag 1« sagt.\n\nIch habe den Sender abgeschaltet.\nEs sendet trotzdem.' },
  islet: { t: 'Zettel in der Ruine', x: 'Hier draußen findet er mich nicht.\nAber die Vorräte reichen nicht.\nIch muss zurück.\n\nIch muss immer zurück.' },
  nofuse: { t: 'Das Funkgerät', x: 'Tot. Kein Strom.\nIm Sicherungskasten an der Wand fehlt die Hauptsicherung.\n\nAuf dem Kasten steht: »Ersatz: Bergwerk, Endkammer.«' },
});
export const TAPES = {
  school: ['Kassette. Rauschen. Dann deine Stimme.', '»Wenn du das hörst, hast du die Schule gefunden.«', '»Die Zeichnungen sind von mir. Ich wollte, dass du ihn erkennst.«', '»Er ist nicht dein Feind.«'],
  mine: ['Kassette. Tropfen. Atmen.', '»Ich bin wieder unten. Zum … ich weiß nicht, wievielten Mal.«', '»Jedes Mal nehme ich die Sicherung. Jedes Mal funke ich.«', '»Bitte. Hör diesmal auf den Zettel.«'],
  mast: ['Kassette. Wind.', '»Vom Mast aus sieht man die ganze Insel. Und sonst nichts.«', '»Kein Festland. Kein Schiff. Nur Nebel.«', '»Es gibt kein Draußen. Es gibt nur Freitag.«'],
  wreck: ['Kassette. Brandung.', '»Der Kapitän hat es mit dem Schiff versucht. Ich mit dem Boot.«', '»Man kommt immer am selben Steg an.«', '»Nur die Fähre fährt wirklich ab. Und sie nimmt nur einen mit.«'],
  islet: ['Kassette. Fast nur Rauschen.', '»Er jagt mich nicht. Er jagt die Sicherung.«', '»Er war einmal wie ich. Er hat einmal zu oft gefunkt.«', '»Wenn du ihn siehst – sieh dir sein Gesicht an.«'],
};
export const PHONE = { 2: ['Du hebst ab.', 'Atmen.', 'Dann legt jemand auf.'], 3: ['Du hebst ab.', '»… bist du noch da?«', 'Es ist deine eigene Stimme.'], 4: ['Du hebst ab.', '»Leg auf. Er hört mit.«', '»Er steht hinter der Kapelle.«'], 5: ['Du hebst ab.', '»Geh ins Bergwerk. Nicht zum Turm.«', '»Ich rufe dich jeden Tag an. Du hörst nie zu.«'] };
export const PHOTO = { 1: 'Ein Familienfoto. Vier Gesichter, alle lächeln.', 2: 'Ein Familienfoto. Vier Gesichter.', 3: 'Auf dem Foto ist ein Gesicht ausgekratzt.', 4: 'Zwei Gesichter fehlen. Gestern waren es noch drei.', 5: 'Die Familie ist fort. Am Rand steht jetzt jemand anderes. Du.' };
export const OMEN = { 3: 'Reifenspuren führen bis an den Bus. Sie waren gestern nicht da.', 4: 'Vor dem Bus steht ein Rollstuhl. Er zeigt auf deine Tür.', 5: 'Auf dem Dach sitzen Krähen. Sie rühren sich nicht.', 6: 'Jemand hat von außen in den Staub der Scheibe geschrieben: BALD.' };
export const ENDING_B = [
  'Der Schuss hallt durch den Stollen.\nFunken. Dann Dunkelheit.',
  'Über dir, irgendwo am Leuchtturm, geht ein Licht aus.',
  'Im Stollen steht jemand hinter dir.\nGroß. Still. Er hebt nicht die Hand.',
  '»Danke«, sagt er. Mit deiner Stimme.',
  'Als du oben ankommst, regnet es nicht mehr.',
  'Am Kai liegt die Fähre. Freitag, 9 Uhr.\nSie nimmt nur einen mit.',
  'Vom Deck aus siehst du den Hafen kleiner werden.\nEin Camper-Bus rollt auf den Kai.\nJemand steigt aus und sieht sich um.',
  'Du hast keine Zettel hinterlassen.\nVielleicht reicht das.',
];
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
  if (!n.includes('nofuse') && !S.fuse) return 'Zum Leuchtturm. Ruf über Funk um Hilfe.';
  if (!S.fuse) return 'Dem Funkgerät fehlt die Sicherung. Bergwerk, Endkammer.';
  return 'Du hast die Sicherung. Zum Leuchtturm – oder doch nicht?';
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
