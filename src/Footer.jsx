// Ei 3 ta line nijer tothyo diye bodlao
const HELP_EMAIL = "rahidahmedrokon60@gmail.com";
const MAKER_NAME = "Rahid Ahmed Rokon";
const MAKER_EMAIL = "rahidahmedrokon60@gmail.com";

export default function Footer() {
  return (
    <footer className="site-footer">
      <p>
        Need help? Email <a href={`mailto:${HELP_EMAIL}`}>{HELP_EMAIL}</a>
      </p>
      <p>
        Website made by <strong>{MAKER_NAME}</strong>,{" "}
        <a href={`mailto:${MAKER_EMAIL}`}>{MAKER_EMAIL}</a>
      </p>
    </footer>
  );
}
