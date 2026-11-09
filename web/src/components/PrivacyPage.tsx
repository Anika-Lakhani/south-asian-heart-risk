const REPO = "https://github.com/Anika-Lakhani/south-asian-heart-risk";
const UPDATED = "November 9, 2026";

/** The full privacy notice, reached at #privacy. */
export function PrivacyPage({ onBack }: { onBack: () => void }) {
  return (
    <article className="privacy-page">
      <p className="eyebrow">Privacy</p>
      <h1>How your information is handled</h1>
      <p className="lede">
        Short version: the risk check never leaves your browser. If you choose to donate, your
        answers are stored anonymously and published in an open dataset for researchers.
      </p>
      <p className="updated">Last updated {UPDATED}</p>

      <section>
        <h2>The risk check</h2>
        <p>
          Everything you enter to get your risk estimates is calculated on your device. None of it
          is sent anywhere or saved, and closing the page clears it. The site uses no cookies, no
          analytics, and no tracking.
        </p>
      </section>

      <section>
        <h2>Donating your data (optional)</h2>
        <p>
          Donating is a separate choice you make after your results, by checking an unchecked box.
          Nothing is sent before then, and you can stop at any point.
        </p>
        <h3>What’s collected</h3>
        <ul>
          <li>
            <strong>From the risk check:</strong> age as a 5-year range (for example 45–49), sex,
            ancestry, blood pressure, cholesterol, BMI rounded to a whole number, smoking, diabetes,
            kidney function, medications you ticked, and the health conditions on the form.
          </li>
          <li>
            <strong>Research questions:</strong> heart history (and age at a first heart event, if
            any), whether you were born in the country you live in and for how long you’ve lived
            there, and where your numbers came from.
          </li>
          <li>
            <strong>Optional sections, only if you choose them:</strong> waist size, other tobacco
            use, diet, lab results you know, family history, exercise, alcohol, sleep, education,
            and a broad region of residence.
          </li>
        </ul>
        <h3>What’s never collected</h3>
        <ul>
          <li>Your name, email, phone number, address, or any account.</li>
          <li>Your exact age, birthday, city, or state.</li>
          <li>The exact time you donated: only the month is stored.</li>
        </ul>
        <p>
          Each donation gets a random code, generated in your browser, that links your sections
          together. It isn’t derived from anything about you.
        </p>
      </section>

      <section>
        <h2>Where it’s stored, and who can see it</h2>
        <p>
          Donations are stored with <a href="https://supabase.com">Supabase</a>, a database host.
          The website can only <em>add</em> answers; it can’t read them back. Only the project
          maintainer can read the stored answers, using a private key that never appears in the
          website.
        </p>
        <p>
          Like most web hosts, Supabase keeps routine access logs, which can include IP addresses,
          for one day. Those logs are never linked to or stored with your answers.
        </p>
      </section>

      <section>
        <h2>The public dataset</h2>
        <p>
          Donated answers are published in periodic releases that anyone can download, under the
          Creative Commons Attribution 4.0 license. Before each release:
        </p>
        <ul>
          <li>Test entries are removed.</li>
          <li>
            Every combination of age range, sex, ancestry, and region must describe at least 5
            people. Rarer combinations are merged into broader groups or held back, so no one can be
            singled out.
          </li>
        </ul>
        <p>
          Every field is documented in the{" "}
          <a href={`${REPO}/blob/main/docs/DATA_DICTIONARY.md`}>data dictionary</a>.
        </p>
      </section>

      <section>
        <h2>Withdrawing</h2>
        <p>
          Because donations are anonymous, there’s no way to find a specific person’s answers
          afterward, so they can’t be withdrawn once sent. If you might want to remove your answers
          later, please don’t donate.
        </p>
      </section>

      <section>
        <h2>Not medical care</h2>
        <p>
          This is an independent, open-source educational project, not a healthcare provider, and
          it doesn’t give medical advice. Talk to a clinician about your heart health.
        </p>
      </section>

      <section>
        <h2>Questions or changes</h2>
        <p>
          Questions can be raised on the project’s{" "}
          <a href={`${REPO}/issues`}>GitHub issues page</a>. If this notice changes, the date at the
          top will change, and the full history is public in the{" "}
          <a href={`${REPO}/commits/main/web/src/components/PrivacyPage.tsx`}>project’s code</a>.
        </p>
      </section>

      <button type="button" className="secondary-button" onClick={onBack}>
        ← Back
      </button>
    </article>
  );
}
