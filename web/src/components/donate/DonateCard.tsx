interface Props {
  southAsian: boolean;
  onDonate: () => void;
}

/** Shown right after "Why the calculators disagree", when the case for better data is clearest. */
export function DonateCard({ southAsian, onDonate }: Props) {
  return (
    <section className="donate-card" aria-labelledby="donate-card-title">
      <div>
        <p className="eyebrow">Donate your data to science</p>
        <h2 id="donate-card-title">
          {southAsian
            ? "US health surveys lump all Asian Americans together. Your answers help fix that."
            : "Help build better heart data for underrepresented groups."}
        </h2>
        <p>
          Add your anonymous answers to a free public dataset for researchers. It takes about a
          minute, and nothing identifies you.
        </p>
      </div>
      <button type="button" className="primary-button" onClick={onDonate}>
        Learn more and donate <span aria-hidden="true">→</span>
      </button>
    </section>
  );
}
