export default function Home() {
  const botName = process.env.BOT_NAME || "Yuna";

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        fontFamily: "system-ui, -apple-system, sans-serif",
        backgroundColor: "#0a0a0a",
        color: "#ededed",
        padding: "2rem",
      }}
    >
      <h1 style={{ fontSize: "3rem", fontWeight: 700, marginBottom: "0.5rem" }}>
        {botName}
      </h1>
      <p
        style={{
          fontSize: "1.25rem",
          color: "#888",
          marginBottom: "2rem",
          textAlign: "center",
        }}
      >
        AI-powered multi-device orchestrator over Telegram
      </p>
      <div
        style={{
          display: "flex",
          gap: "1rem",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <a
          href="/api/health"
          style={{
            padding: "0.75rem 1.5rem",
            borderRadius: "8px",
            border: "1px solid #333",
            color: "#ededed",
            textDecoration: "none",
            fontSize: "0.875rem",
          }}
        >
          Health Check
        </a>
        <a
          href="https://github.com/mikevitelli/yuna"
          style={{
            padding: "0.75rem 1.5rem",
            borderRadius: "8px",
            border: "1px solid #333",
            color: "#ededed",
            textDecoration: "none",
            fontSize: "0.875rem",
          }}
        >
          GitHub
        </a>
      </div>
    </main>
  );
}
