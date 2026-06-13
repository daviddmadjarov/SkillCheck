# SkillBench – Human Performance Laboratory

## Projektübersicht
SkillBench ist eine moderne, futuristisch gestaltete Webplattform, die auf echte menschliche Performance (Reaktionsgeschwindigkeit, Präzision, Mauskontrolle, Tastaturgeschwindigkeit, Rhythmusgefühl, Räumliches Denken) testet. 

Das Design reflektiert ein High-Tech Forschungszentrum – clean, dunkel, mit leuchtenden UI-Elementen und Glas-Effekten.

## Technischer Stack
- **Frontend**: Next.js, React, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Supabase (PostgreSQL)
- **Authentication**: Auth via Google, Discord, E-Mail (Supabase Auth)
- **Multiplayer/Echtzeit**: Supabase Realtime / WebSockets

## Geplante Struktur

### 1. Benutzerverwaltung & Profile
- Registrierung und Login
- Profilseite mit globalem Ranking, Statistiken, Histogrammen, etc.

### 2. Kategorien & Tests
- **Reaction**: Reaction Time, Audio Reaction, Multi-Reaction
- **Aim & Precision**: Aim Trainer, Moving Targets, Tracking Test, Perfect Split
- **Typing**: Typing Speed Test (Monkeytype-ähnlich)
- **Mouse Control**: Perfect Circle, Perfect Square, Perfect Line, Symbol Tracing
- **Rhythmus & Timing**: Rhythm Clicker, Sync Test, Stop the Timer
- **Thinking Games**: Mental Rotation, Estimation Challenge, Sequence Memory

### 3. Multiplayer & Lobbys
- Lobby-Erstellung und Link-Sharing
- Live-Ranglisten und Spielmodi (Duell, Party, Turnier)

## Nächste Schritte
Um das Projekt aufzusetzen, wird Node.js und npm benötigt, welche auf deinem aktuellen System im Terminal noch nicht gefunden wurden. Sobald Node.js installiert ist, können wir das Projekt mit \`npx create-next-app\` initialisieren.
