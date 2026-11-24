import React, { useState } from "react";
import {
  Sliders,
  TrendingUp,
  DollarSign,
  Clock,
  Shield,
  Zap,
  RotateCcw,
  Award,
} from "lucide-react";
import { DecisionMatrixItem, FinalRecommendation } from "../types";

interface Props {
  matrix: DecisionMatrixItem[];
  recommendation?: FinalRecommendation;
  topic: string;
}

export const ScenarioSimulator: React.FC<Props> = ({ matrix }) => {
  const [riskTolerance, setRiskTolerance] = useState<"Bajo" | "Medio" | "Alto">("Medio");
  const [budgetLevel, setBudgetLevel] = useState<"Escaso" | "Moderado" | "Abundante">("Moderado");
  const [timeHorizon, setTimeHorizon] = useState<"Corto" | "Mediano" | "Largo">("Mediano");
  const [stressLevel, setStressLevel] = useState<"Bajo" | "Moderado" | "Elevado">("Moderado");

  if (!matrix || matrix.length === 0) {
    return (
      <div className="bg-brand-bg/60 p-6 rounded-xl border border-brand-border text-center text-xs text-brand-text-muted">
        No hay alternativas suficientes en la matriz para simular escenarios.
      </div>
    );
  }

  const scoredAlternatives = matrix.map((alt) => {
    let score = 52;

    const altRisk = (alt.riesgo || "").toLowerCase();
    if (riskTolerance === "Bajo") {
      if (altRisk.includes("bajo") || altRisk.includes("mínimo")) score += 24;
      else if (altRisk.includes("alto") || altRisk.includes("severo")) score -= 24;
    } else if (riskTolerance === "Alto") {
      if (altRisk.includes("alto") || altRisk.includes("máximo")) score += 16;
      if (altRisk.includes("bajo")) score += 6;
    } else {
      if (altRisk.includes("medio") || altRisk.includes("moderado")) score += 14;
    }

    const altCost = (alt.costo || "").toLowerCase();
    if (budgetLevel === "Escaso") {
      if (altCost.includes("bajo") || altCost.includes("mínimo") || altCost.includes("económico")) score += 24;
      else if (altCost.includes("alto") || altCost.includes("elevado")) score -= 28;
    } else if (budgetLevel === "Abundante") {
      if (altCost.includes("alto") || altCost.includes("elevado")) score += 12;
    } else {
      if (altCost.includes("medio") || altCost.includes("moderado")) score += 8;
    }

    const altTime = (alt.tiempo || "").toLowerCase();
    if (timeHorizon === "Corto") {
      if (altTime.includes("inmediato") || altTime.includes("corto") || altTime.includes("días") || altTime.includes("semanas")) score += 18;
      else if (altTime.includes("largo") || altTime.includes("años")) score -= 14;
    } else if (timeHorizon === "Largo") {
      if (altTime.includes("largo") || altTime.includes("años") || altTime.includes("sostenible")) score += 18;
    }

    const altFeas = (alt.factibilidad || "").toLowerCase();
    if (stressLevel === "Elevado") {
      if (altFeas.includes("alta") || altFeas.includes("fácil") || altFeas.includes("sencilla")) score += 18;
      else score -= 14;
    }

    const altBenefit = (alt.beneficio || "").toLowerCase();
    if (altBenefit.includes("alto") || altBenefit.includes("muy alto")) score += 8;

    return {
      ...alt,
      calculatedScore: Math.min(Math.max(score, 12), 99),
    };
  });

  scoredAlternatives.sort((a, b) => b.calculatedScore - a.calculatedScore);
  const bestAlternative = scoredAlternatives[0];

  const handleReset = () => {
    setRiskTolerance("Medio");
    setBudgetLevel("Moderado");
    setTimeHorizon("Mediano");
    setStressLevel("Moderado");
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-brand-bg/70 p-5 rounded-xl border border-brand-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-gold">
            <Sliders className="w-4 h-4" />
            <span>Simulador de Sensibilidad What-If</span>
          </div>
          <h3 className="text-lg font-bold text-brand-text font-serif">
            Recálculo Dinámico de Alternativas por Restricciones
          </h3>
          <p className="text-xs text-brand-text-muted max-w-2xl leading-relaxed">
            Ajusta tus restricciones reales de riesgo, presupuesto, plazo y tolerancia al estrés para recalibrar en tiempo real qué alternativa ofrece el mejor ajuste estratégico.
          </p>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="self-start sm:self-center shrink-0 px-3.5 py-2 bg-brand-card hover:bg-brand-card-light text-brand-text-muted hover:text-brand-text rounded-lg border border-brand-border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-brand-gold" />
          <span>Restablecer</span>
        </button>
      </div>

      {/* Controls Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-3.5 sm:p-4 bg-brand-bg/60 rounded-xl border border-brand-border space-y-2.5 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-brand-text flex items-center gap-1.5 min-w-0">
              <Shield className="w-3.5 h-3.5 text-brand-gold shrink-0" />
              <span className="truncate">Riesgo</span>
            </span>
            <span className="text-xs font-mono font-bold text-brand-gold shrink-0">{riskTolerance}</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(["Bajo", "Medio", "Alto"] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setRiskTolerance(level)}
                className={`py-1.5 px-1 rounded-lg text-[11px] sm:text-xs font-bold truncate transition cursor-pointer ${
                  riskTolerance === level
                    ? "bg-brand-gold text-slate-950 font-extrabold"
                    : "bg-brand-card text-brand-text-muted hover:text-brand-text border border-brand-border"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3.5 sm:p-4 bg-brand-bg/60 rounded-xl border border-brand-border space-y-2.5 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-brand-text flex items-center gap-1.5 min-w-0">
              <DollarSign className="w-3.5 h-3.5 text-sem-emerald shrink-0" />
              <span className="truncate">Presupuesto</span>
            </span>
            <span className="text-xs font-mono font-bold text-sem-emerald shrink-0">{budgetLevel}</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(["Escaso", "Moderado", "Abundante"] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setBudgetLevel(level)}
                className={`py-1.5 px-1 rounded-lg text-[11px] sm:text-xs font-bold truncate transition cursor-pointer ${
                  budgetLevel === level
                    ? "bg-brand-gold text-slate-950 font-extrabold"
                    : "bg-brand-card text-brand-text-muted hover:text-brand-text border border-brand-border"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3.5 sm:p-4 bg-brand-bg/60 rounded-xl border border-brand-border space-y-2.5 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-brand-text flex items-center gap-1.5 min-w-0">
              <Clock className="w-3.5 h-3.5 text-sem-sky shrink-0" />
              <span className="truncate">Horizonte</span>
            </span>
            <span className="text-xs font-mono font-bold text-sem-sky shrink-0">{timeHorizon}</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(["Corto", "Mediano", "Largo"] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setTimeHorizon(level)}
                className={`py-1.5 px-1 rounded-lg text-[11px] sm:text-xs font-bold truncate transition cursor-pointer ${
                  timeHorizon === level
                    ? "bg-brand-gold text-slate-950 font-extrabold"
                    : "bg-brand-card text-brand-text-muted hover:text-brand-text border border-brand-border"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3.5 sm:p-4 bg-brand-bg/60 rounded-xl border border-brand-border space-y-2.5 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-brand-text flex items-center gap-1.5 min-w-0">
              <Zap className="w-3.5 h-3.5 text-sem-violet shrink-0" />
              <span className="truncate">Presión / Estrés</span>
            </span>
            <span className="text-xs font-mono font-bold text-sem-violet shrink-0">{stressLevel}</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(["Bajo", "Moderado", "Elevado"] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setStressLevel(level)}
                className={`py-1.5 px-1 rounded-lg text-[11px] sm:text-xs font-bold truncate transition cursor-pointer ${
                  stressLevel === level
                    ? "bg-brand-gold text-slate-950 font-extrabold"
                    : "bg-brand-card text-brand-text-muted hover:text-brand-text border border-brand-border"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Outcome Card */}
      <div className="bg-brand-bg/70 p-5 rounded-xl border border-brand-gold/40 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-brand-border pb-4">
          <div className="space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-brand-gold flex items-center gap-1.5">
              <Award className="w-4 h-4" />
              <span>Alternativa Óptima Según tus Parámetros</span>
            </div>
            <h4 className="text-base sm:text-lg font-bold text-brand-text font-serif">
              {bestAlternative.alternativa}
            </h4>
            <p className="text-xs text-brand-text-muted">
              Costo: <strong className="text-brand-text">{bestAlternative.costo}</strong> · Tiempo:{" "}
              <strong className="text-brand-text">{bestAlternative.tiempo}</strong> · Riesgo:{" "}
              <strong className="text-brand-text">{bestAlternative.riesgo}</strong> · Factibilidad:{" "}
              <strong className="text-brand-text">{bestAlternative.factibilidad}</strong>
            </p>
          </div>

          <div className="text-left md:text-right shrink-0">
            <div className="text-[11px] uppercase font-bold text-brand-text-muted">Ajuste Simulado</div>
            <div className="text-3xl font-extrabold text-brand-gold font-mono tabular-nums">
              {bestAlternative.calculatedScore}%
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-brand-text-muted flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-brand-gold" />
            <span>Clasificación Comparativa en Tiempo Real</span>
          </div>

          <div className="space-y-2">
            {scoredAlternatives.map((alt, idx) => (
              <div
                key={idx}
                className="p-3 bg-brand-card/70 rounded-lg border border-brand-border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span
                    className={`w-6 h-6 rounded-md font-mono font-bold text-xs flex items-center justify-center shrink-0 tabular-nums ${
                      idx === 0
                        ? "bg-brand-gold text-slate-950"
                        : "bg-brand-bg text-brand-text-muted border border-brand-border"
                    }`}
                  >
                    #{idx + 1}
                  </span>
                  <span className="text-xs font-semibold text-brand-text leading-snug break-words">
                    {alt.alternativa}
                  </span>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-56 shrink-0">
                  <div className="flex-1 bg-brand-bg h-2 rounded-full overflow-hidden border border-brand-border">
                    <div
                      className={`h-full transition-all duration-300 ${
                        idx === 0 ? "bg-brand-gold" : "bg-brand-text-muted/50"
                      }`}
                      style={{ width: `${alt.calculatedScore}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono font-bold text-brand-text w-10 text-right tabular-nums">
                    {alt.calculatedScore}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
