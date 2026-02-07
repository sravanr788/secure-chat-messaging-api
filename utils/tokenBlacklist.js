const blacklist = new Map();

function addToBlacklist(token, exp) {
  blacklist.set(token, exp);
}

function isBlacklisted(token) {
  return blacklist.has(token);
}

setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  for (const [token, exp] of blacklist.entries()) {
    if (exp < now) blacklist.delete(token);
  }
}, 60000);

module.exports = { addToBlacklist, isBlacklisted };
