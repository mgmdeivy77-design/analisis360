import {
  Activity,
  Award,
  BookMarked,
  BookOpen,
  Compass,
  DollarSign,
  FileCode2,
  Scale,
  Sparkles,
  Brain,
  ShieldCheck,
  Layers,
  ListChecks,
  BrainCircuit,
} from "lucide-react";

export interface CategoryOption {
  id: string;
  label: string;
  shortLabel: string;
  icon: typeof Sparkles;
  desc: string;
  methodologyNote: string;
}

export const CATEGORY_OPTIONS: CategoryOption[] = [
  {
    id: "General",
    label: "General / Multi-disciplinario",
    shortLabel: "Integral",
    icon: Sparkles,
    desc: "Análisis holístico desde la lógica formal, evidencia empírica, ética y viabilidad práctica.",
    methodologyNote: "Integra ciencia, economía, psicología y filosofía sin sesgo disciplinario previo.",
  },
  {
    id: "Toma de Decisiones",
    label: "Toma de Decisiones y Estrategia",
    shortLabel: "Decisiones",
    icon: Compass,
    desc: "Evaluación de alternativas, matrices de riesgo, costo/beneficio y plan de ejecución.",
    methodologyNote: "Prioriza análisis de sensibilidad, costo de oportunidad y mitigación de riesgos.",
  },
  {
    id: "Ciencia y Tecnología",
    label: "Ciencia y Tecnología",
    shortLabel: "Ciencia / Tech",
    icon: Activity,
    desc: "Evidencia empírica, consenso científico, arquitectura técnica y límites metodológicos.",
    methodologyNote: "Evalúa jerarquía de evidencia, replicabilidad y estudios contradictorios.",
  },
  {
    id: "Negocios y Finanzas",
    label: "Negocios, Finanzas y Economía",
    shortLabel: "Finanzas",
    icon: DollarSign,
    desc: "Finanzas personales, asignación de capital, modelos de negocio y macroeconomía.",
    methodologyNote: "Analiza flujo de caja, riesgo asimétrico, liquidez y horizonte temporal.",
  },
  {
    id: "Filosofía y Ética",
    label: "Filosofía, Ética y Sociedad",
    shortLabel: "Ética",
    icon: Scale,
    desc: "Dilemas morales, coherencia lógica, marcos éticos e impacto institucional o social.",
    methodologyNote: "Contrasta deontología, consecuencialismo y ética de la virtud con rigor lógico.",
  },
  {
    id: "Salud y Psicología",
    label: "Salud, Psicología y Bienestar",
    shortLabel: "Salud / Mente",
    icon: Award,
    desc: "Salud física y mental, neurociencia conductual, hábitos y regulación emocional.",
    methodologyNote: "Distingue intervenciones con respaldo clínico de tendencias sin evidencia.",
  },
  {
    id: "Historia y Política",
    label: "Análisis Histórico y Político",
    shortLabel: "Historia",
    icon: BookOpen,
    desc: "Contexto histórico, instituciones, políticas públicas y dinámicas geopolíticas.",
    methodologyNote: "Analiza fuentes primarias, causalidad histórica e incentivos institucionales.",
  },
  {
    id: "Bíblico y Teológico",
    label: "Bíblico y Teológico",
    shortLabel: "Teología",
    icon: BookMarked,
    desc: "Exégesis histórico-gramatical, idiomas originales (hebreo/griego) y teología sistemática.",
    methodologyNote: "Aplica hermenéutica contextual, lexicografía Strong y teología bíblica.",
  },
  {
    id: "Manual",
    label: "Solicitud Manual (Enfoque Personalizado)",
    shortLabel: "Manual",
    icon: FileCode2,
    desc: "Define un marco disciplinario específico a la medida (derecho, docencia, ingeniería, etc.).",
    methodologyNote: "Adapta terminología, fuentes y criterios de evaluación al dominio indicado.",
  },
];

export interface FrameworkOption {
  id: string;
  label: string;
  summary: string;
}

export const TRADITION_OPTIONS: FrameworkOption[] = [
  {
    id: "General / Neutral (Sin Sesgo)",
    label: "General / Neutral (Sin Sesgo)",
    summary: "Balance epistémico abierto orientado a evidencia verificable y lógica imparcial.",
  },
  {
    id: "Sabiduría práctica y habilidades sociales",
    label: "Sabiduría práctica y habilidades sociales",
    summary: "Prioriza prudencia operativa (phrónēsis), asertividad, tacto diplomático y manejo de conflictos.",
  },
  {
    id: "Perspectiva Científica Empírica",
    label: "Perspectiva Científica Empírica",
    summary: "Enfoque estricto en revisiones sistemáticas, falsabilidad y evidencia cuantificable.",
  },
  {
    id: "Perspectiva Ética y Secular",
    label: "Perspectiva Ética y Secular",
    summary: "Razonamiento moral universal basado en derechos, dignidad humana y coherencia racional.",
  },
  {
    id: "Pragmático / Estratégico",
    label: "Pragmático / Estratégico",
    summary: "Foco en ejecución realista, eficiencia de recursos, retorno esperado y control de daños.",
  },
  {
    id: "Teológico Cristiano (General / No Denominacional)",
    label: "Teológico Cristiano (General / No Denominacional)",
    summary: "Cosmovisión bíblica histórica centrada en el consenso ortodoxo cristiano y la Escritura.",
  },
  {
    id: "Teológico Reformado / Calvinista",
    label: "Teológico Reformado / Calvinista",
    summary: "Énfasis en la soberanía de Dios, teología del pacto y exégesis histórico-redentora.",
  },
  {
    id: "Teológico Arminiano / Metodista",
    label: "Teológico Arminiano / Metodista",
    summary: "Énfasis en la gracia preveniente, responsabilidad moral humana y santidad práctica.",
  },
  {
    id: "Teológico Bautista",
    label: "Teológico Bautista",
    summary: "Autoridad suprema de la Escritura, eclesiología congregacional y libertad de conciencia.",
  },
  {
    id: "Teológico Pentecostal / Carismático",
    label: "Teológico Pentecostal / Carismático",
    summary: "Énfasis en la obra presente del Espíritu Santo, misión integral y discernimiento pastoral.",
  },
];

export interface PresetTemplate {
  id: string;
  title: string;
  focus: string;
  tradition?: string;
  group: "Decisiones" | "Ciencia y Tech" | "Finanzas" | "Ética y Fe" | "Salud" | "Habilidades Sociales";
  prompt: string;
  depthHint: string;
}

export const PRESET_LIBRARY: PresetTemplate[] = [
  {
    id: "p-relocalizacion",
    title: "Mudar de Ciudad por Oferta Laboral",
    focus: "Toma de Decisiones",
    group: "Decisiones",
    prompt: "Decidir si aceptar una oferta laboral en el extranjero que duplica el ingreso actual pero implica relocalizar a toda la familia y perder la red de apoyo local.",
    depthHint: "Evalúa costo de vida real, impacto familiar, reversibilidad y matriz de transición.",
  },
  {
    id: "p-emprender",
    title: "Renunciar a Empleo Estable para Emprender",
    focus: "Toma de Decisiones",
    group: "Decisiones",
    prompt: "Analizar los riesgos financieros, psicológicos y operativos de dejar un puesto corporativo con 8 años de antigüedad para lanzar una empresa de servicios tecnológicos.",
    depthHint: "Incluye colchón de liquidez, validación previa (PMV) y escenarios de falla.",
  },
  {
    id: "p-socios",
    title: "Desacuerdo Estratégico entre Socios",
    focus: "Toma de Decisiones",
    group: "Decisiones",
    prompt: "Metodología objetiva para resolver un desacuerdo grave de visión y reparto de responsabilidades entre socios fundadores de una empresa en crecimiento.",
    depthHint: "Gobernanza societaria, acuerdos de salida y mediación estructurada.",
  },
  {
    id: "p-ia-verdad",
    title: "IA, Deepfakes y Verificación Digital",
    focus: "Ciencia y Tecnología",
    group: "Ciencia y Tech",
    prompt: "¿Cuáles son las consecuencias técnicas, epistemológicas y sociales de la proliferación de contenido sintético generado por IA para la confianza pública y la verificación de hechos?",
    depthHint: "Criptografía de procedencia, detección técnica y alfabetización mediática.",
  },
  {
    id: "p-energia",
    title: "Transición Energética y Redes Eléctricas",
    focus: "Ciencia y Tecnología",
    group: "Ciencia y Tech",
    prompt: "Viabilidad técnica, almacenamiento a gran escala, estabilidad de red y costo económico real de una transición acelerada hacia energías renovables intermitentes.",
    depthHint: "Factor de planta, baterías LFP, energía base nuclear/hidro y costos sistémicos.",
  },
  {
    id: "p-cosmologia",
    title: "Cosmología Moderna y Origen del Universo",
    focus: "Ciencia y Tecnología",
    group: "Ciencia y Tech",
    prompt: "Estado actual de la evidencia observacional del modelo cosmológico estándar (Lambda-CDM), la tensión de Hubble y las fronteras de la física teórica.",
    depthHint: "Radiación cósmica de fondo, mediciones JWST y límites de falsabilidad.",
  },
  {
    id: "p-cripto-indexados",
    title: "Criptoactivos vs. Fondos Indexados",
    focus: "Negocios y Finanzas",
    group: "Finanzas",
    prompt: "¿Cómo asignar de forma racional capital de largo plazo entre fondos indexados globales diversificados y activos digitales de alta volatilidad como Bitcoin?",
    depthHint: "Ratio de Sharpe, correlación histórica, riesgo de custodia y horizonte de 10+ años.",
  },
  {
    id: "p-fire",
    title: "Estrategia de Independencia Financiera (FIRE)",
    focus: "Negocios y Finanzas",
    group: "Finanzas",
    prompt: "Evaluación matemática y práctica de la regla del 4%, riesgo de secuencia de retornos, inflación y diversificación patrimonial para retiro anticipado.",
    depthHint: "Simulación de estrés financiero, liquidez de emergencia y ajuste dinámico de gasto.",
  },
  {
    id: "p-deuda-hipoteca",
    title: "Amortizar Hipoteca vs. Invertir Excedente",
    focus: "Negocios y Finanzas",
    group: "Finanzas",
    prompt: "Criterios cuantitativos y psicológicos para decidir entre liquidar anticipadamente una deuda hipotecaria a tasa fija o invertir el capital excedente.",
    depthHint: "Diferencial de tasa real post-impuestos, aversión al apalancamiento y paz mental.",
  },
  {
    id: "p-crispr",
    title: "Bioética de la Edición Genética (CRISPR)",
    focus: "Filosofía y Ética",
    group: "Ética y Fe",
    prompt: "Evaluación ética, médica y regulatoria de la edición genética germinal frente a terapias somáticas en enfermedades hereditarias graves.",
    depthHint: "Consentimiento intergeneracional, efectos off-target y dignidad humana.",
  },
  {
    id: "p-soberania-albedrio",
    title: "Soberanía Divina y Responsabilidad Humana",
    focus: "Bíblico y Teológico",
    tradition: "Teológico Cristiano (General / No Denominacional)",
    group: "Ética y Fe",
    prompt: "Estudio exegético e histórico-gramatical sobre cómo armonizan las Escrituras la soberanía absoluta de Dios y la responsabilidad moral real del ser humano.",
    depthHint: "Análisis de vocablos griegos/hebreos, pasajes clave y posturas históricas.",
  },
  {
    id: "p-sufrimiento",
    title: "Teodicea y el Problema del Sufrimiento",
    focus: "Bíblico y Teológico",
    tradition: "Teológico Cristiano (General / No Denominacional)",
    group: "Ética y Fe",
    prompt: "Análisis filosófico y bíblico-exegético sobre la existencia del mal, el sufrimiento injusto y la respuesta cristiana desde la teología de la cruz y el libro de Job.",
    depthHint: "Distinción entre mal moral y natural, consuelo pastoral y esperanza escatológica.",
  },
  {
    id: "p-dopamina",
    title: "Atención Fragmentada y Higiene Digital",
    focus: "Salud y Psicología",
    group: "Salud",
    prompt: "Mecanismos neurobiológicos de la sobreestimulación por pantallas y redes sociales, y qué protocolos conductuales tienen evidencia sólida para restaurar la concentración.",
    depthHint: "Circuitos dopaminérgicos, fricción ambiental y métricas de atención sostenida.",
  },
  {
    id: "p-ansiedad-tcc",
    title: "Manejo de Ansiedad Crónica Basado en Evidencia",
    focus: "Salud y Psicología",
    group: "Salud",
    prompt: "Comparativa objetiva entre terapia cognitivo-conductual (TCC), exposición gradual, higiene del sueño y regulación fisiológica frente a la ansiedad persistente.",
    depthHint: "Ensayos clínicos controlados, límites de autoayuda y cuándo acudir a especialista.",
  },
  {
    id: "p-limites",
    title: "Establecer Límites Asertivos sin Ruptura",
    focus: "Toma de Decisiones",
    tradition: "Sabiduría práctica y habilidades sociales",
    group: "Habilidades Sociales",
    prompt: "¿Cómo establecer límites firmes, claros y respetuosos ante un familiar o colega invasivo sin caer en culpa, pasivo-agresividad ni ruptura innecesaria?",
    depthHint: "Guiones de comunicación no violenta, consistencia conductual y calibración relacional.",
  },
  {
    id: "p-negociacion",
    title: "Negociar Aumento Salarial o Alcance",
    focus: "Negocios y Finanzas",
    tradition: "Sabiduría práctica y habilidades sociales",
    group: "Habilidades Sociales",
    prompt: "Cómo preparar y conducir una conversación difícil de compensación aplicando anclaje objetivo, lectura de prioridades de la otra parte, diplomacia y timing.",
    depthHint: "BATNA, evidencia de impacto medible y manejo de objeciones con serenidad.",
  },
  {
    id: "p-timing",
    title: "Prudencia Práctica: Cuándo Hablar y Cuándo Callar",
    focus: "Filosofía y Ética",
    tradition: "Sabiduría práctica y habilidades sociales",
    group: "Habilidades Sociales",
    prompt: "Criterios de prudencia práctica (phrónēsis) para discernir cuándo confrontar un error en público o privado y cuándo ejercer silencio estratégico.",
    depthHint: "Lectura de contexto, costo relacional vs. beneficio correctivo.",
  },
  {
    id: "p-jornada-4dias",
    title: "Semana Laboral de 4 Días y Productividad",
    focus: "General",
    group: "Finanzas",
    prompt: "Impacto real en productividad por hora, retención de talento, costos operativos y fatiga laboral tras la adopción de la semana de 4 días en distintos sectores.",
    depthHint: "Resultados de ensayos piloto internacionales y diferencias por industria.",
  },
];

export const LOADING_PHASES = [
  "Analizando la pregunta explícita y el dilema subyacente...",
  "Construyendo glosario dual (definiciones técnicas y analogías cotidianas)...",
  "Contrastando contexto histórico, científico, cultural, ético y práctico...",
  "Evaluando aportes desde múltiples disciplinas académicas y profesionales...",
  "Contrastando escuelas de pensamiento, fortalezas y debilidades...",
  "Calculando matriz de alternativas, costos, riesgos y contingencias...",
  "Estructurando plan paso a paso, checklist y errores comunes a evitar...",
  "Ejecutando auditoría crítica de sesgos cognitivos y escenarios de falla...",
  "Verificando enlaces de recursos recomendados y finalizando reporte...",
];

export interface ColorThemeMeta {
  id: "sage" | "sepia" | "slate" | "midnight";
  name: string;
  shortName: string;
  tagline: string;
  desc: string;
  bgHex: string;
  cardHex: string;
  accentHex: string;
  isLight?: boolean;
}

export const COLOR_THEMES: ColorThemeMeta[] = [
  {
    id: "sage",
    name: "Verde Bosque Anti-Fatiga",
    shortName: "Bosque",
    tagline: "Descanso visual prolongado",
    desc: "Tonos verdes profundos de bajo brillo diseñados para lectura extensa.",
    bgHex: "#0e1612",
    cardHex: "#14201a",
    accentHex: "#6ec98f",
  },
  {
    id: "sepia",
    name: "Sepia Pergamino Cálido",
    shortName: "Sepia",
    tagline: "Papel diurno sin deslumbramiento",
    desc: "Fondo editorial cálido inspirado en papel impreso para uso con luz natural.",
    bgHex: "#f4efe4",
    cardHex: "#fcf9f2",
    accentHex: "#9a5b13",
    isLight: true,
  },
  {
    id: "slate",
    name: "Pizarra Carbón Neutro",
    shortName: "Pizarra",
    tagline: "Gris mate de sobriedad técnica",
    desc: "Neutro equilibrado sin emisión azul intensa para análisis numérico.",
    bgHex: "#131519",
    cardHex: "#1b1e24",
    accentHex: "#e0a458",
  },
  {
    id: "midnight",
    name: "Noche Azul Profundo",
    shortName: "Noche",
    tagline: "Luminancia nocturna suavizada",
    desc: "Azul marino atenuado para sesiones nocturnas de estudio y escritura.",
    bgHex: "#0c131d",
    cardHex: "#131d2b",
    accentHex: "#d6a756",
  },
];

export const THEME_META_COLORS: Record<string, string> = {
  sage: "#0e1612",
  sepia: "#f4efe4",
  slate: "#131519",
  midnight: "#0c131d",
};

export const METHODOLOGICAL_PILLARS = [
  {
    step: "01",
    title: "Síntesis y Glosario Dual",
    icon: Brain,
    desc: "Descompone el dilema real detrás de la pregunta, fija 5–7 conceptos clave con explicación académica y cotidiana, y sitúa el tema en 5 ejes contextuales.",
  },
  {
    step: "02",
    title: "Investigación Multidisciplinaria",
    icon: Layers,
    desc: "Cruza evidencia empírica, lógica formal, economía, psicología y exégesis histórico-gramatical cuando el tema tiene relevancia bíblica o ética.",
  },
  {
    step: "03",
    title: "Contraste y Simulador What-If",
    icon: Scale,
    desc: "Compara escuelas de pensamiento con sus debilidades reales y recalcula alternativas estratégicas en vivo según tu tolerancia al riesgo, presupuesto y tiempo.",
  },
  {
    step: "04",
    title: "Ejecución, Riesgos y Checklist",
    icon: ListChecks,
    desc: "Traduce el análisis en pasos secuenciales, acciones por horizonte temporal, matriz de prevención/contingencia y lista de verificación interactiva.",
  },
  {
    step: "05",
    title: "Auditoría de Sesgos y Diagnóstico",
    icon: ShieldCheck,
    desc: "Somete la conclusión a auto-refutación (supuestos, evidencia contraria, sesgos cognitivos) e incluye un test diagnóstico de madurez y conocimiento.",
  },
  {
    step: "06",
    title: "Biblioteca de Recursos Verificados",
    icon: BrainCircuit,
    desc: "Agrupa libros, artículos académicos, cursos, software y herramientas de IA con enlaces directos verificados o búsqueda académica precisa.",
  },
];
