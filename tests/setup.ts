// Keep the suite hermetic: the sandbox shell may export real credentials
// (e.g. OPENAI_API_KEY) that would otherwise change module-level behaviour.
delete process.env.OPENAI_API_KEY;
