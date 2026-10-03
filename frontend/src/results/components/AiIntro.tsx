interface AiIntroProps {
  intro: string;
}

/**
 * The agent's personalized opening message. Styled to feel like it's "spoken" by the
 * agent (avatar + bubble) without turning the page into a chat UI — it's a single,
 * confident statement, then the plan itself takes over.
 */
export function AiIntro({ intro }: AiIntroProps) {
  return (
    <section className="ai-intro" aria-label="Your travel agent's summary">
      <div className="ai-intro__avatar" aria-hidden="true">
        <span>🧭</span>
      </div>
      <div className="ai-intro__bubble">
        <p className="ai-intro__who">GopherTrip agent</p>
        <p className="ai-intro__message">{intro}</p>
      </div>
    </section>
  );
}
