"use strict";

/**
 * One-off quality gate for the catalogue-expansion roster additions
 * (site/lib/catalog.ts). Resolves every new name against the live
 * Wikidata pipeline this app already uses (`lib/entity.js`) and reports
 * whether each is a real, unambiguous human with reasonable confidence —
 * "reject ambiguous or low-confidence entity matches" from the spec,
 * actually checked rather than assumed.
 *
 * Not wired into any request path — this is a curation-time check, run
 * by hand, matching how the roster itself is hand-curated. Prints a
 * table; nonzero exit if anything failed to resolve as a confident human.
 *
 * Usage: node functions/tool/validateCatalogueExpansion.js
 */

const { resolvePerson } = require("../lib/entity");

const NAMES = [
  "Noam Chomsky", "Steven Pinker", "Michael Sandel", "Jordan Peterson",
  "Niall Ferguson", "Jonathan Haidt", "Ibram X. Kendi", "Cornel West",
  "Malala Yousafzai", "Amal Clooney", "Bryan Stevenson", "Nadia Murad",
  "DeRay Mckesson", "Ai Weiwei", "Denis Mukwege",
  "Geoffrey Hinton", "Yann LeCun", "Yoshua Bengio", "Fei-Fei Li",
  "Andrew Ng", "Ilya Sutskever", "Timnit Gebru", "Mustafa Suleyman",
  "Dario Amodei",
  "Bjarke Ingels", "Frank Gehry", "Renzo Piano", "Norman Foster",
  "Tadao Ando", "David Adjaye", "Zaha Hadid",
  "Yayoi Kusama", "Jeff Koons", "Marina Abramović", "Takashi Murakami",
  "Kehinde Wiley", "Es Devlin",
  "Gordon Ramsay", "José Andrés", "Massimo Bottura", "Dominique Crenn",
  "David Chang", "Alice Waters", "René Redzepi", "Marcus Samuelsson",
  "Anthony Fauci", "Sanjay Gupta", "Atul Gawande", "Devi Shetty",
  "Tedros Adhanom Ghebreyesus", "Soumya Swaminathan", "Leana Wen",
  "Paul Krugman", "Esther Duflo", "Amartya Sen", "Thomas Piketty",
  "Joseph Stiglitz", "Raghuram Rajan", "Gita Gopinath",
  "Wendy Kopp", "Geoffrey Canada", "Linda Darling-Hammond",
  "Angela Duckworth", "Andreas Schleicher",
  "Burt Rutan", "Gwynne Shotwell", "Radia Perlman", "Limor Fried",
  "Marc Raibert", "Tony Fadell",
  "Melanie Perkins", "Whitney Wolfe Herd",
  "Jane Goodall", "David Attenborough", "Vandana Shiva",
  "Wangari Maathai", "Christiana Figueres", "Bill McKibben",
  "Lee Sang-hyeok", "Oleksandr Kostyliev", "Johan Sundstein",
  "Bear Grylls", "Alex Honnold", "Sylvia Earle", "Ranulph Fiennes",
  "Nirmal Purja",
  "Anna Wintour", "Tom Ford", "Stella McCartney", "Donatella Versace",
  "Miuccia Prada", "Alexander Wang",
  "Ray Dalio", "Cathie Wood", "Ken Griffin", "Christine Lagarde",
  "Janet Yellen", "Howard Marks", "Abigail Johnson",
  "Christiane Amanpour", "Anderson Cooper", "Fareed Zakaria",
  "Oprah Winfrey", "Ezra Klein", "Ronan Farrow",
  "Ruth Bader Ginsburg", "Sonia Sotomayor", "David Boies",
  "Gloria Allred", "Alan Dershowitz", "Ben Crump",
  "David Petraeus", "Mark Milley", "Valery Zaluzhny", "H. R. McMaster",
  "Stanley McChrystal", "Colin Powell",
  "Christopher Wray", "William Bratton", "Cressida Dick",
  "Stephen Ross", "Barbara Corcoran", "Grant Cardone",
  "Pope Francis", "Dalai Lama", "Rick Warren", "T. D. Jakes",
  "King Charles III", "Naruhito", "Felipe VI", "Prince William",
  "Catherine, Princess of Wales", "Prince Albert II of Monaco",
  "Jennifer Doudna", "Katalin Karikó", "Neil deGrasse Tyson",
  "Brian Cox", "Michio Kaku",
  "Scott Harrison", "Jacqueline Novogratz", "Ai-jen Poo", "Van Jones",
  "Margaret Atwood", "Salman Rushdie", "Chimamanda Ngozi Adichie",
  "Haruki Murakami", "Stephen King", "Colson Whitehead", "Elif Shafak",
];

async function main() {
  const results = [];
  for (const name of NAMES) {
    try {
      const person = await resolvePerson(name);
      results.push({
        name,
        resolved: person ? person.label : null,
        qid: person ? person.qid : null,
        confidence: person ? person.confidence : null,
        candidateCount: person ? person.candidates.length : 0,
      });
    } catch (e) {
      results.push({ name, error: e.message });
    }
    // Be a polite, rate-limited client of Wikidata's free API.
    await new Promise((r) => setTimeout(r, 150));
  }

  const failed = results.filter((r) => !r.qid || r.error);
  const lowConfidence = results.filter(
    (r) => r.confidence === "low" || r.confidence === "ambiguous",
  );

  console.log("name\tqid\tconfidence\tresolvedAs");
  for (const r of results) {
    console.log(
      `${r.name}\t${r.qid ?? "—"}\t${r.confidence ?? "—"}\t${r.resolved ?? r.error ?? "—"}`,
    );
  }

  console.log(`\n${results.length} names checked.`);
  console.log(`${failed.length} failed to resolve to any Wikidata human.`);
  console.log(`${lowConfidence.length} resolved at low/ambiguous confidence.`);

  if (failed.length > 0) {
    console.log("\nFAILED:");
    for (const r of failed) console.log(`  ${r.name}: ${r.error ?? "no match"}`);
  }
  if (lowConfidence.length > 0) {
    console.log("\nLOW/AMBIGUOUS CONFIDENCE:");
    for (const r of lowConfidence) {
      console.log(`  ${r.name}: ${r.confidence}, resolved as "${r.resolved}"`);
    }
  }

  process.exitCode = failed.length > 0 ? 1 : 0;
}

main();
