export interface Definition {
  termino: string;
  definicion: string;
  explicacionSencilla?: string; // Layman style explanation for easy understanding
}

export interface ContextInfo {
  historico: string;
  cultural: string;
  cientifico: string;
  biblico: string;
  practico: string;
}

export interface MultidisciplinaryAnalysisItem {
  disciplina: string;
  analisis: string;
  relevancia: 'Alta' | 'Media' | 'Baja';
}

export interface Perspective {
  nombre: string;
  fortalezas: string[];
  debilidades: string[];
}

export interface ObjectiveComparison {
  evidencia: string;
  coherenciaLogica: string;
  resultadosObservables: string;
  compatibilidadBiblica: string;
  riesgos: string;
  beneficios: string;
  limitaciones: string;
}

export interface ResourceItem {
  titulo: string;
  autor?: string;
  url?: string;
}

export type ResourceCategory =
  | "libros"
  | "articulos"
  | "sitiosWeb"
  | "videos"
  | "cursos"
  | "herramientas"
  | "ias"
  | "software"
  | "plantillas";

export interface RecommendedResources {
  libros: ResourceItem[];
  articulos: ResourceItem[];
  sitiosWeb: ResourceItem[];
  videos: ResourceItem[];
  cursos: ResourceItem[];
  herramientas: ResourceItem[];
  ias: ResourceItem[];
  software: ResourceItem[];
  plantillas: ResourceItem[];
}

export interface PracticalActions {
  inmediatas: string[];
  estaSemana: string[];
  esteMes: string[];
  largoPlazo: string[];
}

export interface RiskItem {
  riesgo: string;
  prevencion: string;
  solucion: string;
}

export interface DecisionMatrixItem {
  alternativa: string;
  pros: string[];
  contras: string[];
  costo: string; // e.g. Bajo, Medio, Alto, o cifra
  tiempo: string;
  riesgo: string;
  beneficio: string;
  impacto: string;
  factibilidad: string;
}

export interface FinalRecommendation {
  recomendacion: string;
  justificacion: string;
  nivelConfianza: number; // e.g. 95 (percentage)
  porqueConfianza: string;
}

export interface StepItem {
  paso: number;
  titulo: string;
  descripcion: string;
}

export interface CommonErrorItem {
  error: string;
  comoEvitarlo: string;
}

// Biblical context if the theme has biblical relevance
export interface BiblicalSpecifics {
  contextoHistoricoBiblico: string;
  contextoLiterario: string;
  propositoAutor: string;
  destinatarios: string;
  principioUniversal: string;
  aplicacionActual: string;
  pasajesRelacionados: string[];
  posiblesMalasInterpretaciones: {
    interpretacion: string;
    refutacion: string;
  }[];
  conclusionExegetica: string;
}

// Scientific context if the theme has scientific relevance
export interface ScientificSpecifics {
  nivelEvidencia: string;
  consensoCientifico: string;
  limitacionesCientificas: string;
  estudiosContradictorios: string[];
  gradoCerteza: string;
}

export interface CognitiveBiasItem {
  sesgo: string;
  descripcion: string;
  comoAfecta: string;
}

export interface ReasoningAudit {
  supuestosHechos: string[];
  evidenciaContradictoria: string[];
  informacionFaltante: string[];
  sesgosCognitivos: CognitiveBiasItem[];
  escenariosFalla: string[]; // scenarios where the recommendation is NOT the best option
  disparadoresCambio: string[]; // what would change my conclusion
}

export interface DiagnosticQuestionOption {
  letra?: string;
  texto: string;
  puntajeConocimiento: number;
  puntajePsicologico: number;
  explicacionEvaluativa: string;
}

export interface DiagnosticQuestion {
  id: number;
  pregunta: string;
  dimension: 'conocimiento' | 'psicologico' | 'ambos';
  opciones: DiagnosticQuestionOption[];
}

export interface DiagnosticTest {
  tituloTest: string;
  descripcion: string;
  preguntas: DiagnosticQuestion[];
  interpretacionConocimiento: {
    nivelAlto: string;
    nivelMedio: string;
    nivelBajo: string;
  };
  interpretacionPsicologica: {
    nivelMaduro: string;
    nivelModerado: string;
    nivelVulnerable: string;
  };
}

export interface KeySynthesis {
  deQueTrata: string;
  ideaPrincipal: string;
  argumentos: string[];
  conclusion: string;
}

export interface ComprehensiveAnalysisResponse {
  resumenEjecutivo: string;
  comprensionProblema: string;
  sintesisClave?: KeySynthesis;
  definiciones: Definition[];
  contexto: ContextInfo;
  analisisMultidisciplinario: MultidisciplinaryAnalysisItem[];
  perspectivas: Perspective[];
  comparacionObjetiva: ObjectiveComparison;
  recursosRecomendados: RecommendedResources;
  accionesPracticas: PracticalActions;
  riesgos: RiskItem[];
  matrizDecisiones: DecisionMatrixItem[];
  recomendacionFinal: FinalRecommendation;
  planPasoAPaso: StepItem[];
  erroresComunes: CommonErrorItem[];
  listaVerificacion: string[];
  resumenFinal: {
    queHacer: string[];
    queNoHacer: string[];
    porque: string;
  };
  
  // Conditional structures, always included but populated if relevant
  esBiblico: boolean;
  especificosBiblicos?: BiblicalSpecifics;
  
  esCientifico: boolean;
  especificosCientificos?: ScientificSpecifics;
  
  // Reasoning Audit is mandatory
  auditoriaRazonamiento: ReasoningAudit;
  
  // Interactive Diagnostic Test for knowledge and psychological reality
  testDiagnostico?: DiagnosticTest;
  
  // Evangelical Theological Perspectives
  teologiaEvangelica?: TeologiaEvangelica;
}

export interface HeartMotiveExegesis {
  motivosSubyacentes: string[];
  posiblesIdolosCorazon: string[];
  consejoPastoralDeseos: string;
}

export interface EcclesiologicalImpact {
  servicioYComunidad: string;
  testimonioPublico: string;
  discipuladoYFamilia: string;
}

export interface RedemptiveFramework {
  creacion: string;
  caida: string;
  redencion: string;
  consumacion: string;
  conexionEvangelio: string;
}

export interface TeologiaEvangelica {
  evaluacionMotivosCorazon: HeartMotiveExegesis;
  impactoEclesiologicoPastoral: EcclesiologicalImpact;
  marcoRedentorCristocentrico: RedemptiveFramework;
  concordanciaOriginal?: AnalisisPasajeOriginal[];
}

export interface PalabraOriginal {
  palabra: string;
  transliteracion: string;
  idioma: "Hebreo" | "Griego" | string;
  strong: string;
  traduccionLiteral: string;
  significadoTeologico: string;
}

export interface AnalisisPasajeOriginal {
  pasaje: string;
  palabrasOriginales: PalabraOriginal[];
  contextoExegetico: string;
}

export interface DictionaryDefinitionResponse {
  termino: string;
  definicion: string;
  explicacionSencilla?: string;
  etimologia: string;
  contextoAcademico: string;
  categoria: string;
}

