import {
  AnalysisStageId,
  AnalysisStageMeta,
  ComprehensiveAnalysisResponse,
  DiagnosticTest,
  ResourceCategory,
  ResourceItem,
} from "./types.js";

const PLACEHOLDER_HOST_PATTERNS = [
  "example.com",
  "example.org",
  "example.net",
  "tudominio",
  "tu-sitio",
  "tusitio",
  "ejemplo.com",
  "dominio.com",
  "website.com",
  "url.com",
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
];

const CURATED_RESOURCE_DOMAINS: Array<{ keywords: string[]; url: string }> = [
  { keywords: ["chatgpt", "openai"], url: "https://chatgpt.com/" },
  { keywords: ["claude", "anthropic"], url: "https://claude.ai/" },
  { keywords: ["perplexity"], url: "https://www.perplexity.ai/" },
  { keywords: ["notebooklm"], url: "https://notebooklm.google.com/" },
  { keywords: ["google scholar", "académico", "academico"], url: "https://scholar.google.com/" },
  { keywords: ["pubmed"], url: "https://pubmed.ncbi.nlm.nih.gov/" },
  { keywords: ["scielo"], url: "https://scielo.org/" },
  { keywords: ["redalyc"], url: "https://www.redalyc.org/" },
  { keywords: ["khan academy"], url: "https://es.khanacademy.org/" },
  { keywords: ["coursera"], url: "https://www.coursera.org/" },
  { keywords: ["edx"], url: "https://www.edx.org/" },
  { keywords: ["mit opencourseware", "mit ocw"], url: "https://ocw.mit.edu/" },
  { keywords: ["platzi"], url: "https://platzi.com/" },
  { keywords: ["ted talks", "ted.com"], url: "https://www.ted.com/" },
  { keywords: ["notion"], url: "https://www.notion.so/" },
  { keywords: ["obsidian"], url: "https://obsidian.md/" },
  { keywords: ["trello"], url: "https://trello.com/" },
  { keywords: ["asana"], url: "https://asana.com/" },
  { keywords: ["anki"], url: "https://apps.ankiweb.net/" },
  { keywords: ["zotero"], url: "https://www.zotero.org/" },
  { keywords: ["mendeley"], url: "https://www.mendeley.com/" },
  { keywords: ["wolfram alpha", "wolframalpha"], url: "https://www.wolframalpha.com/" },
  { keywords: ["desmos"], url: "https://www.desmos.com/" },
  { keywords: ["canva"], url: "https://www.canva.com/" },
  { keywords: ["miro"], url: "https://miro.com/" },
  { keywords: ["google sheets", "hojas de cálculo de google"], url: "https://docs.google.com/spreadsheets" },
  { keywords: ["excel", "microsoft excel"], url: "https://www.microsoft.com/microsoft-365/excel" },
  { keywords: ["biblehub", "bible hub"], url: "https://biblehub.com/" },
  { keywords: ["blue letter bible"], url: "https://www.blueletterbible.org/" },
  { keywords: ["bible gateway", "biblegateway"], url: "https://www.biblegateway.com/" },
  { keywords: ["logos bible", "logos.com"], url: "https://www.logos.com/" },
  { keywords: ["stanford encyclopedia", "plato.stanford"], url: "https://plato.stanford.edu/" },
  { keywords: ["organización mundial de la salud", "who.int", "oms"], url: "https://www.who.int/es" },
  { keywords: ["mayo clinic", "clínica mayo"], url: "https://www.mayoclinic.org/es" },
  { keywords: ["medlineplus"], url: "https://medlineplus.gov/spanish/" },
  { keywords: ["cochrane"], url: "https://www.cochranelibrary.com/" },
  { keywords: ["wikipedia"], url: "https://es.wikipedia.org/" },
  { keywords: ["investopedia"], url: "https://www.investopedia.com/" },
  { keywords: ["harvard business review", "hbr"], url: "https://hbr.org/" },
  { keywords: ["elicit"], url: "https://elicit.com/" },
  { keywords: ["consensus.app", "consensus ai"], url: "https://consensus.app/" },
  { keywords: ["gemini"], url: "https://gemini.google.com/" },
];

export function normalizeSafeHttpUrl(rawUrl?: string): string | undefined {
  if (!rawUrl || typeof rawUrl !== "string") return undefined;
  let cleaned = rawUrl.trim().replace(/^[<("'`\[]+|[>)"'`\].,;]+$/g, "");
  if (!cleaned || cleaned.includes(" ")) return undefined;

  if (/^www\.[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  } else if (!/^https?:\/\//i.test(cleaned)) {
    if (/^[a-z0-9-]+(\.[a-z]{2,})+(\/[^\s]*)?$/i.test(cleaned) && !cleaned.includes("..")) {
      cleaned = `https://${cleaned}`;
    } else {
      return undefined;
    }
  }

  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return undefined;
    }
    const hostname = parsed.hostname.toLowerCase();
    if (!hostname || !hostname.includes(".")) return undefined;
    if (PLACEHOLDER_HOST_PATTERNS.some((p) => hostname.includes(p))) {
      return undefined;
    }
    // Upgrade http to https when safe
    if (parsed.protocol === "http:") {
      parsed.protocol = "https:";
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export function extractUrlFromText(text: string): { url?: string; cleanText: string } {
  if (!text || typeof text !== "string") {
    return { cleanText: "" };
  }
  const urlMatch = text.match(/https?:\/\/[^\s)>\]"']+/i);
  if (urlMatch) {
    const valid = normalizeSafeHttpUrl(urlMatch[0]);
    if (valid) {
      const stripped = text
        .replace(urlMatch[0], "")
        .replace(/\(\s*\)|\[\s*\]/g, "")
        .replace(/[-–—:]\s*$/, "")
        .trim();
      return { url: valid, cleanText: stripped || valid };
    }
  }

  const domainMatch = text.match(/\b((?:www\.)?[a-z0-9-]+\.(?:com|org|edu|gov|net|io|ai|app|so|md|es|co|info)(?:\/[^\s)>\]"']*)?)/i);
  if (domainMatch) {
    const valid = normalizeSafeHttpUrl(domainMatch[1]);
    if (valid) {
      return { url: valid, cleanText: text.trim() };
    }
  }

  return { cleanText: text.trim() };
}

export function sanitizeResourceList(rawList: any, defaultTitle = "Recurso recomendado"): ResourceItem[] {
  return ensureArray<any>(rawList)
    .map((entry): ResourceItem | null => {
      if (typeof entry === "string") {
        const trimmed = entry.trim();
        if (!trimmed) return null;
        const { url, cleanText } = extractUrlFromText(trimmed);
        return {
          titulo: cleanText || trimmed,
          ...(url ? { url } : {}),
        };
      }
      if (entry && typeof entry === "object") {
        const rawTitle = ensureString(
          entry.titulo ?? entry.nombre ?? entry.title ?? entry.name ?? entry.recurso ?? entry.descripcion,
          ""
        ).trim();
        const rawAutor = ensureString(entry.autor ?? entry.author, "").trim();
        const candidateUrl = normalizeSafeHttpUrl(
          entry.url ?? entry.link ?? entry.enlace ?? entry.href ?? entry.uri
        );
        const extracted = rawTitle ? extractUrlFromText(rawTitle) : { cleanText: "" };
        const finalTitle = extracted.cleanText || rawTitle || (candidateUrl ? candidateUrl : defaultTitle);
        const finalUrl = candidateUrl || extracted.url;
        if (!finalTitle && !finalUrl) return null;
        return {
          titulo: finalTitle || defaultTitle,
          ...(rawAutor ? { autor: rawAutor } : {}),
          ...(finalUrl ? { url: finalUrl } : {}),
        };
      }
      return null;
    })
    .filter((item): item is ResourceItem => item !== null && item.titulo.trim().length > 0);
}

function getHostnameLabel(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    return u.hostname.replace(/^www\./i, "");
  } catch {
    return "Enlace web";
  }
}

export function resolveResourceLink(
  category: ResourceCategory,
  item: ResourceItem | string
): { href: string; label: string; isDirect: boolean } {
  const normalized: ResourceItem =
    typeof item === "string" ? { titulo: item } : item || { titulo: "Recurso" };

  const directUrl = normalizeSafeHttpUrl(normalized.url);
  if (directUrl) {
    return {
      href: directUrl,
      label: getHostnameLabel(directUrl),
      isDirect: true,
    };
  }

  const fromText = extractUrlFromText(normalized.titulo || "");
  if (fromText.url) {
    return {
      href: fromText.url,
      label: getHostnameLabel(fromText.url),
      isDirect: true,
    };
  }

  if (category === "articulos" && normalized.titulo) {
    const doiMatch = normalized.titulo.match(/\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/);
    if (doiMatch) {
      const doiUrl = `https://doi.org/${doiMatch[1].replace(/[.,;)]+$/, "")}`;
      return {
        href: doiUrl,
        label: "doi.org",
        isDirect: true,
      };
    }
  }

  const lowerTitle = (normalized.titulo || "").toLowerCase();
  for (const curated of CURATED_RESOURCE_DOMAINS) {
    if (curated.keywords.some((kw) => lowerTitle.includes(kw))) {
      return {
        href: curated.url,
        label: getHostnameLabel(curated.url),
        isDirect: true,
      };
    }
  }

  const cleanQuery = [normalized.titulo, normalized.autor]
    .filter((s) => typeof s === "string" && s.trim().length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);

  const safeQuery = cleanQuery || "recursos educativos";

  switch (category) {
    case "libros":
      return {
        href: `https://www.google.com/search?tbm=bks&q=${encodeURIComponent(safeQuery)}`,
        label: "Google Books",
        isDirect: false,
      };
    case "articulos":
      return {
        href: `https://scholar.google.com/scholar?q=${encodeURIComponent(safeQuery)}`,
        label: "Google Scholar",
        isDirect: false,
      };
    case "videos":
      return {
        href: `https://www.youtube.com/results?search_query=${encodeURIComponent(safeQuery)}`,
        label: "Buscar en YouTube",
        isDirect: false,
      };
    case "cursos":
      return {
        href: `https://www.google.com/search?q=${encodeURIComponent(`${safeQuery} curso`)}`,
        label: "Buscar curso",
        isDirect: false,
      };
    default:
      return {
        href: `https://www.google.com/search?q=${encodeURIComponent(safeQuery)}`,
        label: "Buscar en la web",
        isDirect: false,
      };
  }
}

export function sanitizeDiagnosticTest(rawTest: any): DiagnosticTest {
  if (!rawTest || typeof rawTest !== "object") {
    return {
      tituloTest: "Test de Nivel de Conocimiento y Realidad Psicológica",
      descripcion: "Cuestionario de autoevaluación para medir tu comprensión objetiva del tema y tu disposición/sesgos emocionales.",
      preguntas: [
        {
          id: 1,
          pregunta: "¿Qué nivel de evidencia o datos objetivos manejas sobre las implicaciones reales de este tema?",
          dimension: "conocimiento",
          opciones: [
            { letra: "A", texto: "Manejo datos escasos, basándome principalmente en intuición o impresiones de terceros.", puntajeConocimiento: 5, puntajePsicologico: 12, explicacionEvaluativa: "Conocimiento básico empírico; alto riesgo de sesgo de disponibilidad." },
            { letra: "B", texto: "He leído artículos generales o noticias pero sin profundizar en datos técnicos o científicos.", puntajeConocimiento: 12, puntajePsicologico: 16, explicacionEvaluativa: "Nivel intermedio superficial; requiere mayor contrastación de fuentes." },
            { letra: "C", texto: "Comprendo los conceptos clave, métricas o fundamentos teóricos principales.", puntajeConocimiento: 20, puntajePsicologico: 22, explicacionEvaluativa: "Buen nivel de comprensión conceptual y objetividad." },
            { letra: "D", texto: "Manejo estudios de alto nivel, métricas detalladas y casos con resultados observables.", puntajeConocimiento: 25, puntajePsicologico: 25, explicacionEvaluativa: "Dominio avanzado de información objetiva y evidencia." }
          ]
        },
        {
          id: 2,
          pregunta: "¿Cómo reaccionas ante evidencia o argumentos que contradigan tu preferencia o creencia previa?",
          dimension: "psicologico",
          opciones: [
            { letra: "A", texto: "Tiendo a descartar la información contradictoria buscando validar mi postura inicial.", puntajeConocimiento: 10, puntajePsicologico: 5, explicacionEvaluativa: "Alto sesgo de confirmación; resistencia emocional a los hechos." },
            { letra: "B", texto: "Me genera duda o incomodidad, y tiendo a posponer la decisión para evitar el dilema.", puntajeConocimiento: 12, puntajePsicologico: 12, explicacionEvaluativa: "Tendencia a la evitación o parálisis por disonancia cognitiva." },
            { letra: "C", texto: "Analizo los datos contradictorios de forma sopesada para ajustar mis expectativas de riesgo.", puntajeConocimiento: 20, puntajePsicologico: 20, explicacionEvaluativa: "Buena flexibilidad cognitiva y apertura a la realidad." },
            { letra: "D", texto: "Acepto de inmediato los hechos observables y adapto mi postura con neutralidad absoluta.", puntajeConocimiento: 25, puntajePsicologico: 25, explicacionEvaluativa: "Elevada objetividad científica y madurez psicológica." }
          ]
        },
        {
          id: 3,
          pregunta: "¿Cuál es tu grado de preparación práctica para afrontar posibles escenarios de falla o costos asociados?",
          dimension: "ambos",
          opciones: [
            { letra: "A", texto: "No he calculado los costos, tiempos o riesgos; actuaría de manera impulsiva o urgente.", puntajeConocimiento: 5, puntajePsicologico: 5, explicacionEvaluativa: "Estrategia reactiva de alto riesgo sin amortiguación psicológica." },
            { letra: "B", texto: "Tengo una idea imprecisa pero sin planes de contingencia si surgen imprevistos.", puntajeConocimiento: 12, puntajePsicologico: 12, explicacionEvaluativa: "Planificación parcial; vulnerable ante contratiempos." },
            { letra: "C", texto: "He mapeado los riesgos principales y poseo un margen de contingencia razonable.", puntajeConocimiento: 20, puntajePsicologico: 20, explicacionEvaluativa: "Estructura operativa y preparación mental adecuada." },
            { letra: "D", texto: "Tengo un plan de mitigación detallado con criterios claros de entrada, salida y gestión.", puntajeConocimiento: 25, puntajePsicologico: 25, explicacionEvaluativa: "Alta capacidad de gestión de escenarios y resiliencia estratégica." }
          ]
        },
        {
          id: 4,
          pregunta: "¿Cuál es tu motivación interna dominante o estado de ánimo al abordar esta consulta?",
          dimension: "psicologico",
          opciones: [
            { letra: "A", texto: "Busco aliviar una ansiedad inmediata o librarme rápido de una presión externa.", puntajeConocimiento: 10, puntajePsicologico: 8, explicacionEvaluativa: "Motivación por escape o alivio temporal; riesgo de decisiones apresuradas." },
            { letra: "B", texto: "Deseo verificar que tengo la razón ante otros o ganar ventaja rápida.", puntajeConocimiento: 10, puntajePsicologico: 10, explicacionEvaluativa: "Expectativa impulsada por ego o prisa; posible sesgo de atribución." },
            { letra: "C", texto: "Busco claridad objetiva para tomar una decisión prudente y justa a mediano plazo.", puntajeConocimiento: 20, puntajePsicologico: 22, explicacionEvaluativa: "Enfoque equilibrado centrado en la sostenibilidad y prudencia." },
            { letra: "D", texto: "Busco máxima alineación con la verdad comprobada, los datos y los principios irrenunciables.", puntajeConocimiento: 25, puntajePsicologico: 25, explicacionEvaluativa: "Integridad analítica y solidez psicológica de estándar superior." }
          ]
        }
      ],
      interpretacionConocimiento: {
        nivelAlto: "Dominio técnico sólido. Comprendes los fundamentos, métricas y evidencias clave.",
        nivelMedio: "Comprensión conceptual aceptable con oportunidad de profundizar en datos duros.",
        nivelBajo: "Conocimiento empírico limitado. Riesgo de actuar basándote en suposiciones o intuición."
      },
      interpretacionPsicologica: {
        nivelMaduro: "Alta disposición emocional, autocontrol, neutralidad frente a sesgos y claridad mental.",
        nivelModerado: "Disposición intermedia con presencia moderada de dudas, impaciencia o sesgos.",
        nivelVulnerable: "Elevada carga emocional o sesgos de confirmación que dificultan la neutralidad."
      }
    };
  }

  const tituloTest = ensureString(rawTest.tituloTest, "Test de Nivel de Conocimiento y Realidad Psicológica");
  const descripcion = ensureString(rawTest.descripcion, "Cuestionario de autoevaluación para medir tu comprensión objetiva del tema y tu disposición/sesgos emocionales.");

  const preguntas = ensureArray<any>(rawTest.preguntas).map((q, idx) => {
    const rawOptions = ensureArray<any>(q?.opciones);
    const opciones = rawOptions.map((opt, oIdx) => {
      const letters = ["A", "B", "C", "D", "E"];
      return {
        letra: ensureString(opt?.letra, letters[oIdx] || `Opc ${oIdx + 1}`),
        texto: ensureString(opt?.texto, "Opción no especificada"),
        puntajeConocimiento: typeof opt?.puntajeConocimiento === "number" ? opt.puntajeConocimiento : (oIdx + 1) * 6,
        puntajePsicologico: typeof opt?.puntajePsicologico === "number" ? opt.puntajePsicologico : (oIdx + 1) * 6,
        explicacionEvaluativa: ensureString(opt?.explicacionEvaluativa, "Evaluación de respuesta."),
      };
    });

    return {
      id: typeof q?.id === "number" ? q.id : idx + 1,
      pregunta: ensureString(q?.pregunta, `Pregunta ${idx + 1}`),
      dimension: (q?.dimension === "conocimiento" || q?.dimension === "psicologico" ? q.dimension : "ambos") as any,
      opciones,
    };
  });

  const rawIntK = rawTest.interpretacionConocimiento || {};
  const rawIntP = rawTest.interpretacionPsicologica || {};

  return {
    tituloTest,
    descripcion,
    preguntas: preguntas.length > 0 ? preguntas : sanitizeDiagnosticTest(null).preguntas,
    interpretacionConocimiento: {
      nivelAlto: ensureString(rawIntK.nivelAlto, "Dominio técnico y fundamentación muy sólida."),
      nivelMedio: ensureString(rawIntK.nivelMedio, "Comprensión conceptual media con oportunidad de profundización."),
      nivelBajo: ensureString(rawIntK.nivelBajo, "Nivel de conocimiento básico o intuitivo; requiere investigación."),
    },
    interpretacionPsicologica: {
      nivelMaduro: ensureString(rawIntP.nivelMaduro, "Alta neutralidad, autocontrol y madurez emocional ante el dilema."),
      nivelModerado: ensureString(rawIntP.nivelModerado, "Aceptable objetividad con presencia puntual de dudas o sesgos."),
      nivelVulnerable: ensureString(rawIntP.nivelVulnerable, "Sensibilidad a sesgos de confirmación o impaciencia emocional."),
    },
  };
}

export function ensureArray<T = string>(val: any): T[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string" && val.trim()) {
    const lines = val
      .split("\n")
      .map((s) => s.replace(/^[-*•\d.]+\s*/, "").trim())
      .filter(Boolean);
    return (lines.length > 0 ? lines : [val.trim()]) as unknown as T[];
  }
  if (val && typeof val === "object") {
    const vals = Object.values(val).filter((v) => v !== null && v !== undefined && v !== "");
    if (vals.length > 0) return vals as unknown as T[];
  }
  return [];
}

export function ensureString(val: any, defaultVal = ""): string {
  if (typeof val === "string") return val;
  if (Array.isArray(val)) return val.join(", ");
  if (val && typeof val === "object") {
    try {
      return JSON.stringify(val);
    } catch {
      return defaultVal;
    }
  }
  return defaultVal;
}

export function sanitizeAnalysisResponse(data: any): ComprehensiveAnalysisResponse {
  if (!data || typeof data !== "object") {
    data = {};
  }

  const resumenEjecutivo = ensureString(data.resumenEjecutivo, "Sin resumen ejecutivo.");
  const comprensionProblema = ensureString(data.comprensionProblema, "Sin detalle de comprensión.");

  const rawSintesis = data.sintesisClave || {};
  const rawRecFinFallback = data.recomendacionFinal || {};
  const sintesisClave = {
    deQueTrata: ensureString(rawSintesis.deQueTrata, comprensionProblema || "Análisis sobre la consulta planteada."),
    ideaPrincipal: ensureString(rawSintesis.ideaPrincipal, resumenEjecutivo || "Planteamiento central del análisis."),
    argumentos: ensureArray<string>(rawSintesis.argumentos).length > 0
      ? ensureArray<string>(rawSintesis.argumentos)
      : [
          ensureString(rawRecFinFallback.justificacion, "Evaluación lógica y sopesada de las variables principales."),
          "Análisis multidisciplinario de la evidencia y los factores involucrados.",
          "Verificación práctica y ponderación de riesgos y beneficios."
        ],
    conclusion: ensureString(rawSintesis.conclusion, ensureString(rawRecFinFallback.recomendacion, "Dictamen y recomendación final no especificada.")),
  };

  const definiciones = ensureArray<any>(data.definiciones).map((d) => {
    if (typeof d === "string") {
      return { termino: "Término", definicion: d, explicacionSencilla: undefined };
    }
    const defStr = ensureString(d?.definicion, "Definición no provista.");
    const rawSencilla = typeof d?.explicacionSencilla === "string" ? d.explicacionSencilla.trim() : "";
    const isDuplicate = !rawSencilla || rawSencilla.toLowerCase() === defStr.trim().toLowerCase();

    return {
      termino: ensureString(d?.termino, "Término"),
      definicion: defStr,
      explicacionSencilla: !isDuplicate ? rawSencilla : undefined,
    };
  });

  const rawCtx = data.contexto || {};
  const contexto = {
    historico: ensureString(rawCtx.historico),
    cultural: ensureString(rawCtx.cultural),
    cientifico: ensureString(rawCtx.cientifico),
    biblico: ensureString(rawCtx.biblico),
    practico: ensureString(rawCtx.practico),
  };

  const analisisMultidisciplinario = ensureArray<any>(data.analisisMultidisciplinario).map((item) => {
    if (typeof item === "string") {
      return { disciplina: "General", analisis: item, relevancia: "Media" as const };
    }
    const rel = item?.relevancia === "Alta" || item?.relevancia === "Baja" ? item.relevancia : "Media";
    return {
      disciplina: ensureString(item?.disciplina, "General"),
      analisis: ensureString(item?.analisis, "Sin análisis detallado."),
      relevancia: rel,
    };
  });

  const perspectivas = ensureArray<any>(data.perspectivas).map((p) => {
    if (typeof p === "string") {
      return { nombre: "Perspectiva General", fortalezas: [p], debilidades: [] };
    }
    return {
      nombre: ensureString(p?.nombre, "Perspectiva"),
      fortalezas: ensureArray<string>(p?.fortalezas),
      debilidades: ensureArray<string>(p?.debilidades),
    };
  });

  const rawComp = data.comparacionObjetiva || {};
  const comparacionObjetiva = {
    evidencia: ensureString(rawComp.evidencia),
    coherenciaLogica: ensureString(rawComp.coherenciaLogica),
    resultadosObservables: ensureString(rawComp.resultadosObservables),
    compatibilidadBiblica: ensureString(rawComp.compatibilidadBiblica),
    riesgos: ensureString(rawComp.riesgos),
    beneficios: ensureString(rawComp.beneficios),
    limitaciones: ensureString(rawComp.limitaciones),
  };

  const rawRec = data.recursosRecomendados || {};
  const recursosRecomendados = {
    libros: sanitizeResourceList(rawRec.libros, "Libro recomendado"),
    articulos: sanitizeResourceList(rawRec.articulos, "Artículo científico"),
    sitiosWeb: sanitizeResourceList(rawRec.sitiosWeb, "Sitio web recomendado"),
    videos: sanitizeResourceList(rawRec.videos, "Video recomendado"),
    cursos: sanitizeResourceList(rawRec.cursos, "Curso recomendado"),
    herramientas: sanitizeResourceList(rawRec.herramientas, "Herramienta recomendada"),
    ias: sanitizeResourceList(rawRec.ias, "Herramienta de IA"),
    software: sanitizeResourceList(rawRec.software, "Software recomendado"),
    plantillas: sanitizeResourceList(rawRec.plantillas, "Plantilla recomendada"),
  };

  const rawAcc = data.accionesPracticas || {};
  const accionesPracticas = {
    inmediatas: ensureArray<string>(rawAcc.inmediatas),
    estaSemana: ensureArray<string>(rawAcc.estaSemana),
    esteMes: ensureArray<string>(rawAcc.esteMes),
    largoPlazo: ensureArray<string>(rawAcc.largoPlazo),
  };

  const riesgos = ensureArray<any>(data.riesgos).map((r) => {
    if (typeof r === "string") {
      return { riesgo: r, prevencion: "Monitoreo prudente", solucion: "Evaluar alternativas" };
    }
    return {
      riesgo: ensureString(r?.riesgo, "Riesgo potencial"),
      prevencion: ensureString(r?.prevencion),
      solucion: ensureString(r?.solucion),
    };
  });

  const matrizDecisiones = ensureArray<any>(data.matrizDecisiones).map((m) => {
    if (typeof m === "string") {
      return {
        alternativa: m,
        pros: [],
        contras: [],
        costo: "Medio",
        tiempo: "Mediano plazo",
        riesgo: "Medio",
        beneficio: "Medio",
        impacto: "Medio",
        factibilidad: "Media",
      };
    }
    return {
      alternativa: ensureString(m?.alternativa, "Alternativa"),
      pros: ensureArray<string>(m?.pros),
      contras: ensureArray<string>(m?.contras),
      costo: ensureString(m?.costo, "Medio"),
      tiempo: ensureString(m?.tiempo, "Mediano plazo"),
      riesgo: ensureString(m?.riesgo, "Medio"),
      beneficio: ensureString(m?.beneficio, "Medio"),
      impacto: ensureString(m?.impacto, "Medio"),
      factibilidad: ensureString(m?.factibilidad, "Media"),
    };
  });

  const rawRecFin = data.recomendacionFinal || {};
  const recomendacionFinal = {
    recomendacion: ensureString(rawRecFin.recomendacion, "Recomendación estratégica no especificada."),
    justificacion: ensureString(rawRecFin.justificacion),
    nivelConfianza: typeof rawRecFin.nivelConfianza === "number" ? rawRecFin.nivelConfianza : 90,
    porqueConfianza: ensureString(rawRecFin.porqueConfianza),
  };

  const planPasoAPaso = ensureArray<any>(data.planPasoAPaso).map((p, idx) => {
    if (typeof p === "string") {
      return { paso: idx + 1, titulo: `Paso ${idx + 1}`, descripcion: p };
    }
    return {
      paso: typeof p?.paso === "number" ? p.paso : idx + 1,
      titulo: ensureString(p?.titulo, `Paso ${idx + 1}`),
      descripcion: ensureString(p?.descripcion),
    };
  });

  const erroresComunes = ensureArray<any>(data.erroresComunes).map((e) => {
    if (typeof e === "string") {
      return { error: e, comoEvitarlo: "Proceder con cautela." };
    }
    return {
      error: ensureString(e?.error, "Error potencial"),
      comoEvitarlo: ensureString(e?.comoEvitarlo),
    };
  });

  const listaVerificacion = ensureArray<string>(data.listaVerificacion);

  const rawRes = data.resumenFinal || {};
  const resumenFinal = {
    queHacer: ensureArray<string>(rawRes.queHacer),
    queNoHacer: ensureArray<string>(rawRes.queNoHacer),
    porque: ensureString(rawRes.porque),
  };

  const esBiblico = Boolean(data.esBiblico);
  let especificosBiblicos = undefined;
  if (data.especificosBiblicos && typeof data.especificosBiblicos === "object") {
    const eb = data.especificosBiblicos;
    especificosBiblicos = {
      contextoHistoricoBiblico: ensureString(eb.contextoHistoricoBiblico),
      contextoLiterario: ensureString(eb.contextoLiterario),
      propositoAutor: ensureString(eb.propositoAutor),
      destinatarios: ensureString(eb.destinatarios),
      principioUniversal: ensureString(eb.principioUniversal),
      aplicacionActual: ensureString(eb.aplicacionActual),
      pasajesRelacionados: ensureArray<string>(eb.pasajesRelacionados),
      posiblesMalasInterpretaciones: ensureArray<any>(eb.posiblesMalasInterpretaciones).map((mi) => {
        if (typeof mi === "string") {
          return { interpretacion: mi, refutacion: "Refutación basada en exégesis." };
        }
        return {
          interpretacion: ensureString(mi?.interpretacion),
          refutacion: ensureString(mi?.refutacion),
        };
      }),
      conclusionExegetica: ensureString(eb.conclusionExegetica),
    };
  }

  const esCientifico = Boolean(data.esCientifico);
  let especificosCientificos = undefined;
  if (data.especificosCientificos && typeof data.especificosCientificos === "object") {
    const ec = data.especificosCientificos;
    especificosCientificos = {
      nivelEvidencia: ensureString(ec.nivelEvidencia),
      consensoCientifico: ensureString(ec.consensoCientifico),
      limitacionesCientificas: ensureString(ec.limitacionesCientificas),
      estudiosContradictorios: ensureArray<string>(ec.estudiosContradictorios),
      gradoCerteza: ensureString(ec.gradoCerteza),
    };
  }

  const rawAudit = data.auditoriaRazonamiento || {};
  const auditoriaRazonamiento = {
    supuestosHechos: ensureArray<string>(rawAudit.supuestosHechos),
    evidenciaContradictoria: ensureArray<string>(rawAudit.evidenciaContradictoria),
    informacionFaltante: ensureArray<string>(rawAudit.informacionFaltante),
    sesgosCognitivos: ensureArray<any>(rawAudit.sesgosCognitivos).map((s) => {
      if (typeof s === "string") {
        return { sesgo: "Sesgo potencial", descripcion: s, comoAfecta: s };
      }
      return {
        sesgo: ensureString(s?.sesgo, "Sesgo cognitivo"),
        descripcion: ensureString(s?.descripcion),
        comoAfecta: ensureString(s?.comoAfecta),
      };
    }),
    escenariosFalla: ensureArray<string>(rawAudit.escenariosFalla),
    disparadoresCambio: ensureArray<string>(rawAudit.disparadoresCambio),
  };

  let teologiaEvangelica = undefined;
  if (data.teologiaEvangelica && typeof data.teologiaEvangelica === "object") {
    const te = data.teologiaEvangelica;
    const rawMot = te.evaluacionMotivosCorazon || {};
    const rawImp = te.impactoEclesiologicoPastoral || {};
    const rawMar = te.marcoRedentorCristocentrico || {};

    teologiaEvangelica = {
      evaluacionMotivosCorazon: {
        motivosSubyacentes: ensureArray<string>(rawMot.motivosSubyacentes),
        posiblesIdolosCorazon: ensureArray<string>(rawMot.posiblesIdolosCorazon),
        consejoPastoralDeseos: ensureString(rawMot.consejoPastoralDeseos),
      },
      impactoEclesiologicoPastoral: {
        servicioYComunidad: ensureString(rawImp.servicioYComunidad),
        testimonioPublico: ensureString(rawImp.testimonioPublico),
        discipuladoYFamilia: ensureString(rawImp.discipuladoYFamilia),
      },
      marcoRedentorCristocentrico: {
        creacion: ensureString(rawMar.creacion),
        caida: ensureString(rawMar.caida),
        redencion: ensureString(rawMar.redencion),
        consumacion: ensureString(rawMar.consumacion),
        conexionEvangelio: ensureString(rawMar.conexionEvangelio),
      },
      concordanciaOriginal: ensureArray<any>(te.concordanciaOriginal).map((pas) => {
        if (typeof pas === "string") {
          return { pasaje: pas, palabrasOriginales: [], contextoExegetico: pas };
        }
        return {
          pasaje: ensureString(pas?.pasaje),
          palabrasOriginales: ensureArray<any>(pas?.palabrasOriginales).map((w) => {
            if (typeof w === "string") {
              return {
                palabra: w,
                transliteracion: w,
                idioma: "Griego",
                strong: "G0000",
                traduccionLiteral: w,
                significadoTeologico: w,
              };
            }
            return {
              palabra: ensureString(w?.palabra),
              transliteracion: ensureString(w?.transliteracion),
              idioma: ensureString(w?.idioma, "Griego"),
              strong: ensureString(w?.strong, "G0000"),
              traduccionLiteral: ensureString(w?.traduccionLiteral),
              significadoTeologico: ensureString(w?.significadoTeologico),
            };
          }),
          contextoExegetico: ensureString(pas?.contextoExegetico),
        };
      }),
    };
  }

  return {
    resumenEjecutivo,
    comprensionProblema,
    sintesisClave,
    definiciones,
    contexto,
    analisisMultidisciplinario,
    perspectivas,
    comparacionObjetiva,
    recursosRecomendados,
    accionesPracticas,
    riesgos,
    matrizDecisiones,
    recomendacionFinal,
    planPasoAPaso,
    erroresComunes,
    listaVerificacion,
    resumenFinal,
    esBiblico,
    especificosBiblicos,
    esCientifico,
    especificosCientificos,
    auditoriaRazonamiento,
    teologiaEvangelica,
    testDiagnostico: sanitizeDiagnosticTest(data.testDiagnostico),
  };
}

export function generateMarkdownReport(rawAnalysis: ComprehensiveAnalysisResponse, activeFramework?: string): string {
  const analysis = sanitizeAnalysisResponse(rawAnalysis);
  let md = `# Reporte de Análisis Integral y Discernimiento de Decisiones\n\n`;
  if (activeFramework) {
    md += `> **Marco de Referencia:** ${activeFramework}\n`;
  }
  md += `> **Nivel de Confianza del Reporte:** ${analysis.recomendacionFinal.nivelConfianza}%\n`;
  md += `> *Metodología: Rigor empírico, coherencia lógica, exégesis contextual y auto-auditoría de sesgos.*\n\n`;

  md += `## 1. Resumen Ejecutivo\n${analysis.resumenEjecutivo}\n\n`;
  md += `## 2. Comprensión del Verdadero Problema\n${analysis.comprensionProblema}\n\n`;

  if (analysis.sintesisClave) {
    md += `### Síntesis Directa\n`;
    md += `* **¿De qué trata?**: ${analysis.sintesisClave.deQueTrata}\n`;
    md += `* **Idea principal**: ${analysis.sintesisClave.ideaPrincipal}\n`;
    md += `* **Argumentos clave**:\n`;
    (analysis.sintesisClave.argumentos || []).forEach((arg) => {
      md += `  * ${arg}\n`;
    });
    md += `* **Conclusión**: ${analysis.sintesisClave.conclusion}\n\n`;
  }

  md += `## 3. Definiciones Importantes\n`;
  (analysis.definiciones || []).forEach((def) => {
    md += `* **${def.termino}**: ${def.definicion}\n`;
    if (def.explicacionSencilla) {
      md += `  * *En palabras simples*: ${def.explicacionSencilla}\n`;
    }
  });
  md += `\n`;

  md += `## 4. Contextualización 5D\n`;
  md += `* **Histórico**: ${analysis.contexto.historico}\n`;
  md += `* **Cultural**: ${analysis.contexto.cultural}\n`;
  md += `* **Científico**: ${analysis.contexto.cientifico}\n`;
  md += `* **Bíblico / Ético**: ${analysis.contexto.biblico}\n`;
  md += `* **Práctico**: ${analysis.contexto.practico}\n\n`;

  md += `## 5. Análisis Multidisciplinario\n`;
  (analysis.analisisMultidisciplinario || []).forEach((item) => {
    md += `### ${item.disciplina} (Relevancia: ${item.relevancia})\n${item.analisis}\n\n`;
  });

  if (analysis.esBiblico && analysis.especificosBiblicos) {
    const eb = analysis.especificosBiblicos;
    md += `## Módulo Hermenéutico y Exegético Bíblico\n`;
    md += `* **Contexto Histórico**: ${eb.contextoHistoricoBiblico}\n`;
    md += `* **Contexto Literario**: ${eb.contextoLiterario}\n`;
    md += `* **Destinatarios**: ${eb.destinatarios}\n`;
    md += `* **Propósito del Autor**: ${eb.propositoAutor}\n`;
    md += `* **Principio Universal**: ${eb.principioUniversal}\n`;
    md += `* **Aplicación Actual**: ${eb.aplicacionActual}\n`;
    md += `* **Conclusión Exegética**: ${eb.conclusionExegetica}\n\n`;

    md += `### Pasajes de Soporte Relacionados:\n`;
    (eb.pasajesRelacionados || []).forEach((pas) => {
      md += `* ${pas}\n`;
    });
    md += `\n`;

    if (eb.posiblesMalasInterpretaciones && eb.posiblesMalasInterpretaciones.length > 0) {
      md += `### Refutación de Malas Interpretaciones:\n`;
      (eb.posiblesMalasInterpretaciones || []).forEach((mi) => {
        md += `* **Interpretación Errada**: *"${mi.interpretacion}"*\n  * **Exégesis Correcta**: ${mi.refutacion}\n`;
      });
      md += `\n`;
    }
  }

  if (analysis.esCientifico && analysis.especificosCientificos) {
    const esc = analysis.especificosCientificos;
    md += `## Módulo Científico Empírico\n`;
    md += `* **Nivel de Evidencia**: ${esc.nivelEvidencia}\n`;
    md += `* **Consenso Científico**: ${esc.consensoCientifico}\n`;
    md += `* **Grado de Certeza**: ${esc.gradoCerteza}\n`;
    md += `* **Limitaciones**: ${esc.limitacionesCientificas}\n\n`;

    if (esc.estudiosContradictorios && esc.estudiosContradictorios.length > 0) {
      md += `### Literatura Contradictoria o Alternativa:\n`;
      (esc.estudiosContradictorios || []).forEach((est) => {
        md += `* ${est}\n`;
      });
      md += `\n`;
    }
  }

  if (analysis.teologiaEvangelica) {
    const te = analysis.teologiaEvangelica;
    md += `## Módulo de Discernimiento Teológico y Consejería\n`;
    md += `### 1. Exégesis de los Motivos del Corazón\n`;
    md += `* **Motivos Subyacentes**: ${(te.evaluacionMotivosCorazon?.motivosSubyacentes || []).join(", ")}\n`;
    md += `* **Posibles Ídolos del Corazón**: ${(te.evaluacionMotivosCorazon?.posiblesIdolosCorazon || []).join(", ")}\n`;
    md += `* **Consejo Pastoral**: *"${te.evaluacionMotivosCorazon?.consejoPastoralDeseos || ""}"*\n\n`;

    md += `### 2. Impacto Eclesiológico y Pastoral\n`;
    md += `* **Servicio y Comunidad**: ${te.impactoEclesiologicoPastoral?.servicioYComunidad || ""}\n`;
    md += `* **Testimonio Público**: ${te.impactoEclesiologicoPastoral?.testimonioPublico || ""}\n`;
    md += `* **Discipulado y Familia**: ${te.impactoEclesiologicoPastoral?.discipuladoYFamilia || ""}\n\n`;

    md += `### 3. Marco Redentor Cristocéntrico\n`;
    md += `* **Creación**: ${te.marcoRedentorCristocentrico?.creacion || ""}\n`;
    md += `* **Caída**: ${te.marcoRedentorCristocentrico?.caida || ""}\n`;
    md += `* **Redención**: ${te.marcoRedentorCristocentrico?.redencion || ""}\n`;
    md += `* **Consumación**: ${te.marcoRedentorCristocentrico?.consumacion || ""}\n`;
    md += `* **Conexión con el Evangelio**: ${te.marcoRedentorCristocentrico?.conexionEvangelio || ""}\n\n`;

    if (te.concordanciaOriginal && te.concordanciaOriginal.length > 0) {
      md += `### 4. Concordancia en Idiomas Originales (Hebreo y Griego)\n`;
      (te.concordanciaOriginal || []).forEach((pasaje) => {
        md += `#### Pasaje: ${pasaje.pasaje}\n`;
        (pasaje.palabrasOriginales || []).forEach((p) => {
          md += `* **Palabra**: ${p.palabra} (${p.transliteracion}) — **Strong**: ${p.strong} — **Idioma**: ${p.idioma}\n`;
          md += `  * **Traducción literal**: "${p.traduccionLiteral}"\n`;
          md += `  * **Significado Teológico**: ${p.significadoTeologico}\n`;
        });
        md += `* **Nota Hermenéutica**: *"${pasaje.contextoExegetico}"*\n\n`;
      });
    }
  }

  md += `## 6. Perspectivas Contrastadas\n`;
  (analysis.perspectivas || []).forEach((p) => {
    md += `### ${p.nombre}\n`;
    md += `**Fortalezas**:\n`;
    (p.fortalezas || []).forEach((f) => (md += `* ${f}\n`));
    md += `**Debilidades**:\n`;
    (p.debilidades || []).forEach((d) => (md += `* ${d}\n`));
    md += `\n`;
  });

  md += `## 7. Comparación Objetiva de Hipótesis\n`;
  md += `* **Evidencia**: ${analysis.comparacionObjetiva.evidencia}\n`;
  md += `* **Coherencia Lógica**: ${analysis.comparacionObjetiva.coherenciaLogica}\n`;
  md += `* **Resultados Observables**: ${analysis.comparacionObjetiva.resultadosObservables}\n`;
  md += `* **Compatibilidad Bíblica**: ${analysis.comparacionObjetiva.compatibilidadBiblica}\n`;
  md += `* **Riesgos**: ${analysis.comparacionObjetiva.riesgos}\n`;
  md += `* **Beneficios**: ${analysis.comparacionObjetiva.beneficios}\n`;
  md += `* **Limitaciones**: ${analysis.comparacionObjetiva.limitaciones}\n\n`;

  md += `## 8. Matriz de Decisiones de Alternativas\n`;
  (analysis.matrizDecisiones || []).forEach((alt) => {
    md += `### Alternativa: ${alt.alternativa}\n`;
    md += `* **Pros**: ${(alt.pros || []).join(", ")}\n`;
    md += `* **Contras**: ${(alt.contras || []).join(", ")}\n`;
    md += `* **Costo**: ${alt.costo} | **Tiempo**: ${alt.tiempo} | **Riesgo**: ${alt.riesgo} | **Beneficio**: ${alt.beneficio} | **Impacto**: ${alt.impacto} | **Factibilidad**: ${alt.factibilidad}\n\n`;
  });

  md += `## 9. Recomendación Final del Motor\n`;
  md += `**Recomendación**: ${analysis.recomendacionFinal.recomendacion}\n\n`;
  md += `**Justificación**:\n${analysis.recomendacionFinal.justificacion}\n\n`;
  md += `**Nivel de Confianza**: ${analysis.recomendacionFinal.nivelConfianza}% — ${analysis.recomendacionFinal.porqueConfianza}\n\n`;

  if (analysis.riesgos && analysis.riesgos.length > 0) {
    md += `## 10. Matriz de Riesgos, Prevención y Contingencia\n`;
    analysis.riesgos.forEach((r, idx) => {
      md += `### Riesgo ${idx + 1}: ${r.riesgo}\n`;
      md += `* **Prevención**: ${r.prevencion}\n`;
      md += `* **Solución / Contingencia**: ${r.solucion}\n\n`;
    });
  }

  md += `## 11. Auditoría de Razonamiento (Auto-Refutación)\n`;
  md += `### Supuestos Hechos:\n`;
  (analysis.auditoriaRazonamiento.supuestosHechos || []).forEach((s) => (md += `* ${s}\n`));
  md += `### Evidencia Contradictoria:\n`;
  (analysis.auditoriaRazonamiento.evidenciaContradictoria || []).forEach((ev) => (md += `* ${ev}\n`));
  md += `### Información Faltante:\n`;
  (analysis.auditoriaRazonamiento.informacionFaltante || []).forEach((inf) => (md += `* ${inf}\n`));
  md += `### Escenarios de Falla de la Recomendación:\n`;
  (analysis.auditoriaRazonamiento.escenariosFalla || []).forEach((sc) => (md += `* ${sc}\n`));
  md += `### Disparadores de Cambio de Postura:\n`;
  (analysis.auditoriaRazonamiento.disparadoresCambio || []).forEach((disp) => (md += `* ${disp}\n`));

  md += `\n### Sesgos Cognitivos Evaluados:\n`;
  (analysis.auditoriaRazonamiento.sesgosCognitivos || []).forEach((ses) => {
    md += `* **${ses.sesgo}** (${ses.descripcion}): ${ses.comoAfecta}\n`;
  });
  md += `\n`;

  md += `## 12. Plan de Implementación Paso a Paso\n`;
  (analysis.planPasoAPaso || []).forEach((step) => {
    md += `### Paso ${step.paso}: ${step.titulo}\n${step.descripcion}\n\n`;
  });

  md += `## 13. Acciones Prácticas\n`;
  md += `* **Inmediatas**: ${(analysis.accionesPracticas.inmediatas || []).join("; ")}\n`;
  md += `* **Esta semana**: ${(analysis.accionesPracticas.estaSemana || []).join("; ")}\n`;
  md += `* **Este mes**: ${(analysis.accionesPracticas.esteMes || []).join("; ")}\n`;
  md += `* **Largo Plazo**: ${(analysis.accionesPracticas.largoPlazo || []).join("; ")}\n\n`;

  md += `## 14. Errores Comunes a Evitar\n`;
  (analysis.erroresComunes || []).forEach((err) => {
    md += `* **Error**: *"${err.error}"* — **Cómo evitarlo**: ${err.comoEvitarlo}\n`;
  });
  md += `\n`;

  md += `## 15. Checklist de Verificación\n`;
  (analysis.listaVerificacion || []).forEach((chk) => {
    md += `- [ ] ${chk}\n`;
  });
  md += `\n`;

  md += `## 16. Qué Hacer vs. Qué No Hacer\n`;
  md += `### Qué HACER:\n`;
  (analysis.resumenFinal.queHacer || []).forEach((h) => (md += `* ${h}\n`));
  md += `### Qué NO hacer:\n`;
  (analysis.resumenFinal.queNoHacer || []).forEach((n) => (md += `* ${n}\n`));
  md += `\n**Fundamento**: ${analysis.resumenFinal.porque}\n\n`;

  const resourceSections: Array<{ title: string; category: ResourceCategory; items: ResourceItem[] }> = [
    { title: "Libros y Literatura Especializada", category: "libros", items: analysis.recursosRecomendados.libros || [] },
    { title: "Artículos Científicos y Papers", category: "articulos", items: analysis.recursosRecomendados.articulos || [] },
    { title: "Sitios Web Oficiales y Portales", category: "sitiosWeb", items: analysis.recursosRecomendados.sitiosWeb || [] },
    { title: "Videos y Conferencias", category: "videos", items: analysis.recursosRecomendados.videos || [] },
    { title: "Cursos Recomendados", category: "cursos", items: analysis.recursosRecomendados.cursos || [] },
    { title: "Herramientas y Marcos de Trabajo", category: "herramientas", items: analysis.recursosRecomendados.herramientas || [] },
    { title: "Software Digital", category: "software", items: analysis.recursosRecomendados.software || [] },
    { title: "Inteligencia Artificial", category: "ias", items: analysis.recursosRecomendados.ias || [] },
    { title: "Plantillas y Frameworks", category: "plantillas", items: analysis.recursosRecomendados.plantillas || [] },
  ];

  if (resourceSections.some((sec) => sec.items.length > 0)) {
    md += `## 17. Biblioteca de Recursos de Soporte y Enlaces Recomendados\n`;
    resourceSections.forEach((sec) => {
      if (sec.items.length === 0) return;
      md += `### ${sec.title}\n`;
      sec.items.forEach((item) => {
        const resolved = resolveResourceLink(sec.category, item);
        const label = item.autor ? `${item.titulo} — ${item.autor}` : item.titulo;
        md += `* [${label}](${resolved.href})\n`;
      });
      md += `\n`;
    });
  }

  md += `---\n*Reporte generado por AnálisisPro — Sistema de Análisis Integral (${new Date().toLocaleDateString("es-ES")})*`;

  return md;
}

export const ANALYSIS_STAGES: AnalysisStageMeta[] = [
  {
    id: "sintesis",
    order: 1,
    title: "Comprensión y Síntesis",
    subtitle: "Resumen ejecutivo, dilema central y tesis principal.",
  },
  {
    id: "fundamentos",
    order: 2,
    title: "Glosario y Contexto 5D",
    subtitle: "Definiciones duales y ejes histórico, cultural, científico, ético y práctico.",
  },
  {
    id: "investigacion",
    order: 3,
    title: "Investigación y Perspectivas",
    subtitle: "Disciplinas, posturas contrastadas, comparación y módulos clave.",
  },
  {
    id: "decision",
    order: 4,
    title: "Matriz, Veredicto y Riesgos",
    subtitle: "Alternativas evaluadas, recomendación final y mitigación de riesgos.",
  },
  {
    id: "accion",
    order: 5,
    title: "Plan y Checklist",
    subtitle: "Plan paso a paso, acciones por horizonte y errores comunes.",
  },
  {
    id: "auditoria",
    order: 6,
    title: "Auditoría y Test",
    subtitle: "Auto-refutación, sesgos cognitivos y test diagnóstico interactivo.",
  },
  {
    id: "recursos",
    order: 7,
    title: "Discernimiento y Recursos",
    subtitle: "Reflexión profunda, concordancia y biblioteca de enlaces verificados.",
  },
];

export const ANALYSIS_STAGE_ORDER: AnalysisStageId[] = [
  "sintesis",
  "fundamentos",
  "investigacion",
  "decision",
  "accion",
  "auditoria",
  "recursos",
];

const ALLOWED_PARTIAL_ANALYSIS_KEYS = new Set<string>([
  "resumenEjecutivo",
  "comprensionProblema",
  "sintesisClave",
  "definiciones",
  "contexto",
  "analisisMultidisciplinario",
  "perspectivas",
  "comparacionObjetiva",
  "recursosRecomendados",
  "accionesPracticas",
  "riesgos",
  "matrizDecisiones",
  "recomendacionFinal",
  "planPasoAPaso",
  "erroresComunes",
  "listaVerificacion",
  "resumenFinal",
  "esBiblico",
  "especificosBiblicos",
  "esCientifico",
  "especificosCientificos",
  "auditoriaRazonamiento",
  "testDiagnostico",
  "teologiaEvangelica",
]);

export function filterValidStageIds(raw: unknown): AnalysisStageId[] {
  if (!Array.isArray(raw)) return [];
  const validSet = new Set<AnalysisStageId>();
  for (const item of raw) {
    if (typeof item === "string" && ANALYSIS_STAGE_ORDER.includes(item as AnalysisStageId)) {
      validSet.add(item as AnalysisStageId);
    }
  }
  return ANALYSIS_STAGE_ORDER.filter((stageId) => validSet.has(stageId));
}

export function pickSafePartialAnalysisData(raw: unknown): Record<string, any> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const safe: Record<string, any> = {};
  for (const [key, value] of Object.entries(raw as Record<string, any>)) {
    if (ALLOWED_PARTIAL_ANALYSIS_KEYS.has(key) && value !== undefined) {
      safe[key] = value;
    }
  }
  return safe;
}


