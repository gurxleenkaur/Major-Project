
import type { CSSProperties } from "react";
import "./MagicalParticles.css";

type ParticleStyle = CSSProperties & {
  "--particle-x": string;
  "--particle-size": string;
  "--particle-delay": string;
  "--particle-duration": string;
  "--particle-drift": string;
};

const particles: ParticleStyle[] = Array.from(
  { length: 65 },
  (_, i) => ({
    "--particle-x": `${(i * 47 + 13) % 100}%`,
    "--particle-size": `${3 + (i % 5) * 2}px`,
    "--particle-delay": `${-((i * 11) % 28)}s`,
    "--particle-duration": `${15 + (i % 12) * 1.5}s`,
    "--particle-drift": `${
      (i % 2 ? 1 : -1) * (18 + (i * 13) % 75)
    }px`,
  })
);

export default function MagicalParticles() {
  return (
    <div className="ss-magical-particles" aria-hidden="true">
      {particles.map((style, i) => (
        <span
          className="ss-magical-particle"
          style={style}
          key={i}
        />
      ))}
    </div>
  );
}
