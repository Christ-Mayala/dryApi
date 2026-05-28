const IDE_USER_AGENTS = ['continue', 'cline', 'zed', 'cursor', 'windsurf', 'zoo', 'zoo code'];

/**
 * Detect if request is coming from an IDE (Continue, Cline, Zed, etc.)
 * @param {string | undefined} userAgent
 * @param {string | undefined} xIdeHeader
 * @returns {boolean}
 */
function detectIdeMode(userAgent, xIdeHeader) {
  if (xIdeHeader) return true;
  if (!userAgent) return false;
  
  const lowerAgent = userAgent.toLowerCase();
  return IDE_USER_AGENTS.some(agent => lowerAgent.includes(agent));
}

module.exports = {
  detectIdeMode
};
