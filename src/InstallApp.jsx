import { useEffect, useState } from "react";

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export default function InstallApp() {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(isStandalone());

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setPrompt(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  if (prompt) {
    return (
      <button
        className="install"
        onClick={async () => {
          prompt.prompt();
          await prompt.userChoice;
          setPrompt(null);
        }}
      >
        Install app
      </button>
    );
  }

  if (isIOS()) {
    return (
      <button
        className="install"
        onClick={() =>
          alert(
            "To install: tap the Share button in Safari, then choose Add to Home Screen.",
          )
        }
      >
        Install app
      </button>
    );
  }

  return null;
}
