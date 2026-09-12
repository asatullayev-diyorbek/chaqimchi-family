"""Uzbek Telegram-message formatting for a WeeklyInsight — shared by the
bot's on-demand "AI tahlil" button and the weekly proactive push, so the
two paths never drift apart."""

_RISK_ICON = {"ok": "✅", "watch": "🤔", "concern": "⚠️"}


def format_insight_message(child_name: str, insight) -> str:
    lines = [f"🔎 AI tahlil — {child_name}", ""]
    lines.append(insight.summary)

    if insight.highlights:
        lines.append("")
        lines.append("📌 Diqqatga molik:")
        for h in insight.highlights:
            lines.append(f"• {h}")

    if insight.recommendations:
        lines.append("")
        lines.append("💡 Tavsiyalar:")
        for r in insight.recommendations:
            lines.append(f"• {r}")

    lines.append("")
    lines.append(f"{_RISK_ICON.get(insight.risk_level, '')} Holat: {insight.get_risk_level_display()}")
    return "\n".join(lines)
