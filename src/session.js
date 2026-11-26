const REMEMBER = "er_remember";
const SEEN = "er_seen";

// Koto shomoy porjonto auto login thakbe (5 minute)
export const GRACE_MS = 5 * 60 * 1000;

const get = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const set = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
};
const del = (k) => {
  try {
    localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
};

export const rememberOn = () => {
  set(REMEMBER, "1");
  set(SEEN, String(Date.now()));
};

export const forgetSession = () => {
  del(REMEMBER);
  del(SEEN);
};

// Site khola thakle "ekhon-o achi" shomoy ta update kore
export const touch = () => {
  if (get(REMEMBER) === "1") set(SEEN, String(Date.now()));
};

export const sessionExpired = () =>
  get(REMEMBER) === "1" && Date.now() - Number(get(SEEN) || 0) > GRACE_MS;
