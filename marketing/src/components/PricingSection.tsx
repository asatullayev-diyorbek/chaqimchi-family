"use client";

import { useState } from "react";
import Reveal from "./Reveal";
import { PLANS, PLAN_DURATIONS, PlanDuration, SITE, TRIAL } from "@/lib/site";

function Check() {
  return <iconify-icon icon="solar:check-circle-bold" aria-hidden />;
}

export default function PricingSection() {
  const [months, setMonths] = useState<PlanDuration>(1);
  const durationLabel = PLAN_DURATIONS.find((d) => d.months === months)?.label ?? "";

  return (
    <>
      <Reveal as="div" className="trial-banner">
        <span className="trial-badge">🎁 {TRIAL.title}</span>
        <p className="trial-note">{TRIAL.note}</p>
        <p className="trial-detail">{TRIAL.detail}</p>
      </Reveal>

      <div className="duration-toggle" role="tablist" aria-label="To'lov muddati">
        {PLAN_DURATIONS.map((d) => (
          <button
            key={d.months}
            type="button"
            role="tab"
            aria-selected={months === d.months}
            className={`duration-btn${months === d.months ? " active" : ""}`}
            onClick={() => setMonths(d.months)}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="grid grid-3 pricing-grid">
        {PLANS.map((plan, i) => {
          const isMonthly = "durations" in plan;
          const duration = isMonthly ? plan.durations.find((d) => d.months === months) : undefined;
          const price = isMonthly ? duration?.price ?? 0 : plan.price;
          const period = isMonthly ? durationLabel : plan.period;
          const hasDiscount = !!duration && duration.fullPrice > duration.price;
          const discountPct = hasDiscount
            ? Math.round((1 - duration!.price / duration!.fullPrice) * 100)
            : 0;

          return (
            <Reveal
              as="div"
              className={`price${plan.highlight ? " price-highlight" : ""}`}
              key={plan.id}
              delay={i * 90}
            >
              <div className="price-inner">
                <div className="price-top">
                  {plan.highlight && <span className="pill">Tavsiya etiladi</span>}
                  <h3>{plan.name}</h3>
                  {hasDiscount && (
                    <div className="amt-row">
                      <span className="amt-original">{duration!.fullPrice.toLocaleString("uz-UZ")} so&apos;m</span>
                      <span className="discount-badge">-{discountPct}%</span>
                    </div>
                  )}
                  <div className="amt">
                    {price.toLocaleString("uz-UZ")}{" "}
                    <span>so&apos;m / {period}</span>
                  </div>
                  {duration?.best ? <span className="best-value">Eng tejamkor</span> : null}
                </div>
                <ul>
                  {plan.points.map((point) => (
                    <li key={point}>
                      <Check /> {point}
                    </li>
                  ))}
                </ul>
                <a className={`btn ${plan.highlight ? "btn-primary" : "btn-ghost"} btn-lg`} href={SITE.botUrl}>
                  {plan.cta}
                </a>
              </div>
            </Reveal>
          );
        })}
      </div>
    </>
  );
}
