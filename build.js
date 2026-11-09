// Genera el sitio estático en la carpeta "dist" a partir de carreras.json, plantilla.html y privacidad.html.
// Netlify lo ejecuta en cada despliegue (ver netlify.toml). Para probarlo en local: node build.js
const fs = require("fs");
const SITE = (process.env.URL || process.env.SITE_URL || "https://TU-DOMINIO.com").replace(/\/$/, "");
const OUT = "dist";

// Disciplinas y países. Si añades una nueva, añádela aquí (clave: texto en cada idioma).
const D = {
  velocidad: { es: "Velocidad", en: "Speed" },
  maraton: { es: "Maratón", en: "Marathon" },
  popular: { es: "Carrera popular", en: "Fun race" },
  artistico: { es: "Artístico", en: "Artistic" },
  derby: { es: "Roller derby", en: "Roller derby" },
};
const CN = {
  ES: { es: "España", en: "Spain" }, KR: { es: "Corea del Sur", en: "South Korea" },
  TW: { es: "Taiwán", en: "Taiwan" }, US: { es: "Estados Unidos", en: "United States" },
  DE: { es: "Alemania", en: "Germany" },
};

const T = {
  es: {
    navCal: "Calendario", navSend: "Enviar una carrera", foot: "Una web independiente sobre patinaje.", priv: "Política de privacidad",
    date: "Fecha", place: "Lugar", disc: "Disciplina", more: "Más información", back: "← Volver al calendario",
    tbc: "Fecha por confirmar: la organización aún no ha publicado esta edición.",
    missing: "¿Falta alguna carrera?", send: "Envíanosla.", listH: "Carreras de patines por año", otherYears: "Otros años",
    yearLink: (y) => `Carreras de patines ${y}`,
    homeTitle: "Rollerio: calendario de carreras de patines y patinaje en línea",
    homeDesc: "Calendario de carreras de patines y patinaje en línea en España y en el mundo, con fechas, ciudades y enlaces. Velocidad, maratón, artístico y roller derby.",
    yearTitle: (y) => `Carreras de patines ${y}: calendario de patinaje en línea | Rollerio`,
    yearDesc: (y, n) => `Calendario de carreras de patines y patinaje en línea en ${y}: ${n} ${n === 1 ? "carrera" : "carreras"} con fecha, ciudad y enlace de información.`,
    yearLead: (y) => `Fechas, ciudades y enlaces de las carreras de patinaje que hemos recogido para ${y}.`,
    raceTitle: (n, y) => `${n} ${y}: fecha e información | Rollerio`,
    raceDesc: (n, d, c) => `${n}: carrera de patinaje el ${d} en ${c}. Fecha, lugar, disciplina y enlace de información.`,
    privTitle: "Política de privacidad | Rollerio",
  },
  en: {
    navCal: "Calendar", navSend: "Submit a race", foot: "An independent site about skating.", priv: "Privacy policy",
    date: "Date", place: "Location", disc: "Discipline", more: "More info", back: "← Back to the calendar",
    tbc: "Date to be confirmed: the organizers have not yet published this edition.",
    missing: "Is a race missing?", send: "Send it to us.", listH: "Inline skating races by year", otherYears: "Other years",
    yearLink: (y) => `Inline skating races ${y}`,
    homeTitle: "Rollerio: inline skating race calendar",
    homeDesc: "Calendar of inline skating and roller races in Spain and around the world, with dates, cities and links. Speed, marathon, artistic and roller derby.",
    yearTitle: (y) => `Inline skating races ${y}: race calendar | Rollerio`,
    yearDesc: (y, n) => `Inline skating race calendar for ${y}: ${n} ${n === 1 ? "race" : "races"} with date, city and info link.`,
    yearLead: (y) => `Dates, cities and links for the skating races we have collected for ${y}.`,
    raceTitle: (n, y) => `${n} ${y}: date and info | Rollerio`,
    raceDesc: (n, d, c) => `${n}: skating race on ${d} in ${c}. Date, location, discipline and info link.`,
    privTitle: "Privacy policy | Rollerio",
  },
};

const P = {
  home: (l) => (l === "es" ? "/" : "/en/"),
  race: (r, l) => (l === "es" ? `/carreras/${r.id}/` : `/en/races/${r.id}/`),
  year: (y, l) => (l === "es" ? `/carreras-patines-${y}/` : `/en/inline-skating-races-${y}/`),
  priv: (l) => (l === "es" ? "/privacidad/" : "/en/privacy/"),
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const js = (o) => JSON.stringify(o).replace(/</g, "\\u003c");
const fmt = (d, l, long) =>
  new Intl.DateTimeFormat(l, { timeZone: "UTC", day: "numeric", month: "long", year: "numeric", ...(long ? { weekday: "long" } : {}) }).format(new Date(d + "T00:00:00Z"));

// ---- datos y validación
const races = JSON.parse(fs.readFileSync("carreras.json", "utf8")).sort((a, b) => a.d.localeCompare(b.d));
const ids = new Set();
for (const r of races) {
  for (const f of ["id", "d", "n", "city", "c", "k", "s"]) if (!r[f]) throw new Error(`Falta el campo "${f}" en una carrera (${r.id || r.n?.es || "sin id"})`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.d)) throw new Error(`Fecha no válida en ${r.id}: usa AAAA-MM-DD`);
  if (!CN[r.c]) throw new Error(`País "${r.c}" (${r.id}) no está en la lista CN de build.js`);
  if (!D[r.k]) throw new Error(`Disciplina "${r.k}" (${r.id}) no está en la lista D de build.js`);
  if (!r.n.es || !r.n.en) throw new Error(`Falta el nombre en español o inglés en ${r.id}`);
  if (ids.has(r.id)) throw new Error(`Id repetido: ${r.id}`);
  ids.add(r.id);
}
const years = [...new Set(races.map((r) => r.d.slice(0, 4)))];

// ---- plantilla
let tpl = fs.readFileSync("plantilla.html", "utf8");
const css = tpl.match(/<style>([\s\S]*?)<\/style>/)[1];
const L = new Function(tpl.match(/const L=\{[\s\S]*?\]\}\};/)[0] + ";return L;")();
const jsRaces = races.map((r) => ({ d: r.d, n: r.n, s: r.s, city: r.city, c: r.c, k: r.k, u: r.u, p: { es: P.race(r, "es"), en: P.race(r, "en") } }));
tpl = tpl.replace("__RACES__", () => js(jsRaces)).replace("__D__", () => js(D)).replace("__CN__", () => js(CN));

const extraCss = `
.hero.mini{padding:6.5rem 0 2.5rem}.hero.mini h1{font-size:clamp(1.8rem,5vw,2.8rem);max-width:none}
.lang a{color:#fff;font:700 .75rem "Plus Jakarta Sans",sans-serif;padding:.3rem .65rem;border-radius:999px;text-decoration:none}
.lang a[aria-current]{background:var(--acc);color:var(--acc-ink)}.links .lang a{display:inline-block}
.seo{padding:2.5rem 0}.seo ul,.list{list-style:none;padding:0;margin:0}.seo li{padding:.5rem 0;border-bottom:1px solid var(--line)}
.seo li span{color:var(--muted);font-size:.9rem;display:block}.seo h3{margin:1.4rem 0 .3rem}.seo a,.inner a{color:var(--acc)}
.inner{padding:2.5rem 0 3rem}.inner .w{max-width:46rem}.inner .btn.acc{color:var(--acc-ink)}
.facts{display:grid;grid-template-columns:auto 1fr;gap:.4rem 1.2rem;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:1rem 1.2rem}
.facts dt{color:var(--muted)}.facts dd{margin:0;font-weight:500}
.warn{background:var(--soft);border-left:4px solid var(--acc);padding:.7rem 1rem;border-radius:6px;margin:1rem 0}
.legal h2{font-size:1.1rem;margin:1.6rem 0 .3rem}.legal .meta{color:var(--muted);font-size:.9rem}.ph{background:#FFF3B0;color:#3A2E00;border-radius:4px;padding:0 .25rem}
`;

// ---- piezas comunes
const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E🛼%3C/text%3E%3C/svg%3E";
const head = ({ title, desc, path, alt, ld }) => `<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}${path}">
<link rel="alternate" hreflang="es" href="${SITE}${alt.es}">
<link rel="alternate" hreflang="en" href="${SITE}${alt.en}">
<link rel="alternate" hreflang="x-default" href="${SITE}${alt.es}">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${SITE}${path}">
<meta property="og:image" content="${SITE}/hero.jpg"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${FAVICON}">${ld ? `\n<script type="application/ld+json">${js(ld)}</script>` : ""}`;
const langToggle = (l, alt) =>
  `<div class="lang" role="group" aria-label="Idioma / Language">${["en", "es"].map((x) => `<a href="${alt[x]}" hreflang="${x}"${x === l ? ' aria-current="true"' : ""}>${x.toUpperCase()}</a>`).join("")}</div>`;
const prefill = (h, t) =>
  h.replace(/(<(\w+)[^>]*\sdata-t="(\w+)"[^>]*>)(<\/\2>)/g, (m, open, tag, key, close) => (t[key] !== undefined ? open + esc(t[key]) + close : m))
   .replace('<h3 id="sideH"></h3>', () => `<h3 id="sideH">${esc(t.sideAll)}</h3>`);
const FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700;800&display=swap">';

const out = [];
const sitemap = [];
const write = (urlPath, html) => {
  const dir = OUT + urlPath;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dir + "index.html", html);
  out.push(urlPath);
};

const shell = ({ l, title, desc, path, alt, ld, h1, sub, body }) => `<!DOCTYPE html>
<html lang="${l}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${head({ title, desc, path, alt, ld })}
${FONTS}
<style>${css}${extraCss}</style></head><body>
<nav><div class="w"><a class="logo" href="${P.home(l)}"><i aria-hidden="true">≋</i>Rollerio</a>
<div class="links"><a href="${P.home(l)}">${T[l].navCal}</a><a href="${P.home(l)}#enviar">${T[l].navSend}</a>${langToggle(l, alt)}</div></div></nav>
<header class="hero mini"><div class="w"><h1>${h1}</h1>${sub ? `<p>${sub}</p>` : ""}</div></header>
<main class="inner"><div class="w">${body}</div></main>
<footer><div class="w">${T[l].foot} · <a href="${P.priv(l)}">${T[l].priv}</a></div></footer>
</body></html>`;

const raceLine = (r, l) => `${fmt(r.d, l)} · ${esc(r.city)}, ${CN[r.c][l]}`;

// ---- portada (ES y EN)
const seoSection = (l) => `<section id="listado" class="seo"><div class="w"><h2>${T[l].listH}</h2>
<p>${years.map((y) => `<a href="${P.year(y, l)}">${T[l].yearLink(y)}</a>`).join(" · ")}</p>
${years.map((y) => `<h3>${y}</h3><ul>${races.filter((r) => r.d.startsWith(y)).map((r) => `<li><a href="${P.race(r, l)}">${esc(r.n[l])}</a><span>${raceLine(r, l)}</span></li>`).join("")}</ul>`).join("")}
</div></section>`;
for (const l of ["es", "en"]) {
  const alt = { es: P.home("es"), en: P.home("en") };
  let h = tpl.replace('<html lang="es">', `<html lang="${l}">`)
    .replace("<!--HEAD-->", () => head({ title: T[l].homeTitle, desc: T[l].homeDesc, path: alt[l], alt }))
    .replace("<!--LANG-->", () => langToggle(l, alt))
    .replace("<!--SEO-->", () => seoSection(l))
    .replace("</style>", () => extraCss + "</style>")
    .split("__PRIV__").join(P.priv(l));
  write(P.home(l), prefill(h, L[l]));
}
sitemap.push({ es: P.home("es"), en: P.home("en") });

// ---- fichas de carrera
for (const r of races) {
  const y = r.d.slice(0, 4), alt = { es: P.race(r, "es"), en: P.race(r, "en") };
  for (const l of ["es", "en"]) {
    const t = T[l];
    const ld = r.ok === false ? null : {
      "@context": "https://schema.org", "@type": "SportsEvent", name: r.n[l], startDate: r.d, sport: "Inline skating",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode", url: SITE + alt[l],
      location: { "@type": "Place", name: r.city, address: { "@type": "PostalAddress", addressLocality: r.city, addressCountry: r.c } },
      ...(r.desc ? { description: r.desc[l] } : {}),
    };
    const body = `<p class="crumbs"><a href="${P.home(l)}">${t.back}</a> · <a href="${P.year(y, l)}">${t.yearLink(y)}</a></p>
<dl class="facts"><dt>${t.date}</dt><dd>${fmt(r.d, l, true)}</dd><dt>${t.place}</dt><dd>${esc(r.city)}, ${CN[r.c][l]}</dd><dt>${t.disc}</dt><dd>${D[r.k][l]}</dd></dl>
${r.ok === false ? `<p class="warn">${t.tbc}</p>` : ""}${r.desc ? `<p>${esc(r.desc[l])}</p>` : ""}
${r.u ? `<p><a class="btn acc" href="${esc(r.u)}" target="_blank" rel="noopener">${t.more}</a></p>` : ""}
<p>${t.missing} <a href="${P.home(l)}#enviar">${t.send}</a></p>`;
    write(alt[l], shell({ l, title: t.raceTitle(r.n[l], y), desc: t.raceDesc(r.n[l], fmt(r.d, l), `${r.city}, ${CN[r.c][l]}`), path: alt[l], alt, ld, h1: esc(r.n[l]), sub: raceLine(r, l), body }));
  }
  sitemap.push(alt);
}

// ---- páginas por año
for (const y of years) {
  const alt = { es: P.year(y, "es"), en: P.year(y, "en") }, list = races.filter((r) => r.d.startsWith(y));
  for (const l of ["es", "en"]) {
    const t = T[l];
    const body = `<p>${t.yearLead(y)}</p>${list.map((r) => `<div class="card"><span class="tag">${D[r.k][l]}</span><h4><a href="${P.race(r, l)}">${esc(r.n[l])}</a></h4><p>${raceLine(r, l)}</p></div>`).join("")}
<p>${t.otherYears}: ${years.filter((x) => x !== y).map((x) => `<a href="${P.year(x, l)}">${x}</a>`).join(" · ") || "—"}</p>
<p>${t.missing} <a href="${P.home(l)}#enviar">${t.send}</a></p>`;
    write(alt[l], shell({ l, title: t.yearTitle(y), desc: t.yearDesc(y, list.length), path: alt[l], alt, h1: t.yearLink(y), sub: "", body }));
  }
  sitemap.push(alt);
}

// ---- privacidad (se extrae de privacidad.html)
const priv = fs.readFileSync("privacidad.html", "utf8");
const privAlt = { es: P.priv("es"), en: P.priv("en") };
for (const l of ["es", "en"]) {
  let b = priv.match(new RegExp(`<div data-l="${l}"[^>]*>([\\s\\S]*?)</div>`))[1];
  const h1 = b.match(/<h1>(.*?)<\/h1>/)[1];
  b = b.replace(/<h1>.*?<\/h1>/, "");
  if (/class="ph"/.test(b)) console.warn(`AVISO: privacidad.html (${l}) aún tiene huecos amarillos sin rellenar.`);
  write(privAlt[l], shell({ l, title: T[l].privTitle, desc: h1, path: privAlt[l], alt: privAlt, h1, sub: "", body: `<div class="legal">${b}</div>` }));
}
sitemap.push(privAlt);

// ---- sitemap, robots y recursos
fs.writeFileSync(OUT + "/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemap.flatMap((p) => ["es", "en"].map((l) => `<url><loc>${SITE}${p[l]}</loc><xhtml:link rel="alternate" hreflang="es" href="${SITE}${p.es}"/><xhtml:link rel="alternate" hreflang="en" href="${SITE}${p.en}"/></url>`)).join("\n")}
</urlset>`);
fs.writeFileSync(OUT + "/robots.txt", `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
fs.copyFileSync("hero.jpg", OUT + "/hero.jpg");
console.log(`OK: ${out.length} páginas generadas en ${OUT}/ (sitio: ${SITE})`);
