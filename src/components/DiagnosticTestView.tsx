import React, { useState } from "react";
import { motion } from "motion/react";
import {
  BrainCircuit,
  RotateCcw,
  BarChart3,
  Award,
  Sparkles,
  Target,
  Lightbulb,
  Check,
  ShieldCheck,
} from "lucide-react";
import { DiagnosticTest } from "../types";

interface Props {
  test: DiagnosticTest;
  topic: string;
}

export const DiagnosticTestView: React.FC<Props> = ({ test, topic }) => {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const totalQuestions = test.preguntas.length;
  const answeredCount = Object.keys(selectedAnswers).length;
  const isComplete = answeredCount === totalQuestions;

  const handleSelectOption = (questionId: number, optionIndex: number) => {
    if (submitted) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex,
    }));
  };

  let maxKnowledgeScore = 0;
  let obtainedKnowledgeScore = 0;
  let maxPsychScore = 0;
  let obtainedPsychScore = 0;

  test.preguntas.forEach((q) => {
    const qMaxK = Math.max(...q.opciones.map((o) => o.puntajeConocimiento || 0), 1);
    const qMaxP = Math.max(...q.opciones.map((o) => o.puntajePsicologico || 0), 1);
    maxKnowledgeScore += qMaxK;
    maxPsychScore += qMaxP;

    const chosenIdx = selectedAnswers[q.id];
    if (chosenIdx !== undefined && q.opciones[chosenIdx]) {
      obtainedKnowledgeScore += q.opciones[chosenIdx].puntajeConocimiento || 0;
      obtainedPsychScore += q.opciones[chosenIdx].puntajePsicologico || 0;
    }
  });

  const knowledgePct = maxKnowledgeScore > 0 ? Math.round((obtainedKnowledgeScore / maxKnowledgeScore) * 100) : 0;
  const psychPct = maxPsychScore > 0 ? Math.round((obtainedPsychScore / maxPsychScore) * 100) : 0;

  let knowledgeLevel = "Bajo / Intuitivo";
  let knowledgeDesc = test.interpretacionConocimiento.nivelBajo;
  if (knowledgePct >= 75) {
    knowledgeLevel = "Avanzado / Dominio Técnico";
    knowledgeDesc = test.interpretacionConocimiento.nivelAlto;
  } else if (knowledgePct >= 45) {
    knowledgeLevel = "Intermedio / Conceptual";
    knowledgeDesc = test.interpretacionConocimiento.nivelMedio;
  }

  let psychLevel = "Vulnerable / Sesgos Activos";
  let psychDesc = test.interpretacionPsicologica.nivelVulnerable;
  if (psychPct >= 75) {
    psychLevel = "Maduro / Alta Neutralidad";
    psychDesc = test.interpretacionPsicologica.nivelMaduro;
  } else if (psychPct >= 45) {
    psychLevel = "Moderado / En Calibración";
    psychDesc = test.interpretacionPsicologica.nivelModerado;
  }

  let profileTitle = "";
  let profileStyle = "";
  let profileSummary = "";

  if (knowledgePct >= 65 && psychPct >= 65) {
    profileTitle = "Estratega Técnico y Emocionalmente Maduro";
    profileStyle = "bg-sem-emerald-bg text-sem-emerald border-sem-emerald-border";
    profileSummary =
      "Posees un nivel sólido de información objetiva combinado con disciplina cognitiva. Estás en condiciones óptimas para decidir con serenidad y ejecutar sin caer en sesgos impulsivos.";
  } else if (knowledgePct >= 65 && psychPct < 65) {
    profileTitle = "Analista Técnico con Riesgo de Sesgo Emocional";
    profileStyle = "bg-sem-amber-bg text-sem-amber border-sem-amber-border";
    profileSummary =
      "Cuentas con datos suficientes, pero existe tensión, prisa o resistencia a ajustar expectativas. Cuida no utilizar argumentos técnicos para racionalizar una preferencia emocional.";
  } else if (knowledgePct < 65 && psychPct >= 65) {
    profileTitle = "Mente Abierta · Requiere Profundizar Evidencia";
    profileStyle = "bg-sem-sky-bg text-sem-sky border-sem-sky-border";
    profileSummary =
      "Demuestras madurez emocional y apertura a la verdad, pero necesitas estudiar los datos duros, riesgos y fundamentos antes de comprometerte con una acción definitiva.";
  } else {
    profileTitle = "Exploración Inicial · Pausa Estratégica Sugerida";
    profileStyle = "bg-sem-rose-bg text-sem-rose border-sem-rose-border";
    profileSummary =
      "Tu base técnica actual es preliminar y existe una carga emocional relevante. Conviene revisar primero la investigación multidisciplinaria y la auditoría de sesgos antes de decidir.";
  }

  const handleReset = () => {
    setSelectedAnswers({});
    setSubmitted(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-brand-bg/70 p-5 sm:p-6 rounded-xl border border-brand-border space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-gold">
            <BrainCircuit className="w-4 h-4 shrink-0" />
            <span>Evaluación Diagnóstica de Conocimiento y Criterio</span>
          </div>
          <span className="text-xs font-mono text-brand-text-muted tabular-nums">
            {totalQuestions} reactivos evaluativos
          </span>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-brand-text font-serif leading-snug">
          {test.tituloTest}
        </h2>

        <p className="text-sm text-brand-text-muted leading-relaxed max-w-3xl">
          {test.descripcion}
        </p>

        <div className="pt-2 border-t border-brand-border/60 text-xs text-brand-text-muted flex items-center gap-2">
          <Target className="w-4 h-4 text-brand-gold shrink-0" />
          <span>
            Objeto de evaluación: <strong className="text-brand-text font-serif">{topic}</strong>
          </span>
        </div>
      </div>

      {/* Progress Strip */}
      {!submitted && (
        <div className="bg-brand-bg/50 p-4 rounded-xl border border-brand-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-card border border-brand-border flex items-center justify-center text-brand-gold shrink-0">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-brand-text tabular-nums">
                Progreso del diagnóstico: {answeredCount} de {totalQuestions} respondidas
              </div>
              <div className="text-[11px] text-brand-text-muted">
                Elige la opción que describa con mayor honestidad tu posición actual.
              </div>
            </div>
          </div>

          <div className="w-full sm:w-52 bg-brand-card h-2 rounded-full border border-brand-border overflow-hidden">
            <div
              className="bg-brand-gold h-full transition-all duration-300"
              style={{ width: `${totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Results Panel */}
      {submitted && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-brand-bg/70 p-5 sm:p-6 rounded-xl border border-brand-gold/40 space-y-5"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brand-border pb-4">
            <div className="space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-brand-text-muted flex items-center gap-1.5">
                <Award className="w-4 h-4 text-brand-gold" />
                <span>Diagnóstico Consolidado</span>
              </div>
              <h3 className="text-lg font-bold text-brand-text font-serif">
                Perfil de Preparación Técnica y Madurez Cognitiva
              </h3>
            </div>

            <div className={`px-3.5 py-2 rounded-lg border font-bold text-xs text-center sm:text-left break-words ${profileStyle}`}>
              {profileTitle}
            </div>
          </div>

          <p className="text-sm text-brand-text leading-relaxed bg-brand-card/70 p-4 rounded-lg border border-brand-border break-words">
            {profileSummary}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 sm:p-5 bg-brand-card rounded-xl border border-brand-border space-y-3 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 bg-sem-sky-bg rounded-lg text-sem-sky border border-sem-sky-border shrink-0">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-brand-text-muted uppercase tracking-wider">
                      Conocimiento Técnico
                    </div>
                    <div className="text-sm font-bold text-brand-text break-words">{knowledgeLevel}</div>
                  </div>
                </div>
                <span className="text-2xl font-extrabold text-sem-sky font-mono tabular-nums shrink-0">
                  {knowledgePct}%
                </span>
              </div>

              <div className="w-full bg-brand-bg h-2 rounded-full overflow-hidden border border-brand-border">
                <div
                  className="bg-sem-sky h-full transition-all duration-500"
                  style={{ width: `${knowledgePct}%` }}
                />
              </div>

              <p className="text-xs text-brand-text-muted leading-relaxed">{knowledgeDesc}</p>
            </div>

            <div className="p-4 sm:p-5 bg-brand-card rounded-xl border border-brand-border space-y-3 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 bg-sem-violet-bg rounded-lg text-sem-violet border border-sem-violet-border shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-brand-text-muted uppercase tracking-wider">
                      Realidad Psicológica
                    </div>
                    <div className="text-sm font-bold text-brand-text break-words">{psychLevel}</div>
                  </div>
                </div>
                <span className="text-2xl font-extrabold text-sem-violet font-mono tabular-nums shrink-0">
                  {psychPct}%
                </span>
              </div>

              <div className="w-full bg-brand-bg h-2 rounded-full overflow-hidden border border-brand-border">
                <div
                  className="bg-sem-violet h-full transition-all duration-500"
                  style={{ width: `${psychPct}%` }}
                />
              </div>

              <p className="text-xs text-brand-text-muted leading-relaxed">{psychDesc}</p>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 bg-brand-card hover:bg-brand-card-light text-brand-text border border-brand-border rounded-lg text-xs font-bold flex items-center gap-2 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-brand-gold" />
              <span>Repetir Evaluación</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* Questions List */}
      <div className="space-y-4">
        {test.preguntas.map((q, qIndex) => {
          const selectedOptIdx = selectedAnswers[q.id];
          const isAnswered = selectedOptIdx !== undefined;

          return (
            <div
              key={q.id}
              className={`p-4 sm:p-5 rounded-xl border transition-all ${
                submitted
                  ? "bg-brand-bg/50 border-brand-border"
                  : isAnswered
                  ? "bg-brand-bg/75 border-brand-gold/50"
                  : "bg-brand-bg/40 border-brand-border hover:border-brand-border-focus"
              }`}
            >
              <div className="flex flex-col gap-2 mb-4 pb-3 border-b border-brand-border/60">
                <div className="flex items-center justify-between gap-2 text-[11px] text-brand-text-muted">
                  <span className="font-semibold text-brand-gold uppercase tracking-wider flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" />
                    {q.dimension === "conocimiento"
                      ? "Dimensión Técnica"
                      : q.dimension === "psicologico"
                      ? "Dimensión Psicológica"
                      : "Dimensión Integral"}
                  </span>
                  <span className="font-mono tabular-nums">
                    Reactivo {qIndex + 1} / {test.preguntas.length}
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-lg bg-brand-card border border-brand-border text-brand-gold font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                    {qIndex + 1}
                  </span>
                  <h4 className="text-sm sm:text-base font-bold text-brand-text leading-snug flex-1 font-serif">
                    {q.pregunta}
                  </h4>
                </div>
              </div>

              <div className="space-y-2">
                {q.opciones.map((opt, optIndex) => {
                  const isSelected = selectedOptIdx === optIndex;
                  const letter = opt.letra || String.fromCharCode(65 + optIndex);

                  return (
                    <button
                      key={optIndex}
                      type="button"
                      disabled={submitted}
                      onClick={() => handleSelectOption(q.id, optIndex)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${
                        isSelected
                          ? "bg-brand-gold/12 border-brand-gold text-brand-text"
                          : "bg-brand-card/70 border-brand-border text-brand-text-muted hover:text-brand-text hover:border-brand-gold/40"
                      } ${submitted ? "cursor-default" : ""}`}
                    >
                      <span
                        className={`w-6 h-6 rounded-md border flex items-center justify-center text-xs font-mono font-bold shrink-0 mt-0.5 ${
                          isSelected
                            ? "bg-brand-gold border-brand-gold text-slate-950"
                            : "border-brand-border text-brand-text-muted bg-brand-bg"
                        }`}
                      >
                        {isSelected ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : letter}
                      </span>

                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs sm:text-sm leading-relaxed text-brand-text font-medium">
                          {opt.texto}
                        </span>

                        {submitted && isSelected && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="mt-2.5 p-3 bg-brand-bg rounded-lg border border-brand-gold/30 text-xs text-brand-text leading-relaxed flex items-start gap-2"
                          >
                            <Lightbulb className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
                            <div>
                              <strong className="text-brand-gold font-semibold">Lectura diagnóstica:</strong>{" "}
                              {opt.explicacionEvaluativa}
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Submit */}
      {!submitted && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            disabled={!isComplete}
            onClick={() => setSubmitted(true)}
            className={`w-full sm:w-auto px-5 sm:px-7 py-3 rounded-xl font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              isComplete
                ? "bg-brand-gold hover:bg-brand-gold-hover text-slate-950 font-extrabold cursor-pointer shadow-md"
                : "bg-brand-bg text-brand-text-muted/50 border border-brand-border cursor-not-allowed"
            }`}
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>
              {isComplete
                ? "Calcular Diagnóstico Integral"
                : `Responde ${totalQuestions - answeredCount} preguntas restantes`}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
